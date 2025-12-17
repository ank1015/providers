import type { Model, Context, Api, OptionsForApi, NativeAssistantMessage } from "./types";
import { AssistantMessageEventStream } from "./utils/event-stream";
import { streamOpenAI, OpenAIProviderOptions } from "./providers/openai";
import { streamGoogle, GoogleProviderOptions } from "./providers/google";

const envMap: Record<Api, string> = {
	openai: "OPENAI_API_KEY",
	// anthropic: "ANTHROPIC_API_KEY",
	google: "GEMINI_API_KEY",
	// groq: "GROQ_API_KEY",
	// cerebras: "CEREBRAS_API_KEY",
	// xai: "XAI_API_KEY",
	// openrouter: "OPENROUTER_API_KEY",
	// zai: "ZAI_API_KEY",
};


export function getApiKeyFromEnv(api: Api){
    const envVar = envMap[api]
    return process.env[envVar]
}

export function stream<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: OptionsForApi<TApi>,
): AssistantMessageEventStream {

    const apiKey = options?.apiKey !== undefined ? options.apiKey : getApiKeyFromEnv(model.api)
    if(!apiKey){
		throw new Error(`No API key for provider: ${model.api}`);
    }

	const providerOptions = { ...options, apiKey };

	// Switch directly on model.api and use type assertions for each provider
	switch (model.api) {
        case 'openai':
            // TypeScript knows this branch only runs when model.api === 'openai'
            return streamOpenAI(
				model as Model<'openai'>,
				context,
				providerOptions as OpenAIProviderOptions
			);

		case 'google':
            // TypeScript knows this branch only runs when model.api === 'google'
			return streamGoogle(
				model as Model<'google'>,
				context,
				providerOptions as GoogleProviderOptions
			);

        default: {
			const _exhaustive: never = model.api;
			throw new Error(`Unhandled API: ${_exhaustive}`);
        }
    }

}

export async function complete<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: OptionsForApi<TApi>,
): Promise<NativeAssistantMessage> {
	const assistantStream = stream(model, context, options);
	const result = await assistantStream.result()
	return result;
}