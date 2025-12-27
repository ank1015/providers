import { CompleteFunction, Context, Model, StopReason, Usage } from "../../types.js";
import type { Message } from "@anthropic-ai/sdk/resources/messages.js";
import { AnthropicProviderOptions } from "./types.js";
import { createClient, buildParams, getResponseAssistantResponse, getResponseUsage, mapStopReason, getMockAnthropicMessage } from "./utils.js";

export const completeAnthropic: CompleteFunction<'anthropic'> = async (
	model: Model<'anthropic'>,
	context: Context,
	options: AnthropicProviderOptions,
	id: string
) => {

    const startTimestamp = Date.now();
    const { client, isOAuthToken } = createClient(model, options?.apiKey, true);
    const params = buildParams(model, context, options, isOAuthToken);

    try{

        const response: Message = await client.messages.create(params, { signal: options?.signal }) as Message

        // Cache processed content for performance and consistency
        const content = getResponseAssistantResponse(response);
        const usage = getResponseUsage(response, model);
        let stopReason = mapStopReason(response.stop_reason!);

        return {
            role: "assistant",
            message: response,
            id,
            api: model.api,
            model,
            timestamp: Date.now(),
            duration: Date.now() - startTimestamp,
            stopReason,
            content,
            usage
        }

    }catch (error){
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isAborted = options.signal?.aborted
        const stopReason: StopReason = isAborted ? "aborted" : "error"

        // Return error response with empty content and zero usage
        const emptyUsage: Usage = {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        };

        return {
            role: "assistant",
            message: {} as Message, // Empty response object for error case
            id,
            api: model.api,
            model,
            errorMessage,
            timestamp: Date.now(),
            duration: Date.now() - startTimestamp,
            stopReason,
            content: [],
            usage: emptyUsage
        };
    }
};
