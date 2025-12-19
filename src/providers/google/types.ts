import { GenerateContentConfig } from "@google/genai"

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
}

export type GoogleProviderOptions = Omit<GenerateContentConfig, 'abortSignal' | 'systemPrompt'> & Props