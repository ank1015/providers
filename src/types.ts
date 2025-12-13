import { Response } from "openai/resources/responses/responses.js";
import type { TSchema } from "@sinclair/typebox";
import { OpenAIProviderOptions } from "./providers/openai";
import { AssistantMessageEventStream } from "./utils/event-stream";
import { GoogleProviderOptions } from "./providers/google";
import type { GenerateContentResponse } from "@google/genai";

export type Api = 'openai' | 'google'

export const KnownApi: Api[] = ['openai', 'google']
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
    timestamp?: number;
    content: (UserTextContent | UserImageContent | UserFileContent)[] // Supports text, images and files
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolName: string;
	toolCallId?: string;
    content: (UserTextContent | UserImageContent | UserFileContent)[]; // Supports text, images and files
	details?: TDetails; // Any extra information not sent to model
	isError: boolean;
	error?: {
		message: string;
		name?: string;
		stack?: string;
	}; // Full error details if isError is true
	timestamp: number; // Unix timestamp in milliseconds
}

export interface CustomMessage {
	role: "custom";
	content: Record<string, any>; // Any custom data structure for application-specific metadata
}

export interface UserImageContent {
    type: "image"
	data: string; // base64 encoded image data
	mimeType: string; // e.g., "image/jpeg", "image/png"
	metadata?: Record<string, any>; // Optional metadata for storage purposes
}

export interface UserFileContent {
    type: "file"
	data: string; // base64 buffer encoded data
	mimeType: string; // e.g., "application/pdf",
	metadata?: Record<string, any>; // Optional metadata for storage purposes
}

export interface UserTextContent {
    type: 'text'
    content: string
	metadata?: Record<string, any>; // Optional metadata for storage purposes
}

// ################################ Types for Native Assistant Message

export interface NativeOpenAIMessage {
	role: "assistant"
    _provider: 'openai'
    message: Response
	startTimestamp: number; // Unix timestamp when streaming started
	endTimestamp: number; // Unix timestamp when streaming ended
	error?: {
		message: string;
		name?: string;
		stack?: string;
	}; // Error details if streaming failed
}

export interface NativeGoogleMessage {
	role: "assistant"
    _provider: 'google'
    message: GenerateContentResponse
	startTimestamp: number; // Unix timestamp when streaming started
	endTimestamp: number; // Unix timestamp when streaming ended
	error?: {
		message: string;
		name?: string;
		stack?: string;
	}; // Error details if streaming failed
}

export type NativeAssistantMessage = NativeOpenAIMessage | NativeGoogleMessage;

// ################################ Types for Stored Message

export type Message = UserMessage | NativeAssistantMessage | ToolResultMessage | CustomMessage

export interface Tool<TParameters extends TSchema = TSchema, TName extends string = string> {
	name: TName;
	description: string;
	parameters: TParameters;
}

// Helper type to extract tool names from a tool array for better autocomplete
export type ToolName<TTool extends Tool> = TTool["name"];
export type ToolNames<TTools extends readonly Tool[]> = TTools[number]["name"];

// Helper function to create a tool with better type inference
// Use 'as const' on the tool array for best autocomplete:
// const tools = [defineTool({ name: "calculator", ... }), ...] as const
export function defineTool<TParameters extends TSchema, TName extends string>(
	tool: Tool<TParameters, TName>
): Tool<TParameters, TName> {
	return tool;
}

export interface Context<TTools extends readonly Tool[] = readonly Tool[]> {
	messages: Message[]
	systemPrompt?: string;
	tools?: TTools
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
	duration?: number; // Duration in milliseconds (endTimestamp - startTimestamp)
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
	"google": GoogleProviderOptions;
}

export type OptionsForApi<TApi extends Api> = ApiOptionsMap[TApi];


export type StreamFunction<TApi extends Api> = (
	model: Model<TApi>,
	context: Context,
	options: OptionsForApi<TApi>,
) => AssistantMessageEventStream;