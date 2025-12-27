import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages.js"

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
	max_tokens?: number
}

export type AnthropicProviderOptions = Omit<MessageCreateParamsNonStreaming, 'model' | 'messages' | 'system' | 'max_tokens'> & Props
