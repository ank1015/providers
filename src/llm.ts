import { completeGoogle, GoogleProviderOptions, streamGoogle } from "./providers/google/index.js";
import { getMockGoogleMessage } from "./providers/google/utils.js";
import { completeOpenAI, OpenAIProviderOptions, streamOpenAI } from "./providers/openai/index.js";
import { getMockOpenaiMessage } from "./providers/openai/utils.js";
import { completeDeepSeek, DeepSeekProviderOptions, streamDeepSeek } from "./providers/deepseek/index.js";
import { getMockDeepSeekMessage } from "./providers/deepseek/utils.js";
import { Model, Api, Context, OptionsForApi, BaseAssistantMessage } from "./types.js";
import { AssistantMessageEventStream } from "./utils/event-stream.js";
import { generateUUID } from "./utils/uuid.js";
import { completeAnthropic, AnthropicProviderOptions, streamAnthropic } from "./providers/anthropic/index.js";
import { getMockAnthropicMessage } from "./providers/anthropic/utils.js";

const envMap: Record<Api, string> = {
    openai: "OPENAI_API_KEY",
    google: "GEMINI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    anthropic: "ANTHROPIC_API_KEY"
};


export function getApiKeyFromEnv(api: Api) {
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
        case 'deepseek':
            return completeDeepSeek(
                model as Model<'deepseek'>,
                context,
                providerOptions as DeepSeekProviderOptions,
                messageId
            ) as Promise<BaseAssistantMessage<TApi>>;
        case 'anthropic':
            return completeAnthropic(
                model as Model<'anthropic'>,
                context,
                providerOptions as AnthropicProviderOptions,
                messageId
            ) as Promise<BaseAssistantMessage<TApi>>
        default: {
            const _exhaustive: never = model.api;
            throw new Error(`Unhandled API: ${_exhaustive}`);
        }
    }
}

export function stream<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: OptionsForApi<TApi>,
    id?: string
): AssistantMessageEventStream<TApi> {

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
            return streamOpenAI(
                model as Model<'openai'>,
                context,
                providerOptions as OpenAIProviderOptions,
                messageId
            ) as unknown as AssistantMessageEventStream<TApi>;
        case 'google':
            return streamGoogle(
                model as Model<'google'>,
                context,
                providerOptions as GoogleProviderOptions,
                messageId
            ) as unknown as AssistantMessageEventStream<TApi>;
        case 'deepseek':
            return streamDeepSeek(
                model as Model<'deepseek'>,
                context,
                providerOptions as DeepSeekProviderOptions,
                messageId
            ) as unknown as AssistantMessageEventStream<TApi>;
        case 'anthropic':
            return streamAnthropic(
                model as Model<'anthropic'>,
                context,
                providerOptions as AnthropicProviderOptions,
                messageId
            ) as unknown as AssistantMessageEventStream<TApi>;
        default: {
            const _exhaustive: never = model.api;
            throw new Error(`Unhandled API: ${_exhaustive}`);
        }
    }
}

export function getMockMessage(model: Model<Api>): BaseAssistantMessage<Api> {
    const messageId = generateUUID();
    let message;
    if (model.api === 'openai') {
        message = getMockOpenaiMessage()
    } else if (model.api === 'google') {
        message = getMockGoogleMessage()
    } else if (model.api === 'deepseek') {
        message = getMockDeepSeekMessage()
    } else if (model.api === 'anthropic'){
        message = getMockAnthropicMessage();
    }
    const baseMessage: BaseAssistantMessage<Api> = {
        role: 'assistant',
        message: message!,
        api: model.api,
        id: messageId,
        model: model,
        timestamp: Date.now(),
        duration: 0,
        stopReason: 'stop',
        content: [],
        usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        }
    }
    return baseMessage
}

export interface LLMClient {
    complete<TApi extends Api>(
        model: Model<TApi>,
        context: Context,
        options?: OptionsForApi<TApi>,
        id?: string
    ): Promise<BaseAssistantMessage<TApi>>;

    stream<TApi extends Api>(
        model: Model<TApi>,
        context: Context,
        options?: OptionsForApi<TApi>,
        id?: string
    ): AssistantMessageEventStream<TApi>;
}

export class DefaultLLMClient implements LLMClient {
    async complete<TApi extends Api>(
        model: Model<TApi>,
        context: Context,
        options?: OptionsForApi<TApi>,
        id?: string
    ): Promise<BaseAssistantMessage<TApi>> {
        return complete(model, context, options, id);
    }

    stream<TApi extends Api>(
        model: Model<TApi>,
        context: Context,
        options?: OptionsForApi<TApi>,
        id?: string
    ): AssistantMessageEventStream<TApi> {
        return stream(model, context, options, id);
    }
}