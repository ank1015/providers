import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"

export interface ZaiThinkingConfig {
	type: "enabled" | "disabled";
	clear_thinking?: boolean;
}

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
	thinking?: ZaiThinkingConfig;
}

export type ZaiProviderOptions = Omit<ChatCompletionCreateParamsBase, 'model' | 'messages'> & Props
