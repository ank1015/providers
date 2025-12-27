import { StreamFunction, Model, Context } from "../../types.js"
import { AssistantMessageEventStream } from "../../utils/event-stream.js";
import { AnthropicProviderOptions } from "./types.js"



export const streamAnthropic: StreamFunction<'anthropic'> = (
	model: Model<'anthropic'>,
	context: Context,
	options: AnthropicProviderOptions,
	id: string
) => {

	const stream = new AssistantMessageEventStream<'anthropic'>();

    return stream;
}