import { Response } from "openai/resources/responses/responses.js";
import type { GenerateContentResponse } from "@google/genai";
import type { TSchema } from "@sinclair/typebox";
import { OpenAIProviderOptions } from "./providers/openai";
import { GoogleProviderOptions } from "./providers/google";

export const KnownApis = ['openai', 'google'] as const;                                                                                                         
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
}

export type NativeAssistantMessageForApi<TApi extends Api> = ApiNativeAssistantMessageMap[TApi]

export interface BaseAssistantMessage <TApi extends Api> {
    role: "assistant";
    message: NativeAssistantMessageForApi<TApi>
    id: string;
    model: Model<TApi>;
    errorMessage?: string;
    timestamp: number;
    duration: number;
    getStopReason: () => StopReason;
    getContent: () => AssistantResponse;
    getUsage: () => Usage;
}

export type Message = UserMessage | ToolResultMessage | BaseAssistantMessage<Api>


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
}

export type OptionsForApi<TApi extends Api> = ApiOptionsMap[TApi]

export type CompleteFunction<TApi extends Api> = (
	model: Model<TApi>,
	context: Context,
	optionsForApi: OptionsForApi<TApi>
) => Promise<BaseAssistantMessage<TApi>>