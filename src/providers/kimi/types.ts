import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"

export interface KimiThinkingConfig {
	type: "enabled" | "disabled";
}

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
	thinking?: KimiThinkingConfig;
}

export type KimiProviderOptions = Omit<ChatCompletionCreateParamsBase, 'model' | 'messages'> & Props
