// Return a abstracted event stream
// Return the final response as it is.
import OpenAI from "openai";
import { AssistantMessageEventStream } from "../utils/event-stream";
import { StreamFunction, Model, Context } from "../types";

export interface OpenAIProviderOptions {
    apiKey?: string;
}

// takes in model, built in message
export const streamOpenAI: StreamFunction<'openai'> = (
    model: Model<'openai'>,
    context: Context,
    options: OpenAIProviderOptions
) => {

    const stream = new AssistantMessageEventStream();
    const client = createClient(model, options?.apiKey);

	// Start async processing
	(async () => {
        
    })()

    return stream;
}


function createClient(model: Model<"openai">, apiKey?: string) {
	if (!apiKey) {
		if (!process.env.OPENAI_API_KEY) {
			throw new Error(
				"OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.OPENAI_API_KEY;
	}
	return new OpenAI({
		apiKey,
		baseURL: model.baseUrl,
		dangerouslyAllowBrowser: true,
		defaultHeaders: model.headers,
	});
}

