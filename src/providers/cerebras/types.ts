import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"

export type CerebrasReasoningFormat = "parsed" | "raw" | "hidden" | "none";
export type CerebrasReasoningEffort = "low" | "medium" | "high";

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
	// Reasoning format control - determines how reasoning appears in responses
	reasoning_format?: CerebrasReasoningFormat;
	// GPT-OSS specific: controls reasoning effort level
	reasoning_effort?: CerebrasReasoningEffort;
	// GLM specific: disable reasoning entirely
	disable_reasoning?: boolean;
	// GLM specific: whether to clear thinking content from previous turns
	clear_thinking?: boolean;
}

export type CerebrasProviderOptions = Omit<ChatCompletionCreateParamsBase, 'model' | 'messages'> & Props
