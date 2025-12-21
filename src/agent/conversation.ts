import { getModel } from "../models.js";
import { Api, CustomMessage, Message, ToolResultMessage } from "../types.js";
import { AgentEvent, AgentLoopConfig, AgentState, AgentTool, Attachment, Provider, QueuedMessage } from "./types.js";
import { generateUUID } from "../utils/uuid.js";
import { LLMClient, DefaultLLMClient } from "../llm.js";
import { buildUserMessage } from "./utils.js";
import { AgentRunner, AgentRunnerCallbacks, DefaultAgentRunner } from "./runner.js";

export interface AgentOptions {
	initialState?: Partial<AgentState>;
	// Transform messages (for example - custom) to LLM-compatible messages before sending
	messageTransformer?: (messages: Message[]) => Message[] | Promise<Message[]>;
	// Queue mode: "all" = send all queued messages at once, "one-at-a-time" = send one queued message per turn
	queueMode?: "all" | "one-at-a-time";
	// LLM Client for dependency injection
	client?: LLMClient;
	// Agent Runner for dependency injection
	runner?: AgentRunner;
}

const defaultModel = getModel('google', 'gemini-3-flash-preview');
if (!defaultModel) {
	throw new Error("Default model 'gemini-3-flash-preview' not found in models configuration");
}

const defaultProvider: Provider<'google'> = {
	model: defaultModel,
	providerOptions: {}
}

const defaultConversationState: AgentState = {
	provider: defaultProvider,
	messages: [],
	tools: [],
	isStreaming: false,
	pendingToolCalls: new Set<string>(),
	error: undefined
}

const defaultMessageTransformer = (messages: Message[]) => {
	return messages.slice(); // Return a copy to avoid mutation of original array
}

export class Conversation {
	private client: LLMClient;
	private runner: AgentRunner;
	private _state: AgentState = defaultConversationState;
	private listeners = new Set<(e: AgentEvent) => void>();
	private abortController?: AbortController;
	private messageTransformer: (messages: Message[]) => Message[] | Promise<Message[]>;
	private messageQueue: Array<QueuedMessage<Message>> = [];
	private queueMode: "all" | "one-at-a-time";
	private runningPrompt?: Promise<void>;
	private resolveRunningPrompt?: () => void;
	private streamAssistantMessage: boolean = true;

	constructor(opts: AgentOptions = {}) {
		const initialState = opts.initialState ?? {};
		this.client = opts.client ?? new DefaultLLMClient();
		this.runner = opts.runner ?? new DefaultAgentRunner(this.client, { streamAssistantMessage: this.streamAssistantMessage });
		// Create fresh copies of reference types to avoid shared state between instances
		this._state = {
			...defaultConversationState,
			...initialState,
			// Override with fresh copies to ensure no shared references
			messages: initialState.messages ? [...initialState.messages] : [],
			tools: initialState.tools ? [...initialState.tools] : [],
			pendingToolCalls: new Set(initialState.pendingToolCalls ?? []),
		};
		this.messageTransformer = opts.messageTransformer || defaultMessageTransformer;
		this.queueMode = opts.queueMode || "one-at-a-time";
	}

	get state(): AgentState {
		return this._state;
	}

	subscribe(fn: (e: AgentEvent) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private emit(e: AgentEvent) {
		for (const listener of this.listeners) {
			listener(e);
		}
	}

	setStreamAssistantMessage(stream: boolean) {
		this.streamAssistantMessage = stream;
		// Recreate runner with updated streaming setting
		this.runner = new DefaultAgentRunner(this.client, { streamAssistantMessage: stream });
	}

	// State mutators - update internal state without emitting events
	setSystemPrompt(v: string) {
		this._state.systemPrompt = v;
	}

	setProvider<TApi extends Api>(provider: Provider<TApi>) {
		this._state.provider = provider;
	}

	setQueueMode(mode: "all" | "one-at-a-time") {
		this.queueMode = mode;
	}

	getQueueMode(): "all" | "one-at-a-time" {
		return this.queueMode;
	}

	setTools(t: typeof this._state.tools) {
		this._state.tools = t;
	}

	replaceMessages(ms: Message[]) {
		this._state.messages = ms.slice();
	}

	appendMessage(m: Message) {
		this._state.messages = [...this._state.messages, m];
	}

	appendMessages(ms: Message[]) {
		this._state.messages = [...this._state.messages, ...ms];
	}

	async queueMessage(m: Message) {
		// Transform message and queue it for injection at next turn
		const transformed = await this.messageTransformer([m]);
		this.messageQueue.push({
			original: m,
			llm: transformed[0], // undefined if filtered out
		});
	}

	clearMessageQueue() {
		this.messageQueue = [];
	}

	clearMessages() {
		this._state.messages = [];
	}

	/**
	 * Remove all event listeners.
	 */
	clearListeners() {
		this.listeners.clear();
	}

	/**
	 * Remove a message by its ID.
	 * @returns true if the message was found and removed, false otherwise.
	 */
	removeMessage(messageId: string): boolean {
		const index = this._state.messages.findIndex(m => m.id === messageId);
		if (index === -1) return false;
		this._state.messages = [
			...this._state.messages.slice(0, index),
			...this._state.messages.slice(index + 1)
		];
		return true;
	}

	/**
	 * Update a message by its ID using an updater function.
	 * @param messageId The ID of the message to update.
	 * @param updater A function that receives the current message and returns the updated message.
	 * @returns true if the message was found and updated, false otherwise.
	 */
	updateMessage(messageId: string, updater: (message: Message) => Message): boolean {
		const index = this._state.messages.findIndex(m => m.id === messageId);
		if (index === -1) return false;
		const updated = updater(this._state.messages[index]);
		this._state.messages = [
			...this._state.messages.slice(0, index),
			updated,
			...this._state.messages.slice(index + 1)
		];
		return true;
	}

	abort() {
		this.abortController?.abort();
	}

	/**
	 * Returns a promise that resolves when the current prompt completes.
	 * Returns immediately resolved promise if no prompt is running.
	 */
	waitForIdle(): Promise<void> {
		return this.runningPrompt ?? Promise.resolve();
	}

	/**
	 * Clear all messages and state. Aborts any running prompt.
	 */
	reset() {
		// Abort any running prompt first
		this.abortController?.abort();
		this.abortController = undefined;

		// Resolve and clear running promise
		this.resolveRunningPrompt?.();
		this.runningPrompt = undefined;
		this.resolveRunningPrompt = undefined;

		// Clear state
		this._state.messages = [];
		this._state.isStreaming = false;
		this._state.pendingToolCalls = new Set<string>();
		this._state.error = undefined;
		this.messageQueue = [];
	}

	/**
	 * Internal cleanup after agent loop completes (success, error, or abort).
	 * Always called in finally block to ensure consistent state.
	 */
	private _cleanup() {
		this._state.isStreaming = false;
		this._state.pendingToolCalls.clear();
		this.abortController = undefined;
		this.resolveRunningPrompt?.();
		this.runningPrompt = undefined;
		this.resolveRunningPrompt = undefined;
	}

	/**
	 * Append custom message to messages. 
	 * Custom messages are inserted after running prompt resolves
	 */
	async addCustomMessage(message: Record<string, any>) {
		const messageId = generateUUID();
		// emit message start event
		const customMessage: CustomMessage = {
			role: 'custom',
			id: messageId,
			content: message,
			timestamp: Date.now()
		}
		this.emit({ type: 'message_start', messageId, messageType: 'custom', message: customMessage });
		this.emit({ type: 'message_update', messageId, messageType: 'custom', message: customMessage });
		await this.waitForIdle();
		this.appendMessage(customMessage);
		this.emit({ type: 'message_end', messageId, messageType: 'custom', message: customMessage });
	}

	async prompt(input: string, attachments?: Attachment[]): Promise<Message[]> {
		// Race condition protection - prevent concurrent prompts
		if (this._state.isStreaming) {
			throw new Error("Cannot start a new prompt while another is running. Use waitForIdle() to wait for completion.");
		}

		const model = this._state.provider.model;
		if (!model) {
			throw new Error("No model configured");
		}

		const userMessage = buildUserMessage(input, attachments);
		const newMessages = await this._runAgentLoop(userMessage);
		return newMessages;
	}

	/**
	 * Continue from the current context without adding a new user message.
	 * Used for retry after overflow recovery when context already has user message or tool results.
	 */
	async continue(): Promise<Message[]> {
		// Race condition protection - prevent concurrent prompts
		if (this._state.isStreaming) {
			throw new Error("Cannot continue while another prompt is running. Use waitForIdle() to wait for completion.");
		}

		// Basic validation - detailed validation on transformed messages happens in _runAgentLoopContinue
		if (this._state.messages.length === 0) {
			throw new Error("No messages to continue from");
		}

		const newMessages = await this._runAgentLoopContinue();
		return newMessages;
	}

	/**
	 * Prepare for running the agent loop.
	 * Returns the config, transformed messages, and abort signal.
	 */
	private async _prepareRun() {
		const model = this._state.provider.model;
		if (!model) {
			throw new Error("No model configured");
		}

		this.runningPrompt = new Promise<void>((resolve) => {
			this.resolveRunningPrompt = resolve;
		});

		this.abortController = new AbortController();
		const signal = this.abortController.signal;
		this._state.isStreaming = true;
		this._state.error = undefined;

		const cfg: AgentLoopConfig = {
			systemPrompt: this._state.systemPrompt,
			tools: this._state.tools,
			provider: this._state.provider,
			getQueuedMessages: async <T>() => {
				if (this.queueMode === "one-at-a-time") {
					if (this.messageQueue.length > 0) {
						const first = this.messageQueue[0];
						this.messageQueue = this.messageQueue.slice(1);
						return [first] as QueuedMessage<T>[];
					}
					return [];
				} else {
					const queued = this.messageQueue.slice();
					this.messageQueue = [];
					return queued as QueuedMessage<T>[];
				}
			}
		}

		const llmMessages = await this.messageTransformer(this._state.messages);
		return { llmMessages, cfg, signal };
	}

	/**
	 * Internal: Run the agent loop with a new user message.
	 */
	private async _runAgentLoop(userMessage: Message): Promise<Message[]> {
		try {
			const { llmMessages, cfg, signal } = await this._prepareRun();
			const updatedMessages = [...llmMessages, userMessage];
			this.emit({ type: 'agent_start' });
			this.emit({ type: 'turn_start' });
			this.emit({ type: 'message_start', messageId: userMessage.id, messageType: 'user', message: userMessage });
			this.emit({ type: 'message_end', messageId: userMessage.id, messageType: 'user', message: userMessage });
			this.appendMessage(userMessage);

			const callbacks = this._createRunnerCallbacks();
			const newMessages = await this.runner.run(cfg, updatedMessages, (e) => this.emit(e), signal, callbacks);
			return newMessages;
		} catch (e) {
			this._state.error = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			this._cleanup();
		}
	}

	private async _runAgentLoopContinue(): Promise<Message[]> {
		try {
			const { llmMessages, cfg, signal } = await this._prepareRun();

			// Validate that we can continue from this context
			const lastMessage = llmMessages[llmMessages.length - 1];
			if (!lastMessage) {
				throw new Error("Cannot continue: no messages in context");
			}
			if (lastMessage.role !== "user" && lastMessage.role !== "toolResult") {
				throw new Error(`Cannot continue from message role: ${lastMessage.role}. Expected 'user' or 'toolResult'.`);
			}

			this.emit({ type: 'agent_start' });
			this.emit({ type: 'turn_start' });

			const callbacks = this._createRunnerCallbacks();
			const newMessages = await this.runner.run(cfg, [...llmMessages], (e) => this.emit(e), signal, callbacks);
			return newMessages;
		} catch (e) {
			this._state.error = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			this._cleanup();
		}
	}

	/**
	 * Create callbacks for AgentRunner to interact with Conversation state.
	 */
	private _createRunnerCallbacks(): AgentRunnerCallbacks {
		return {
			appendMessage: (m) => this.appendMessage(m),
			appendMessages: (ms) => this.appendMessages(ms),
			addPendingToolCall: (id) => this._state.pendingToolCalls.add(id),
			removePendingToolCall: (id) => this._state.pendingToolCalls.delete(id),
		};
	}
}