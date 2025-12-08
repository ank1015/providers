import type { Model, Context, Api, OptionsForApi } from "./types";
import { AssistantMessageEventStream } from "./utils/event-stream";
import { streamOpenAI } from "./providers/openai";

const envMap: Record<Api, string> = {
	openai: "OPENAI_API_KEY",
	// anthropic: "ANTHROPIC_API_KEY",
	// google: "GEMINI_API_KEY",
	// groq: "GROQ_API_KEY",
	// cerebras: "CEREBRAS_API_KEY",
	// xai: "XAI_API_KEY",
	// openrouter: "OPENROUTER_API_KEY",
	// zai: "ZAI_API_KEY",
};


function getApiKeyFromEnv(api: Api){
    const envVar = envMap[api]
    return process.env[envVar]
}

export function stream<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: OptionsForApi<TApi>,
): AssistantMessageEventStream {

    const apiKey = options?.apiKey || getApiKeyFromEnv(model.api)
    if(!apiKey){
		throw new Error(`No API key for provider: ${model.api}`);
    }

	const providerOptions = { ...options, apiKey };

	const api: Api = model.api;
	switch (api) {
        case 'openai':
            streamOpenAI(model, context, providerOptions)

        default: {
			const _exhaustive = api;
			throw new Error(`Unhandled API: ${_exhaustive}`);
        }
    }

}