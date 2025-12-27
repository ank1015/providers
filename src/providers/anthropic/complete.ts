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

	return {
        role: 'assistant',
        message: getMockAnthropicMessage(),
        api: model.api,
        id: id,
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
};
