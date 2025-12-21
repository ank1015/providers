import { AssistantResponseContent, AssistantThinkingContent, AssistantToolCall, BaseAssistantEventMessage, BaseAssistantMessage, Context, Model, StreamFunction, TextContent } from "../../types.js"
import type { Response, ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";
import { OpenAIProviderOptions } from "./types.js";
import { createClient, buildParams, mapStopReason } from "./utils.js";
import { AssistantMessageEventStream } from "../../utils/event-stream.js";
import type { ResponseFunctionToolCall, ResponseOutputMessage, ResponseReasoningItem, } from "openai/resources/responses/responses.js";
import { parseStreamingJson } from "../../utils/json-parse.js";
import { validateToolArguments } from "../../utils/validation.js";
import { calculateCost } from "../../models.js";


export const streamOpenAI: StreamFunction<'openai'> = (
	model: Model<'openai'>,
	context: Context,
	options: OpenAIProviderOptions,
	id: string
) => {

	const stream = new AssistantMessageEventStream<'openai'>();

	(async () => {

		const startTimestamp = Date.now();
		const output: BaseAssistantEventMessage<'openai'> = {
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
		let finalResponse: Response = {
			id: "resp_123",
			object: "response",
			created_at: 1740855869,
			output_text: '',
			status: "completed",
			incomplete_details: null,
			parallel_tool_calls: false,
			error: null,
			instructions: null,
			max_output_tokens: null,
			model: "gpt-4o-mini-2024-07-18",
			output: [],
			previous_response_id: null,
			temperature: 1,
			text: {},
			tool_choice: "auto",
			tools: [],
			top_p: 1,
			truncation: "disabled",
			usage: {
				input_tokens: 0,
				output_tokens: 0,
				output_tokens_details: {
					reasoning_tokens: 0
				},
				input_tokens_details: {
					cached_tokens: 0
				},
				total_tokens: 0
			},
			user: undefined,
			metadata: {}
		}

		try {

			const client = createClient(model, options?.apiKey);
			const params = buildParams(model, context, options);

			const paramsStreaming: ResponseCreateParamsStreaming = {
				...params,
				stream: true
			}

			const openaiStream = await client.responses.create(paramsStreaming, { signal: options?.signal });

			stream.push({ type: "start", message: { ...output, timestamp: Date.now() } });

			let currentItem: ResponseReasoningItem | ResponseOutputMessage | ResponseFunctionToolCall | null = null;
			let currentBlock: AssistantThinkingContent | AssistantResponseContent | (AssistantToolCall & { partialJson: string }) | null = null;
			const blocks = output.content;
			const blockIndex = () => blocks.length - 1;

			for await (const event of openaiStream) {

				// Handle output item start
				if (event.type === "response.output_item.added") {
					const item = event.item;
					if (item.type === "reasoning") {
						currentItem = item;
						currentBlock = { type: "thinking", thinkingText: "" };
						output.content.push(currentBlock);
						stream.push({ type: "thinking_start", contentIndex: blockIndex(), message: { ...output, timestamp: Date.now() } });
					} else if (item.type === "message") {
						currentItem = item;
						currentBlock = { type: "response", content: [{ type: 'text', content: "" }] };
						output.content.push(currentBlock);
						stream.push({ type: "text_start", contentIndex: blockIndex(), message: { ...output, timestamp: Date.now() } });
					} else if (item.type === "function_call") {
						currentItem = item;
						currentBlock = {
							type: "toolCall",
							toolCallId: item.call_id,
							name: item.name,
							arguments: {},
							partialJson: item.arguments || "",
						};
						output.content.push(currentBlock);
						stream.push({ type: "toolcall_start", contentIndex: blockIndex(), message: { ...output, timestamp: Date.now() } });
					}
				}
				// Handle reasoning summary deltas
				else if (event.type === "response.reasoning_summary_part.added") {
					if (currentItem && currentItem.type === "reasoning") {
						currentItem.summary = currentItem.summary || [];
						currentItem.summary.push(event.part);
					}
				} else if (event.type === "response.reasoning_summary_text.delta") {
					if (
						currentItem &&
						currentItem.type === "reasoning" &&
						currentBlock &&
						currentBlock.type === "thinking"
					) {
						currentItem.summary = currentItem.summary || [];
						const lastPart = currentItem.summary[currentItem.summary.length - 1];
						if (lastPart) {
							currentBlock.thinkingText += event.delta;
							lastPart.text += event.delta;
							stream.push({
								type: "thinking_delta",
								contentIndex: blockIndex(),
								delta: event.delta,
								message: { ...output, timestamp: Date.now() },
							});
						}
					}
				}
				// Add a new line between summary parts (hack...)
				else if (event.type === "response.reasoning_summary_part.done") {
					if (
						currentItem &&
						currentItem.type === "reasoning" &&
						currentBlock &&
						currentBlock.type === "thinking"
					) {
						currentItem.summary = currentItem.summary || [];
						const lastPart = currentItem.summary[currentItem.summary.length - 1];
						if (lastPart) {
							currentBlock.thinkingText += "\n\n";
							lastPart.text += "\n\n";
							stream.push({
								type: "thinking_delta",
								contentIndex: blockIndex(),
								delta: "\n\n",
								message: { ...output, timestamp: Date.now() },
							});
						}
					}
				}
				// Handle text output deltas
				else if (event.type === "response.content_part.added") {
					if (currentItem && currentItem.type === "message") {
						currentItem.content = currentItem.content || [];
						currentItem.content.push(event.part as any);
					}
				} else if (event.type === "response.output_text.delta") {
					if (currentItem && currentItem.type === "message" && currentBlock && currentBlock.type === "response") {
						const lastPart = currentItem.content[currentItem.content.length - 1];
						if (lastPart && lastPart.type === "output_text") {
							const index = currentBlock.content.findIndex((c) => c.type === 'text');
							if (index !== -1) {
								(currentBlock.content[index] as TextContent).content += event.delta;
							}
							lastPart.text += event.delta;
							stream.push({
								type: "text_delta",
								contentIndex: blockIndex(),
								delta: event.delta,
								message: { ...output, timestamp: Date.now() },
							});
						}
					}
				} else if (event.type === "response.refusal.delta") {
					if (currentItem && currentItem.type === "message" && currentBlock && currentBlock.type === "response") {
						const lastPart = currentItem.content[currentItem.content.length - 1];
						if (lastPart && lastPart.type === "refusal") {
							const index = currentBlock.content.findIndex((c) => c.type === 'text');
							if (index !== -1) {
								(currentBlock.content[index] as TextContent).content += event.delta;
							}
							lastPart.refusal += event.delta;
							stream.push({
								type: "text_delta",
								contentIndex: blockIndex(),
								delta: event.delta,
								message: { ...output, timestamp: Date.now() },
							});
						}
					}
				}
				// Handle function call argument deltas
				else if (event.type === "response.function_call_arguments.delta") {
					if (
						currentItem &&
						currentItem.type === "function_call" &&
						currentBlock &&
						currentBlock.type === "toolCall"
					) {
						currentBlock.partialJson += event.delta;
						currentBlock.arguments = parseStreamingJson(currentBlock.partialJson);
						stream.push({
							type: "toolcall_delta",
							contentIndex: blockIndex(),
							delta: event.delta,
							message: { ...output, timestamp: Date.now() },
						});
					}
				}
				// Handle output item completion
				else if (event.type === "response.output_item.done") {
					const item = event.item;

					if (item.type === "reasoning" && currentBlock && currentBlock.type === "thinking") {
						currentBlock.thinkingText = item.summary?.map((s) => s.text).join("\n\n") || "";
						stream.push({
							type: "thinking_end",
							contentIndex: blockIndex(),
							content: currentBlock.thinkingText,
							message: { ...output, timestamp: Date.now() },
						});
						currentBlock = null;
					} else if (item.type === "message" && currentBlock && currentBlock.type === "response") {
						const index = currentBlock.content.findIndex(c => c.type === 'text');
						if (index !== -1) {
							(currentBlock.content[index] as TextContent).content = item.content.map((c) => (c.type === "output_text" ? c.text : c.refusal)).join("");
						}
						stream.push({
							type: "text_end",
							contentIndex: blockIndex(),
							content: currentBlock.content,
							message: { ...output, timestamp: Date.now() },
						});
						currentBlock = null;
					} else if (item.type === "function_call") {
						const toolCall: AssistantToolCall = {
							type: "toolCall",
							toolCallId: item.call_id,
							name: item.name,
							arguments: JSON.parse(item.arguments),
						};

						// Validate tool arguments if tool definition is available
						if (context.tools) {
							const tool = context.tools.find((t) => t.name === toolCall.name);
							if (tool) {
								toolCall.arguments = validateToolArguments(tool, toolCall) as Record<string, any>;
							}
						}

						stream.push({ type: "toolcall_end", contentIndex: blockIndex(), toolCall, message: { ...output, timestamp: Date.now() } });
					}
				}
				// Handle completion
				else if (event.type === "response.completed") {
					const response = event.response;
					// Update the final Response
					finalResponse = response
					if (response?.usage) {
						const cachedTokens = response.usage.input_tokens_details?.cached_tokens || 0;
						output.usage = {
							// OpenAI includes cached tokens in input_tokens, so subtract to get non-cached input
							input: (response.usage.input_tokens || 0) - cachedTokens,
							output: response.usage.output_tokens || 0,
							cacheRead: cachedTokens,
							cacheWrite: 0,
							totalTokens: response.usage.total_tokens || 0,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						};
					}
					calculateCost(model, output.usage);
					// Map status to stop reason
					output.stopReason = mapStopReason(response?.status);
					if (output.content.some((b) => b.type === "toolCall") && output.stopReason === "stop") {
						output.stopReason = "toolUse";
					}
				}
				// Handle errors
				else if (event.type === "error") {
					throw new Error(`OpenAI API Error (${event.code}): ${event.message}` || "Unknown OpenAI error");
				} else if (event.type === "response.failed") {
					throw new Error("OpenAI response failed without error details");
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

			stream.push({ type: "done", reason: output.stopReason, message: { ...output, timestamp: Date.now() } });

			const baseAssistantMessage: BaseAssistantMessage<'openai'> = {
				...output,
				message: finalResponse,
				timestamp: Date.now(),
				duration: Date.now() - startTimestamp
			}
			stream.end(baseAssistantMessage);

		} catch (error) {

			for (const block of output.content) delete (block as any).index;
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.push({ type: "error", reason: output.stopReason, message: { ...output, timestamp: Date.now() } });

			// Update finalResponse to reflect the error state
			finalResponse.status = options?.signal?.aborted ? "cancelled" : "failed";

			const baseAssistantMessage: BaseAssistantMessage<'openai'> = {
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