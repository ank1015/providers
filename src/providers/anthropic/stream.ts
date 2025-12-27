import { Message as AnthropicMessage, ContentBlock, TextBlock, ThinkingBlock } from "@anthropic-ai/sdk/resources.js";
import { StreamFunction, Model, Context, BaseAssistantEventMessage, TextContent, AssistantThinkingContent, AssistantToolCall, AssistantResponseContent, BaseAssistantMessage } from "../../types.js"
import { AssistantMessageEventStream } from "../../utils/event-stream.js";
import { AnthropicProviderOptions } from "./types.js"
import { buildParams, createClient, mapStopReason } from "./utils.js";
import { MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources";
import { calculateCost } from "../../models.js";
import { parseStreamingJson } from "../../utils/json-parse.js";



export const streamAnthropic: StreamFunction<'anthropic'> = (
	model: Model<'anthropic'>,
	context: Context,
	options: AnthropicProviderOptions,
	id: string
) => {

	const stream = new AssistantMessageEventStream<'anthropic'>();

	(async () => {

		const startTimestamp = Date.now();
		const output: BaseAssistantEventMessage<'anthropic'> = {
			role: "assistant",
			api: model.api,
			model: model,
			id,
			content: [],
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: startTimestamp,
			duration: 0
		};

		let finalResponse: AnthropicMessage = {
			id: "msg_01XFDUDYJgAACzvnptvVoYEL",
			type: "message",
			role: "assistant",
			content: [],
			model: "claude-sonnet-4-5",
			stop_reason: "end_turn",
			stop_sequence: null,
			usage: {
				input_tokens: 0,
				output_tokens: 0,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
				cache_creation: null,
				server_tool_use: null,
				service_tier: null
			}
		}

		type Block = (AssistantThinkingContent | AssistantResponseContent | (AssistantToolCall & { partialJson: string })) & { index: number };
		const blocks = output.content as Block[];
		const accumulatedContent = [] as (ContentBlock & { index?: number } & { partialJson?: string })[];

		try{

			const { client, isOAuthToken } = createClient(model, options?.apiKey, true);
			const params = buildParams(model, context, options, isOAuthToken);
			const paramsStreaming: MessageCreateParamsStreaming = {...params, stream: true}

			const anthropicStream = client.messages.stream(paramsStreaming, { signal: options?.signal });
			stream.push({ type: "start", message: { ...output, timestamp: Date.now() } });

			for await (const event of anthropicStream) {

				if (event.type === "message_start") {
					// Capture message metadata from message_start event
					finalResponse.id = event.message.id;
					finalResponse.model = event.message.model;
					finalResponse.role = event.message.role;
					finalResponse.type = event.message.type;
					finalResponse.stop_sequence = event.message.stop_sequence;
					// Capture initial token usage from message_start event
					// This ensures we have input token counts even if the stream is aborted early
					output.usage.input = event.message.usage.input_tokens || 0;
					output.usage.output = event.message.usage.output_tokens || 0;
					output.usage.cacheRead = event.message.usage.cache_read_input_tokens || 0;
					output.usage.cacheWrite = event.message.usage.cache_creation_input_tokens || 0;
					// Anthropic doesn't provide total_tokens, compute from components
					output.usage.totalTokens =
						output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
					calculateCost(model, output.usage);
				} else if (event.type === "content_block_start") {
					accumulatedContent.push({index: event.index, ...event.content_block})
					if (event.content_block.type === "text") {
						const block: Block = {
							type: "response",
							content: [{type: 'text', content: ""}],
							index: event.index,
						};
						output.content.push(block);
						stream.push({ type: "text_start", contentIndex: output.content.length - 1, message: output });
					} else if (event.content_block.type === "thinking") {
						const block: Block = {
							type: "thinking",
							thinkingText: "",
							index: event.index,
						};
						output.content.push(block);
						stream.push({ type: "thinking_start", contentIndex: output.content.length - 1, message: output });
					} else if (event.content_block.type === "tool_use") {
						const block: Block = {
							type: "toolCall",
							toolCallId: event.content_block.id,
							name: event.content_block.name,
							arguments: event.content_block.input as Record<string, any>,
							partialJson: "",
							index: event.index,
						};
						output.content.push(block);
						stream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, message: output });
					}
				} else if (event.type === "content_block_delta") {
					const accumBlockIndex = accumulatedContent.findIndex(a => a.index === event.index);
					if (event.delta.type === "text_delta") {
						const index = blocks.findIndex((b) => b.index === event.index);
						const block = blocks[index];
						if (block && block.type === "response") {
							const textContentIndex = block.content.findIndex((b) => b.type === 'text');
							(block.content[textContentIndex] as TextContent).content += event.delta.text;
							stream.push({
								type: "text_delta",
								contentIndex: index,
								delta: event.delta.text,
								message: output,
							});
						}
						if(accumBlockIndex !== -1){
							(accumulatedContent[accumBlockIndex] as TextBlock).text += event.delta.text;
						}
					} else if (event.delta.type === "thinking_delta") {
						const index = blocks.findIndex((b) => b.index === event.index);
						const block = blocks[index];
						if (block && block.type === "thinking") {
							block.thinkingText += event.delta.thinking;
							stream.push({
								type: "thinking_delta",
								contentIndex: index,
								delta: event.delta.thinking,
								message: output,
							});
						}
						if(accumBlockIndex !== -1){
							(accumulatedContent[accumBlockIndex] as ThinkingBlock).thinking += event.delta.thinking
						}
					} else if (event.delta.type === "input_json_delta") {
						const index = blocks.findIndex((b) => b.index === event.index);
						const block = blocks[index];
						if (block && block.type === "toolCall") {
							block.partialJson += event.delta.partial_json;
							block.arguments = parseStreamingJson(block.partialJson);
							stream.push({
								type: "toolcall_delta",
								contentIndex: index,
								delta: event.delta.partial_json,
								message: output,
							});
						}
						if(accumBlockIndex !== -1){
							(accumulatedContent[accumBlockIndex]).partialJson += event.delta.partial_json
						}
					}
					else if (event.delta.type === "signature_delta") {
						if(accumBlockIndex !== -1){
							(accumulatedContent[accumBlockIndex] as ThinkingBlock).signature += event.delta.signature;
						}
					}
				} else if (event.type === "content_block_stop") {
					const index = blocks.findIndex((b) => b.index === event.index);
					const block = blocks[index];
					const accumBlockIndex = accumulatedContent.findIndex(a => a.index === event.index);
					if(accumBlockIndex !== -1){
						if(accumulatedContent[accumBlockIndex].type === 'tool_use'){
							const partialJson = accumulatedContent[accumBlockIndex].partialJson;
							(accumulatedContent[accumBlockIndex] as any).input = parseStreamingJson(partialJson);
						}
						// Always delete index and partialJson - don't use truthy check as index can be 0
						if(accumulatedContent[accumBlockIndex].index !== undefined) delete accumulatedContent[accumBlockIndex].index
						if(accumulatedContent[accumBlockIndex].partialJson !== undefined) delete accumulatedContent[accumBlockIndex].partialJson
					}
					if (block) {
						delete (block as any).index;
						if (block.type === "response") {
							stream.push({
								type: "text_end",
								contentIndex: index,
								content: block.content,
								message: output,
							});
						} else if (block.type === "thinking") {
							stream.push({
								type: "thinking_end",
								contentIndex: index,
								content: block.thinkingText,
								message: output,
							});
						} else if (block.type === "toolCall") {
							block.arguments = parseStreamingJson(block.partialJson);
							delete (block as any).partialJson;
							stream.push({
								type: "toolcall_end",
								contentIndex: index,
								toolCall: block,
								message: output,
							});
						}
					}
				} else if (event.type === "message_delta") {
					if (event.delta.stop_reason) {
						output.stopReason = mapStopReason(event.delta.stop_reason);
						finalResponse.stop_reason = event.delta.stop_reason
					}
					finalResponse.usage = event.usage as any
					// message_delta only provides output_tokens, preserve input tokens from message_start
					output.usage.output = event.usage.output_tokens || 0;
					// Anthropic doesn't provide total_tokens, compute from components
					output.usage.totalTokens =
						output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
					calculateCost(model, output.usage);
				}

			}

			if (options?.signal?.aborted) {
				throw new Error("Request was aborted");
			}

			if (output.stopReason === "aborted" || output.stopReason === "error") {
				throw new Error(
					`Stream ended with status: ${output.stopReason}${output.errorMessage ? ` - ${output.errorMessage}` : ""}`
				);
			}

			// Populate finalResponse.content with accumulated content blocks
			finalResponse.content = accumulatedContent as ContentBlock[];

			stream.push({ type: "done", reason: output.stopReason, message: { ...output, timestamp: Date.now() } });
			const baseAssistantMessage: BaseAssistantMessage<'anthropic'> = {
				...output,
				message: finalResponse,
				timestamp: Date.now(),
				duration: Date.now() - startTimestamp
			}
			stream.end(baseAssistantMessage);


		}catch(error){
			for (const block of output.content) delete (block as any).index;
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.push({ type: "error", reason: output.stopReason, message: { ...output, timestamp: Date.now() } });

			// Populate finalResponse.content with accumulated content blocks even on error
			finalResponse.content = accumulatedContent as ContentBlock[];

			const baseAssistantMessage: BaseAssistantMessage<'anthropic'> = {
				...output,
				message: finalResponse,
				timestamp: Date.now(),
				duration: Date.now() - startTimestamp
			}
			stream.end(baseAssistantMessage);
		}

	})();

    return stream;
}
