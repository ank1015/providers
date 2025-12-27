import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages.js"

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
}

export type AnthropicProviderOptions = Omit<MessageCreateParamsNonStreaming, 'model' | 'messages'> & Props
