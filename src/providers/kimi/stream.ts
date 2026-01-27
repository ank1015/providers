import { AssistantResponseContent, AssistantThinkingContent, AssistantToolCall, BaseAssistantEventMessage, BaseAssistantMessage, Context, Model, StreamFunction, TextContent } from "../../types.js"
import type { ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions.js";
import { KimiProviderOptions } from "./types.js";
import { createClient, buildParams, mapStopReason, getMockKimiMessage } from "./utils.js";
import { AssistantMessageEventStream } from "../../utils/event-stream.js";
import { parseStreamingJson } from "../../utils/json-parse.js";
import { validateToolArguments } from "../../utils/validation.js";
import { calculateCost } from "../../models.js";

// Extended types for Kimi-specific streaming fields
interface KimiChunkDelta {
	reasoning_content?: string | null;
}

interface KimiUsage {
	cached_tokens?: number;
}

export const streamKimi: StreamFunction<'kimi'> = (
	model: Model<'kimi'>,
	context: Context,
	options: KimiProviderOptions,
	id: string
) => {

	const stream = new AssistantMessageEventStream<'kimi'>();

	(async () => {

		const startTimestamp = Date.now();
		const output: BaseAssistantEventMessage<'kimi'> = {
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

		// Build final ChatCompletion from streamed chunks
		let finalResponse: ChatCompletion = getMockKimiMessage();
		let accumulatedContent = '';
		let accumulatedReasoningContent = '';
		const accumulatedToolCalls: Map<number, { id: string; type: 'function'; function: { name: string; arguments: string } }> = new Map();

		try {

			const client = createClient(model, options?.apiKey);
			const params = buildParams(model, context, options);

			const kimiStream = await client.chat.completions.create(
				{ ...params, stream: true },
				{ signal: options?.signal }
			);

			stream.push({ type: "start", message: { ...output, timestamp: Date.now() } });

			let currentBlock: AssistantThinkingContent | AssistantResponseContent | (AssistantToolCall & { partialJson: string }) | null = null;
			const blocks = output.content;
			const blockIndex = () => blocks.length - 1;

			// Track tool call states for streaming
			const toolCallBlocks: Map<number, AssistantToolCall & { partialJson: string }> = new Map();

			for await (const chunk of kimiStream) {
				const choice = chunk.choices[0];
				if (!choice) continue;

				const delta = choice.delta as typeof choice.delta & KimiChunkDelta;

				// Handle reasoning/thinking content (Kimi-specific)
				if (delta.reasoning_content) {
					accumulatedReasoningContent += delta.reasoning_content;

					// Start thinking block if needed
					if (!currentBlock || currentBlock.type !== 'thinking') {
						// End previous block if exists
						if (currentBlock) {
							if (currentBlock.type === 'response') {
								stream.push({
									type: "text_end",
									contentIndex: blockIndex(),
									content: currentBlock.content,
									message: { ...output, timestamp: Date.now() },
								});
							}
						}
						currentBlock = { type: 'thinking', thinkingText: '' };
						output.content.push(currentBlock);
						stream.push({ type: "thinking_start", contentIndex: blockIndex(), message: { ...output, timestamp: Date.now() } });
					}

					if (currentBlock.type === 'thinking') {
						currentBlock.thinkingText += delta.reasoning_content;
						stream.push({
							type: "thinking_delta",
							contentIndex: blockIndex(),
							delta: delta.reasoning_content,
							message: { ...output, timestamp: Date.now() },
						});
					}
				}

				// Handle text content
				if (delta.content) {
					accumulatedContent += delta.content;

					// Transition from thinking to response if needed
					if (!currentBlock || currentBlock.type === 'thinking') {
						// End thinking block if exists
						if (currentBlock && currentBlock.type === 'thinking') {
							stream.push({
								type: "thinking_end",
								contentIndex: blockIndex(),
								content: currentBlock.thinkingText,
								message: { ...output, timestamp: Date.now() },
							});
						}
						currentBlock = { type: 'response', content: [{ type: 'text', content: '' }] };
						output.content.push(currentBlock);
						stream.push({ type: "text_start", contentIndex: blockIndex(), message: { ...output, timestamp: Date.now() } });
					}

					if (currentBlock.type === 'response') {
						const index = currentBlock.content.findIndex((c) => c.type === 'text');
						if (index !== -1) {
							(currentBlock.content[index] as TextContent).content += delta.content;
						}
						stream.push({
							type: "text_delta",
							contentIndex: blockIndex(),
							delta: delta.content,
							message: { ...output, timestamp: Date.now() },
						});
					}
				}

				// Handle tool calls
				if (delta.tool_calls) {
					// End current text/thinking block if we're starting tool calls
					if (currentBlock && currentBlock.type !== 'toolCall') {
						if (currentBlock.type === 'response') {
							stream.push({
								type: "text_end",
								contentIndex: blockIndex(),
								content: currentBlock.content,
								message: { ...output, timestamp: Date.now() },
							});
						} else if (currentBlock.type === 'thinking') {
							stream.push({
								type: "thinking_end",
								contentIndex: blockIndex(),
								content: currentBlock.thinkingText,
								message: { ...output, timestamp: Date.now() },
							});
						}
						currentBlock = null;
					}

					for (const toolCallDelta of delta.tool_calls) {
						const toolIndex = toolCallDelta.index;

						// Get or create accumulated tool call
						if (!accumulatedToolCalls.has(toolIndex)) {
							accumulatedToolCalls.set(toolIndex, {
								id: toolCallDelta.id || '',
								type: 'function',
								function: { name: '', arguments: '' }
							});
						}
						const accumulated = accumulatedToolCalls.get(toolIndex)!;

						// Update accumulated data
						if (toolCallDelta.id) {
							accumulated.id = toolCallDelta.id;
						}
						if (toolCallDelta.function?.name) {
							accumulated.function.name += toolCallDelta.function.name;
						}
						if (toolCallDelta.function?.arguments) {
							accumulated.function.arguments += toolCallDelta.function.arguments;
						}

						// Get or create tool call block
						if (!toolCallBlocks.has(toolIndex)) {
							const toolBlock: AssistantToolCall & { partialJson: string } = {
								type: 'toolCall',
								toolCallId: accumulated.id,
								name: accumulated.function.name,
								arguments: {},
								partialJson: ''
							};
							toolCallBlocks.set(toolIndex, toolBlock);
							output.content.push(toolBlock);
							currentBlock = toolBlock;
							stream.push({ type: "toolcall_start", contentIndex: blockIndex(), message: { ...output, timestamp: Date.now() } });
						}

						const toolBlock = toolCallBlocks.get(toolIndex)!;

						// Update tool block with new data
						if (toolCallDelta.id) {
							toolBlock.toolCallId = accumulated.id;
						}
						if (toolCallDelta.function?.name) {
							toolBlock.name = accumulated.function.name;
						}
						if (toolCallDelta.function?.arguments) {
							toolBlock.partialJson += toolCallDelta.function.arguments;
							toolBlock.arguments = parseStreamingJson(toolBlock.partialJson);
							stream.push({
								type: "toolcall_delta",
								contentIndex: blocks.indexOf(toolBlock),
								delta: toolCallDelta.function.arguments,
								message: { ...output, timestamp: Date.now() },
							});
						}
					}
				}

				// Handle finish reason
				if (choice.finish_reason) {
					output.stopReason = mapStopReason(choice.finish_reason);
				}

				// Handle usage (typically in the last chunk)
				if (chunk.usage) {
					const usage = chunk.usage as typeof chunk.usage & KimiUsage;
					const cacheHitTokens = usage.cached_tokens || 0;

					output.usage = {
						input: (usage.prompt_tokens || 0) - cacheHitTokens,
						output: usage.completion_tokens || 0,
						cacheRead: cacheHitTokens,
						cacheWrite: 0,
						totalTokens: usage.total_tokens || 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					};
					calculateCost(model, output.usage);
				}
			}

			// End any remaining blocks
			if (currentBlock) {
				if (currentBlock.type === 'response') {
					stream.push({
						type: "text_end",
						contentIndex: blockIndex(),
						content: currentBlock.content,
						message: { ...output, timestamp: Date.now() },
					});
				} else if (currentBlock.type === 'thinking') {
					stream.push({
						type: "thinking_end",
						contentIndex: blockIndex(),
						content: currentBlock.thinkingText,
						message: { ...output, timestamp: Date.now() },
					});
				}
			}

			// End tool call blocks and validate arguments
			for (const [, toolBlock] of toolCallBlocks) {
				// Parse final JSON
				try {
					toolBlock.arguments = JSON.parse(toolBlock.partialJson || '{}');
				} catch {
					// Keep the parsed streaming result
				}

				// Validate tool arguments if tool definition is available
				if (context.tools) {
					const tool = context.tools.find((t) => t.name === toolBlock.name);
					if (tool) {
						toolBlock.arguments = validateToolArguments(tool, toolBlock) as Record<string, any>;
					}
				}

				// Clean up partialJson before sending final event
				const { partialJson: _, ...cleanToolCall } = toolBlock;
				stream.push({
					type: "toolcall_end",
					contentIndex: blocks.indexOf(toolBlock),
					toolCall: cleanToolCall,
					message: { ...output, timestamp: Date.now() }
				});
			}

			// Clean up partialJson from output content
			for (const block of output.content) {
				if ('partialJson' in block) {
					delete (block as any).partialJson;
				}
			}

			// Ensure stopReason is toolUse if we have tool calls
			if (output.content.some((b) => b.type === 'toolCall') && output.stopReason === 'stop') {
				output.stopReason = 'toolUse';
			}

			if (options?.signal?.aborted) {
				throw new Error("Request was aborted");
			}

			if (output.stopReason === "aborted" || output.stopReason === "error") {
				throw new Error(
					`Stream ended with status: ${output.stopReason}${output.errorMessage ? ` - ${output.errorMessage}` : ""}`
				);
			}

			// Build final ChatCompletion response
			finalResponse = {
				id: `chatcmpl-${id}`,
				object: "chat.completion",
				created: Math.floor(startTimestamp / 1000),
				model: model.id,
				choices: [{
					index: 0,
					message: {
						role: "assistant",
						content: accumulatedContent || null,
						refusal: null,
						...(accumulatedToolCalls.size > 0 && {
							tool_calls: Array.from(accumulatedToolCalls.values())
						})
					},
					finish_reason: output.stopReason === 'toolUse' ? 'tool_calls' : 'stop',
					logprobs: null
				}],
				usage: {
					prompt_tokens: output.usage.input + output.usage.cacheRead,
					completion_tokens: output.usage.output,
					total_tokens: output.usage.totalTokens
				}
			};

			// Add reasoning_content to the message if present
			if (accumulatedReasoningContent) {
				(finalResponse.choices[0].message as any).reasoning_content = accumulatedReasoningContent;
			}

			stream.push({ type: "done", reason: output.stopReason, message: { ...output, timestamp: Date.now() } });

			const baseAssistantMessage: BaseAssistantMessage<'kimi'> = {
				...output,
				message: finalResponse,
				timestamp: Date.now(),
				duration: Date.now() - startTimestamp
			}
			stream.end(baseAssistantMessage);

		} catch (error) {

			for (const block of output.content) {
				delete (block as any).partialJson;
			}
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.push({ type: "error", reason: output.stopReason, message: { ...output, timestamp: Date.now() } });

			const baseAssistantMessage: BaseAssistantMessage<'kimi'> = {
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
