import { CompleteFunction, Context, Model, StopReason, Usage } from "../../types.js"
import { GenerateContentResponse } from "@google/genai";
import { createClient, buildParams, getResponseAssistantResponse, getResponseUsage, getAssistantStopReason } from "./utils.js";
import { GoogleProviderOptions } from "./types.js";


export const completeGoogle:CompleteFunction<'google'> = async (
    model: Model<'google'>,
    context: Context,
    options: GoogleProviderOptions,
    id: string
) => {

    const startTimestamp = Date.now();

    const client = createClient(model, options?.apiKey);
    const params = buildParams(model, context, options);

    try{
        const response = await client.models.generateContent(params);

        // Cache processed content to ensure stable tool call IDs
        const content = getResponseAssistantResponse(response);
        const usage = getResponseUsage(response, model);
        let stopReason = getAssistantStopReason(response);

        // Check if any tool calls are present and update stopReason
        const hasToolCall = content.some(c => c.type === 'toolCall');
        if (hasToolCall && stopReason === 'stop') {
            stopReason = 'toolUse';
        }
    
        return {
            role: "assistant",
            message: response,
            id,
            model,
            api: model.api,
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
            message: {} as GenerateContentResponse, // Empty response object for error case
            id,
            model,
            api: model.api,
            errorMessage,
            timestamp: Date.now(),
            duration: Date.now() - startTimestamp,
            stopReason,
            content: [],
            usage: emptyUsage
        };
    }

}