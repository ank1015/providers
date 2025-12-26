import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
}

export type DeepSeekProviderOptions = Omit<ChatCompletionCreateParamsBase, 'model' | 'messages'> & Props
