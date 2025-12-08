import { Response } from "openai/resources/responses/responses.js";
import type { TSchema } from "@sinclair/typebox";
import { OpenAIProviderOptions } from "./providers/openai";
import { AssistantMessageEventStream } from "./utils/event-stream";

export type Api = 'openai'

export interface Model<TApi extends Api> {
	id: string;
	name: string;
	api: TApi;
	baseUrl: string;
	reasoning: boolean;
	input: ("text" | "image" | "file")[];
	cost: {
		input: number; // $/million tokens
		output: number; // $/million tokens
		cacheRead: number; // $/million tokens
		cacheWrite: number; // $/million tokens
	};
	contextWindow: number;
	maxTokens: number;
	headers?: Record<string, string>;
}


// ################################ Types for Standardized storing of User Message and Tool Result

export interface UserMessage {
    role: "user"
    timestamp: number;
    content: (UserTextContent | UserImageContent | UserFileContent)[] // Supports text, images and files
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolName: string;
	toolCallId?: string;
    content: (UserTextContent | UserImageContent | UserFileContent)[]; // Supports text, images and files
	details?: TDetails; // Any extra information not sent to model
	isError: boolean;
	timestamp: number; // Unix timestamp in milliseconds
}

export interface UserImageContent {
    type: "image"
	data: string; // base64 encoded image data
	mimeType: string; // e.g., "image/jpeg", "image/png"
}

export interface UserFileContent {
    type: "file"
	data: string; // base64 buffer encoded data
	mimeType: string; // e.g., "application/pdf",
}

export interface UserTextContent {
    type: 'text'
    content: string
}

// ################################ Types for Native Assistant Message

export interface NativeOpenAIMessage {
	role: "assistant"
    _provider: 'openai'
    message: Response
}

export type NativeAssistantMessage = NativeOpenAIMessage;

// ################################ Types for Stored Message

export type Message = UserMessage | NativeAssistantMessage | ToolResultMessage

export interface Tool<TParameters extends TSchema = TSchema> {
	name: string;
	description: string;
	parameters: TParameters;
}
export interface Context {
	messages: Message[]
	systemPrompt?: string;
	tools?: Tool[]
}

// ################################ Types for Standardized streaming of Assistant Message

export interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

// return content from assistant -> Thinking, Text, ToolCall, Image (for image models)
export interface AssistantMessage {
	role: "assistant";
	content: (AssistantTextContent | AssistantThinkingContent | AssistantToolCall | AbstractedImageContent)[];
	api: Api;
	model: string;
	usage: Usage;
	stopReason: StopReason;
	errorMessage?: string;
	timestamp: number; // Unix timestamp in milliseconds
}

export interface AssistantTextContent {
    type: 'text'
    text: string
}

export interface AssistantThinkingContent {
    type: 'thinking'
    thinking: string
}

export interface AssistantToolCall {
	type: "toolCall";
    name: string
	arguments: Record<string, any>;
	id?: string
}

export interface AbstractedImageContent {
	type: "image";
	data: string; // base64 encoded image data
	mimeType: string; // e.g., "image/jpeg", "image/png"
}

export type AssistantMessageEvent =
	| { type: "start"; partial: AssistantMessage }
	| { type: "text_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
	| { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
	| { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "toolcall_end"; contentIndex: number; toolCall: AssistantToolCall; partial: AssistantMessage }
	| { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
	| { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage };



// ################################ Types for Stream Function

export interface ApiOptionsMap {
	"openai": OpenAIProviderOptions;
}

export type OptionsForApi<TApi extends Api> = ApiOptionsMap[TApi];


export type StreamFunction<TApi extends Api> = (
	model: Model<TApi>,
	context: Context,
	options: OptionsForApi<TApi>,
) => AssistantMessageEventStream;