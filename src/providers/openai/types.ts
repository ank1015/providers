import { ResponseCreateParamsBase } from "openai/resources/responses/responses.js"

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
}

export type OpenAIProviderOptions = Omit<ResponseCreateParamsBase, 'model' | 'input'> & Props