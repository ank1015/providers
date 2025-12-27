import { Response } from "openai/resources/responses/responses.js";
import type { ChatCompletion } from "openai/resources/chat/completions.js";
import type { GenerateContentResponse } from "@google/genai";
import type { Message } from "@anthropic-ai/sdk/resources/messages.js";
import type { TSchema } from "@sinclair/typebox";
import { OpenAIProviderOptions } from "./providers/openai/index.js";
import { GoogleProviderOptions } from "./providers/google/index.js";
import { DeepSeekProviderOptions } from "./providers/deepseek/index.js";
import { AnthropicProviderOptions } from "./providers/anthropic/index.js";
import { AssistantMessageEventStream } from "./utils/event-stream.js";

export const KnownApis = ['openai', 'google', 'deepseek', 'anthropic'] as const;                                                                                                         
export type Api = typeof KnownApis[number]; 
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
	tools: string[]
	excludeSettings?: string[]
}

// ################################################################
//  Standard Message Types
// ################################################################

export interface TextContent {
    type: 'text';
    content: string;
	metadata?: Record<string, any>; // Optional metadata for storage purposes
}

export interface ImageContent {
    type: "image"
	data: string; // base64 encoded image data
	mimeType: string; // e.g., "image/jpeg", "image/png"
	metadata?: Record<string, any>; // Optional metadata for storage purposes
}

export interface FileContent {
    type: "file"
	data: string; // base64 buffer encoded data
	mimeType: string; // e.g., "application/pdf",
	filename: string;
	metadata?: Record<string, any>; // Optional metadata for storage purposes
}

export type Content = (TextContent | ImageContent | FileContent)[]

export interface UserMessage {
    role: "user"
    id: string;
    timestamp?: number;
    content: Content; // Supports text, images and files
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	id: string;
	toolName: string;
	toolCallId: string;
    content: Content; // Supports text, images and files
	details?: TDetails; // Any extra information not sent to model
	isError: boolean;
	error?: {
		message: string;
		name?: string;
		stack?: string;
	}; // Full error details if isError is true
	timestamp: number; // Unix timestamp in milliseconds
}

export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";


export interface AssistantResponseContent {
    type: 'response';
    content: Content
}

export interface AssistantThinkingContent {
    type: 'thinking';
    thinkingText: string
}

export interface AssistantToolCall {
	type: "toolCall";
    name: string
    arguments: Record<string, any>;
	toolCallId: string
}

export type AssistantResponse = (AssistantResponseContent | AssistantThinkingContent | AssistantToolCall)[];

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

export interface ApiNativeAssistantMessageMap {
    "openai": Response;
    "google": GenerateContentResponse;
    "deepseek": ChatCompletion;
    "anthropic": Message;
}

export type NativeAssistantMessageForApi<TApi extends Api> = ApiNativeAssistantMessageMap[TApi]

export interface BaseAssistantMessage <TApi extends Api> {
    role: "assistant";
    message: NativeAssistantMessageForApi<TApi>
	api: string;
    id: string;
    model: Model<TApi>;
    errorMessage?: string;
    timestamp: number;
    duration: number;
	stopReason: StopReason;
	content: AssistantResponse;
	usage: Usage;
}

export interface CustomMessage {
	role: "custom";
	id: string;
	content: Record<string, any>; // Any custom data structure for application-specific metadata
	timestamp?: number
}

export type Message = UserMessage | ToolResultMessage | BaseAssistantMessage<Api> | CustomMessage


// ################################################################
//  Streaming Types
// ################################################################


export type BaseAssistantEventMessage <TApi extends Api>  = Omit <BaseAssistantMessage<TApi>, 'message'>

export type BaseAssistantEvent<TApi extends Api> = 
| { type: "start"; message: BaseAssistantEventMessage<Api> }
| { type: "text_start"; contentIndex: number; message: BaseAssistantEventMessage<Api> }
| { type: "text_delta"; contentIndex: number; delta: string; message: BaseAssistantEventMessage<Api> }
| { type: "text_end"; contentIndex: number; content: Content; message: BaseAssistantEventMessage<Api> }
| { type: "thinking_start"; contentIndex: number; message: BaseAssistantEventMessage<Api> }
| { type: "thinking_delta"; contentIndex: number; delta: string; message: BaseAssistantEventMessage<Api> }
| { type: "thinking_end"; contentIndex: number; content: string; message: BaseAssistantEventMessage<Api> }
| { type: "toolcall_start"; contentIndex: number; message: BaseAssistantEventMessage<Api> }
| { type: "toolcall_delta"; contentIndex: number; delta: string; message: BaseAssistantEventMessage<Api> }
| { type: "toolcall_end"; contentIndex: number; toolCall: AssistantToolCall; message: BaseAssistantEventMessage<Api> }
| { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: BaseAssistantEventMessage<Api> }
| { type: "error"; reason: Extract<StopReason, "aborted" | "error">; message: BaseAssistantEventMessage<Api> };


// ################################################################
//  Provider Functions Types
// ################################################################

export interface Tool<TParameters extends TSchema = TSchema, TName extends string = string> {
	name: TName;
	description: string;
	parameters: TParameters;
}

export interface Context {
	messages: Message[];
	systemPrompt?: string;
	tools?: Tool[];
}

export interface ApiOptionsMap {
	'openai': OpenAIProviderOptions
	'google': GoogleProviderOptions
	'deepseek': DeepSeekProviderOptions
	'anthropic': AnthropicProviderOptions
}

export type OptionsForApi<TApi extends Api> = ApiOptionsMap[TApi]

export type CompleteFunction<TApi extends Api> = (
	model: Model<TApi>,
	context: Context,
	optionsForApi: OptionsForApi<TApi>,
	id: string
) => Promise<BaseAssistantMessage<TApi>>

export type StreamFunction<TApi extends Api> = (
	model: Model<TApi>,
	context: Context,
	optionsForApi: OptionsForApi<TApi>,
	id: string
) => AssistantMessageEventStream<TApi>