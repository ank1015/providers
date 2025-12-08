// Return a abstracted event stream
// Return the final response as it is.
import OpenAI from "openai";
import { AssistantMessageEventStream } from "../utils/event-stream";


export interface OpenAIProviderOptions {
    apiKey?: string;
}

// takes in model, built in message
export const streamOpenAI = (
    options: OpenAIProviderOptions
) => {

    const stream = new AssistantMessageEventStream();

	// Start async processing
	(async () => {
        
    })()

    return stream;
}