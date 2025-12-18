import { getModel } from "../models";
import { Api, CustomMessage, Message } from "../types";
import { AgentEvent, AgentState, Attachment, Provider, QueuedMessage } from "./types";
import { generateUUID } from "../utils/uuid";

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

    async prompt(input: string, attachments?: Attachment[]) {

    }

	/**
	 * Continue from the current context without adding a new user message.
	 * Used for retry after overflow recovery when context already has user message or tool results.
	 */
	async continue() {

    }


	private emit(e: AgentEvent) {
		for (const listener of this.listeners) {
			listener(e);
		}
	}

}