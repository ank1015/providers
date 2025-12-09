import { Message, Tool, UserTextContent, UserImageContent, UserFileContent, ToolResultMessage, AssistantMessageEvent, AssistantMessage, Model, OptionsForApi, Api, UserMessage } from "../types";
import type { Static, TSchema } from "@sinclair/typebox";


export interface AgentToolResult<T> {
	// Content blocks supporting text and images
	content: (UserTextContent | UserImageContent | UserFileContent)[];
	// Details to be displayed in a UI or logged
	details: T;
}

// AgentTool extends Tool but adds the execute function
export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
	// A human-readable label for the tool to be displayed in UI
	label: string;
	execute: (
		toolCallId: string,
		params: Static<TParameters>,
		signal?: AbortSignal,
	) => Promise<AgentToolResult<TDetails>>;
}

// AgentContext is like Context but uses AgentTool
export interface AgentContext {
	systemPrompt: string;
	messages: Message[];
	tools?: AgentTool<any>[];
}


// Event types
export type AgentEvent =
	// Emitted when the agent starts. An agent can emit multiple turns
	| { type: "agent_start" }
	// Emitted when a turn starts. A turn can emit an optional user message (initial prompt), an assistant message (response) and multiple tool result messages
	| { type: "turn_start" }
	// Emitted when a user, assistant or tool result message starts
	| { type: "message_start"; message: AssistantMessage | UserMessage | ToolResultMessage }
	// Emitted when an asssitant messages is updated due to streaming
	| { type: "message_update"; assistantMessageEvent: AssistantMessageEvent; message: AssistantMessage }
	// Emitted when a user, assistant or tool result message is complete
	| { type: "message_end"; message: AssistantMessage | UserMessage | ToolResultMessage }
	// Emitted when a tool execution starts
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
	// Emitted when a tool execution completes
	| {
			type: "tool_execution_end";
			toolCallId: string;
			toolName: string;
			result: AgentToolResult<any> | string;
			isError: boolean;
	  }
	// Emitted when a full turn completes
	| { type: "turn_end"; message: AssistantMessage; toolResults: ToolResultMessage[] }
	// Emitted when the agent has completed all its turns. All messages from every turn are
	// contained in messages, which can be appended to the context
	| { type: "agent_end"; messages: AgentContext["messages"] };

// Queued message with optional LLM representation
export interface QueuedMessage<TApp = Message> {
	original: TApp; // Original message for UI events
	llm?: Message; // Optional transformed message for loop context (undefined if filtered)
}

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface SimpleProviderOptions {
	reasoning?: ReasoningEffort;
	signal?: AbortSignal;
	apiKey?: string;
	maxTokens?: number;
}

// Configuration for agent loop execution
export interface AgentLoopConfig<TApi extends Api> {
	model: Model<TApi>;
	preprocessor?: (messages: AgentContext["messages"]) => Promise<AgentContext["messages"]>;
    providerOptions: OptionsForApi<TApi>,
	getQueuedMessages?: <T>() => Promise<QueuedMessage<T>[]>;
}