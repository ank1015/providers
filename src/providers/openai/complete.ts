import {  CompleteFunction,  Context, Model, StopReason, Usage } from "../../types.js"
import type {Response} from "openai/resources/responses/responses.js";
import { OpenAIProviderOptions } from "./types.js";
import { createClient, buildParams, getResponseAssistantResponse, getResponseUsage, mapStopReason } from "./utils.js";


export const completeOpenAI:CompleteFunction<'openai'> = async (
    model: Model<'openai'>,
    context: Context,
    options: OpenAIProviderOptions,
    id: string
) => {
    const startTimestamp = Date.now();
    const client = createClient(model, options?.apiKey);
    const params = buildParams(model, context, options);

    try{
        const response: Response = await client.responses.create(params, {signal: options?.signal});

    
        // Cache processed content for performance and consistency
        const content = getResponseAssistantResponse(response);
        const usage = getResponseUsage(response, model);
        let stopReason = mapStopReason(response?.status);

        const toolCallIndex = content.findIndex(c => c.type === 'toolCall');
        if(toolCallIndex && toolCallIndex !== -1 && stopReason === 'stop'){
            stopReason = 'toolUse';
        }
        
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
    } catch (error){
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
            message: {} as Response, // Empty response object for error case
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
}