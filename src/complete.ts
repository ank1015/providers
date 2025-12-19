import { completeGoogle, GoogleProviderOptions } from "./providers/google";
import { completeOpenAI, OpenAIProviderOptions } from "./providers/openai";
import { Model, Api, Context, OptionsForApi, BaseAssistantMessage } from "./types.js";
import { generateUUID } from "./utils/uuid.js";

const envMap: Record<Api, string> = {
	openai: "OPENAI_API_KEY",
	google: "GEMINI_API_KEY",
};


export function getApiKeyFromEnv(api: Api){
    const envVar = envMap[api]
    return process.env[envVar]
}


export async function complete<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: OptionsForApi<TApi>,
    id?: string
): Promise<BaseAssistantMessage<TApi>> {

    // Type-safe apiKey extraction - works because all provider options have apiKey
    const apiKey = (options as any)?.apiKey ?? getApiKeyFromEnv(model.api);
    if (!apiKey) {
		throw new Error(`No API key for provider: ${model.api}`);
    }

	// Ensure providerOptions has required apiKey
	const providerOptions = { ...options, apiKey } as OptionsForApi<TApi>;
    const messageId = id ?? generateUUID();

    switch (model.api) {
        case 'openai':
            return completeOpenAI(
                model as Model<'openai'>,
                context,
                providerOptions as OpenAIProviderOptions,
                messageId
            ) as Promise<BaseAssistantMessage<TApi>>;
        case 'google':
            return completeGoogle(
                model as Model<'google'>,
                context,
                providerOptions as GoogleProviderOptions,
                messageId
            ) as Promise<BaseAssistantMessage<TApi>>;
        default: {
            const _exhaustive: never = model.api;
            throw new Error(`Unhandled API: ${_exhaustive}`);
        }
    }

}