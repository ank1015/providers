import { Api, Content, Message, Model, OptionsForApi, Tool, ToolResultMessage,  } from "../types";
import type { Static, TSchema } from "@sinclair/typebox";


export interface AgentToolResult<T> {
	// Content blocks supporting text and images
	content: Content;
	// Details to be displayed in a UI or logged
	details: T;
}

/**
 * Attachment type definition.
 * TO make it easy for applications to pass inputs
 */
export interface Attachment {
	id: string;
	type: "image" | "file";
	fileName: string;
	mimeType: string;
	size?: number;
	content: string; // base64 encoded (without data URL prefix)
}

// Callback for streaming tool execution updates
export type AgentToolUpdateCallback<T = any> = (partialResult: AgentToolResult<T>) => void;

// AgentTool extends Tool but adds the execute function
export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
	// A human-readable label for the tool to be displayed in UI
	label: string;
	execute: (
		toolCallId: string,
		params: Static<TParameters>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails>,
	) => Promise<AgentToolResult<TDetails>>;
}

export interface Provider<TApi extends Api> {
    model: Model<TApi>;
    providerOptions: OptionsForApi<TApi>
}

// Queued message with optional LLM representation
export interface QueuedMessage<TApp = Message> {
	original: TApp; // Original message for UI events
	llm?: Message; // Optional transformed message for loop context (undefined if filtered)
}

export interface AgentState {
    systemPrompt?: string;
    provider: Provider<Api>;
    messages: Message[];
    tools: AgentTool[]
    isStreaming: boolean;
	pendingToolCalls: Set<string>;
	error?: string;
}

// Event types
// Events are emitted due to execution. They don't affect execution.
// Events are for live updates to application. They should contain same information as the store messages array.
// Applications must be able to construct same state with messages and events.
export type AgentEvent =
	// Emitted when the agent starts. An agent can emit multiple turns
	| { type: "agent_start" }
	// Emitted when a turn starts. A turn can emit an optional user message (initial prompt), an assistant message (response) and multiple tool result messages
	| { type: "turn_start" }
	// Emitted when a user, assistant or tool result message starts
	| { type: "message_start", messageType: 'user' | 'assistant' | 'tool' | 'custom', messageId: string }
	// Emitted when a user, assistant or tool result message starts
	| { type: "message_update", messageType: 'user' | 'assistant' | 'tool' | 'custom', messageId: string, message: Message }
	// Emitted when a user, assistant or tool result message starts
	| { type: "message_end", messageType: 'user' | 'assistant' | 'tool' | 'custom', messageId: string, message: Message }
	// Emitted when a tool execution starts
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
	// Emitted when a tool execution produces output (streaming)
	| {
        type: "tool_execution_update";
        toolCallId: string;
        toolName: string;
        args: any;
        partialResult: AgentToolResult<any>
      }
	// Emitted when a tool execution completes
	| {
        type: "tool_execution_end";
        toolCallId: string;
        toolName: string;
        result: AgentToolResult<any>;
        isError: boolean;
      }
	// Emitted when a full turn completes
	| { type: "turn_end", turnMessages: Message[]}
	// Emitted when the agent has completed all its turns. All messages from every turn are
	// contained in messages, which can be appended to the context
	| { type: "agent_end", agentMessages: Message[]};