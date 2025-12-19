import { getModel } from "../models";
import { Api, AssistantResponse, Content, CustomMessage, Message, ToolResultMessage, UserMessage } from "../types";
import { AgentEvent, AgentLoopConfig, AgentState, AgentTool, AgentToolResult, Attachment, Provider, QueuedMessage } from "./types";
import { generateUUID } from "../utils/uuid";
import { complete } from "../complete";
import { validateToolArguments } from "../utils/validation";

export interface AgentOptions {
    initialState?: Partial<AgentState>;
    // Transform messages (for example - custom) to LLM-compatible messages before sending
    messageTransformer?: (messages: Message[]) => Message[] | Promise<Message[]>;
	// Queue mode: "all" = send all queued messages at once, "one-at-a-time" = send one queued message per turn
	queueMode?: "all" | "one-at-a-time";
}

const defaultProvider: Provider<'google'> = {
    model: getModel('google', 'gemini-3-flash-preview')!,
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
    return messages
}

export class Conversation {
    private _state: AgentState = defaultConversationState;
	private listeners = new Set<(e: AgentEvent) => void>();
	private abortController?: AbortController;
    private messageTransformer: (messages: Message[]) => Message[] | Promise<Message[]>;
    private messageQueue: Array<QueuedMessage<Message>> = [];
	private queueMode: "all" | "one-at-a-time";
	private runningPrompt?: Promise<void>;
	private resolveRunningPrompt?: () => void;

    constructor(opts: AgentOptions) {
		this._state = { ...this._state, ...opts.initialState };
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

	// State mutators - update internal state without emitting events
	setSystemPrompt(v: string) {
		this._state.systemPrompt = v;
	}

    setProvider(provider: Provider<Api>){
        this.state.provider = provider
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

	appendMessages(ms: Message[]){
		this.state.messages.push(...ms)
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
	 * Clear all messages and state. Call abort() first if a prompt is in flight.
	 */
	reset() {
		this._state.messages = [];
		this._state.isStreaming = false;
		this._state.pendingToolCalls = new Set<string>();
		this._state.error = undefined;
		this.messageQueue = [];
	}

	/**
	 * Append custom message to messages. 
     * Custom messages are inserted after running prompt resolves
	 */
    async addCustomMessage(message: Record<string, any>){
        const messageId = generateUUID();
        // emit message start event
        this.emit({type: 'message_start', messageId, messageType: 'custom'});
        const customMessage: CustomMessage = {
            role: 'custom',
            id: messageId,
            content: message,
            timestamp: Date.now()
        }
        this.emit({type: 'message_update', messageId, messageType: 'custom', message: customMessage});
        await this.waitForIdle();
        this.appendMessage(customMessage);
        this.emit({type: 'message_end', messageId, messageType: 'custom', message: customMessage});
    }

    async prompt(input: string, attachments?: Attachment[]): Promise<Message[]>  {

		const model = this._state.provider.model;
		if (!model) {
			throw new Error("No model configured");
		}

		const content: Content = [];
		content.push({
			type: 'text',
			content: input
		})
		if(attachments?.length){
			for (const attachment of attachments){
				if(attachment.type === 'image'){
					content.push({
						type: 'image',
						data: attachment.content,
						mimeType: attachment.mimeType,
						metadata: {
							fileName: attachment.fileName,
							size: attachment.size || 0
						}
					})
				}
				if(attachment.type === 'file'){
					content.push({
						type: 'file',
						data: attachment.content,
						mimeType: attachment.mimeType,
						filename: attachment.fileName,
						metadata: {
							fileName: attachment.fileName,
							size: attachment.size || 0
						}
					})
				}
			}
		}
		const userMessage: UserMessage = {
			role: 'user',
			id: generateUUID(),
			timestamp: Date.now(),
			content
		};

		const newMessages = await this._runAgentLoop(userMessage);
		return newMessages;
    }

	/**
	 * Continue from the current context without adding a new user message.
	 * Used for retry after overflow recovery when context already has user message or tool results.
	 */
	async continue(): Promise<Message[]> {
		const messages = this._state.messages;
		if (messages.length === 0) {
			throw new Error("No messages to continue from");
		}

		const lastMessage = messages[messages.length - 1];
		if (lastMessage.role !== "user" && lastMessage.role !== "toolResult") {
			throw new Error(`Cannot continue from message role: ${lastMessage.role}`);
		}

		const newMessages = await this._runAgentLoopContinue();
		return newMessages;
    }

	/**
	 * Prepare for running the agent loop.
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
		this._state.isStreaming = true;
		this._state.error = undefined;

		const cfg: AgentLoopConfig = {
			systemPrompt: this._state.systemPrompt,
			tools: this._state.tools,
			provider: this.state.provider,
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
		return { llmMessages, cfg };
	}

	/**
	 * Internal: Run the agent loop with a new user message.
	 */
	private async _runAgentLoop(userMessage: Message): Promise<Message[]>{
		const { llmMessages, cfg } = await this._prepareRun();

		const updatedMessages = [...llmMessages, userMessage];
		this.emit({type: 'agent_start'});
		this.emit({type: 'turn_start'});
		this.emit({type: 'message_start', messageId: userMessage.id, messageType: 'user'})
		this.emit({type: 'message_end', messageId: userMessage.id, messageType: 'user', message: userMessage})
		this.appendMessage(userMessage)
		const newMessages: Message[] = [];

		await this._runLoop(cfg, updatedMessages, newMessages);
		return newMessages
	}

	private async _runAgentLoopContinue(): Promise<Message[]>{
		const { llmMessages, cfg } = await this._prepareRun();

		// Validate that we can continue from this context
		const lastMessage = llmMessages[llmMessages.length - 1];
		if (!lastMessage) {
			throw new Error("Cannot continue: no messages in context");
		}
		if (lastMessage.role !== "user" && lastMessage.role !== "toolResult") {
			throw new Error(`Cannot continue from message role: ${lastMessage.role}. Expected 'user' or 'toolResult'.`);
		}

		const newMessages: Message[] = [];
		this.emit({type: 'agent_start'});
		this.emit({type: 'turn_start'});
		// No user message events - we're continuing from existing context
		await this._runLoop(cfg, llmMessages, newMessages);
		return newMessages;
	}

	private async _runLoop(cfg: AgentLoopConfig, updatedMessages: Message[], newMessages: Message[]){
		const signal: AbortSignal = this.abortController?.signal!;
		const providerOptions = {...this.state.provider.providerOptions, signal}

		let hasMoreToolCalls = true;
		let firstTurn = true;
		let queuedMessages: QueuedMessage<any>[] = (await cfg.getQueuedMessages?.()) || [];

		while (hasMoreToolCalls || queuedMessages.length > 0) {
			if (!firstTurn) {
				this.emit({type: 'turn_start'})
			} else {
				firstTurn = false;
			}

			// Process queued messages first (inject before next assistant response)
			if (queuedMessages.length > 0) {
				for (const { original, llm } of queuedMessages) {
					if (llm) {
						this.emit({type: 'message_start', messageId: llm?.id!, messageType: llm?.role })
						this.emit({type: 'message_end', messageId: llm?.id!, messageType: llm?.role, message: llm })
						updatedMessages.push(llm);
						newMessages.push(llm);
						this.appendMessage(llm)
					}
				}
				queuedMessages = [];
			}

			// Get assistant response
			const assistantMessageId = generateUUID()
			this.emit({type: 'message_start', messageId: assistantMessageId, messageType: 'assistant'});
			const assistantMessage = await complete(
				cfg.provider.model, 
				{
					messages: updatedMessages, 
					systemPrompt: cfg.systemPrompt, 
					tools: cfg.tools
				}, 
				providerOptions, 
				assistantMessageId);
			this.emit({type: 'message_end', messageId: assistantMessageId, messageType: 'assistant', message: assistantMessage});
			newMessages.push(assistantMessage);
			this.appendMessage(assistantMessage);

			const stopReason = assistantMessage.getStopReason()
			if(stopReason === 'aborted' || stopReason === 'error'){
				// Stop the loop on error or abort
				this.emit({type: "turn_end"});
				this.emit({type: "agent_end", agentMessages: newMessages});
				return;
			}

			const assistantMessageContent = assistantMessage.getContent();

			// Check for tool calls
			const toolCalls = assistantMessageContent.filter((c) => c.type === "toolCall");
			hasMoreToolCalls = toolCalls.length > 0;

			const toolResults: ToolResultMessage[] = [];
			if (hasMoreToolCalls) {
				// Execute tool calls
				toolResults.push(...(await this.executeToolCalls(cfg.tools, assistantMessageContent, signal)));
				updatedMessages.push(...toolResults);
				newMessages.push(...toolResults);
				this.appendMessages(toolResults);
			}

			this.emit({type: 'turn_end'})

			// Get queued messages after turn completes
			queuedMessages = (await cfg.getQueuedMessages?.()) || [];
		}

		this.emit({type: 'agent_end', agentMessages: newMessages});
	}

	private async executeToolCalls<T>(tools: AgentTool[], assistantMessageContent: AssistantResponse, signal: AbortSignal): Promise<ToolResultMessage<T>[]>{
		const toolCalls = assistantMessageContent.filter((c) => c.type === "toolCall");
		const results: ToolResultMessage<any>[] = [];


		for (const toolCall of toolCalls) {
			const tool = tools?.find((t) => t.name === toolCall.name);

			this.emit({
				type: 'tool_execution_start',
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.name,
				args: toolCall.arguments
			})
			let result: AgentToolResult<T>;
			let isError = false;
			let errorDetails: ToolResultMessage["error"] | undefined;


			try {
				if (!tool) throw new Error(`Tool ${toolCall.name} not found`);

				// Validate arguments using shared validation function
				const validatedArgs = validateToolArguments(tool, toolCall);

				// Execute with validated, typed arguments, passing update callback
				result = await tool.execute(toolCall.toolCallId, validatedArgs, signal, (partialResult) => {
					this.emit({
						type: "tool_execution_update",
						toolCallId: toolCall.toolCallId,
						toolName: toolCall.name,
						args: toolCall.arguments,
						partialResult,
					})
				});

			}catch(e){
				result = {
					content: [{ type: "text", content: e instanceof Error ? e.message : String(e) }],
					details: {} as T,
				};
				isError = true;
				// Preserve full error details for debugging
				if (e instanceof Error) {
					errorDetails = {
						message: e.message,
						name: e.name,
						stack: e.stack,
					};
				}
			}

			this.emit({
				type: "tool_execution_end",
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.name,
				result,
				isError,
			})

			const messageId = generateUUID()

			const toolResultMessage: ToolResultMessage<T> = {
				role: "toolResult",
				id: messageId,
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.name,
				content: result.content,
				details: result.details,
				isError,
				error: errorDetails,
				timestamp: Date.now(),
			};

			results.push(toolResultMessage);
			this.emit({
				type: 'message_start',
				messageId,
				messageType: 'toolResult'
			})
			this.emit({
				type: 'message_end',
				messageId,
				messageType: 'toolResult',
				message: toolResultMessage
			})
		}
		return results;
	}



}