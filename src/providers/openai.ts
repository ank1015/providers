// Return a abstracted event stream
// Return the final response as it is.
import OpenAI from "openai";
import { AssistantMessageEventStream } from "../utils/event-stream";
import { StreamFunction, Model, Context, Tool, Api, AssistantMessage, AssistantThinkingContent, AssistantTextContent, AssistantToolCall, StopReason } from "../types";
import { buildOpenAIMessages } from "./convert";
import { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";
import type {Tool as OpenAITool, ResponseCreateParamsBase, ResponseFunctionToolCall, ResponseOutputMessage, ResponseReasoningItem,} from "openai/resources/responses/responses.js";
import { parseStreamingJson } from "../utils/json-parse";
import { validateToolArguments } from "../utils/validation";
import { calculateCost } from "../models";
import { Response } from "openai/resources/responses/responses.js";

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
}
export type OpenAIProviderOptions = Omit<ResponseCreateParamsBase, 'model' | 'input' | 'tools'> & Props

// takes in model, built in message
export const streamOpenAI: StreamFunction<'openai'> = (
    model: Model<'openai'>,
    context: Context,
    options: OpenAIProviderOptions
) => {

    const stream = new AssistantMessageEventStream();

	// Start async processing
	(async () => {
		const startTimestamp = Date.now();
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: "openai" as Api,
			model: model.id,
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
			const openaiStream = await client.responses.create(params, { signal: options?.signal });
			stream.push({ type: "start", partial: output });

			let currentItem: ResponseReasoningItem | ResponseOutputMessage | ResponseFunctionToolCall | null = null;
			let currentBlock: AssistantThinkingContent | AssistantTextContent | (AssistantToolCall & { partialJson: string }) | null = null;
			const blocks = output.content;
			const blockIndex = () => blocks.length - 1;

			for await (const event of openaiStream) {
				// Handle output item start
				if (event.type === "response.output_item.added") {
					const item = event.item;
					if (item.type === "reasoning") {
						currentItem = item;
						currentBlock = { type: "thinking", thinking: "" };
						output.content.push(currentBlock);
						stream.push({ type: "thinking_start", contentIndex: blockIndex(), partial: output });
					} else if (item.type === "message") {
						currentItem = item;
						currentBlock = { type: "text", text: "" };
						output.content.push(currentBlock);
						stream.push({ type: "text_start", contentIndex: blockIndex(), partial: output });
					} else if (item.type === "function_call") {
						currentItem = item;
						currentBlock = {
							type: "toolCall",
							id: item.call_id,
							name: item.name,
							arguments: {},
							partialJson: item.arguments || "",
						};
						output.content.push(currentBlock);
						stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
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
							currentBlock.thinking += event.delta;
							lastPart.text += event.delta;
							stream.push({
								type: "thinking_delta",
								contentIndex: blockIndex(),
								delta: event.delta,
								partial: output,
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
							currentBlock.thinking += "\n\n";
							lastPart.text += "\n\n";
							stream.push({
								type: "thinking_delta",
								contentIndex: blockIndex(),
								delta: "\n\n",
								partial: output,
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
					if (currentItem && currentItem.type === "message" && currentBlock && currentBlock.type === "text") {
						const lastPart = currentItem.content[currentItem.content.length - 1];
						if (lastPart && lastPart.type === "output_text") {
							currentBlock.text += event.delta;
							lastPart.text += event.delta;
							stream.push({
								type: "text_delta",
								contentIndex: blockIndex(),
								delta: event.delta,
								partial: output,
							});
						}
					}
				} else if (event.type === "response.refusal.delta") {
					if (currentItem && currentItem.type === "message" && currentBlock && currentBlock.type === "text") {
						const lastPart = currentItem.content[currentItem.content.length - 1];
						if (lastPart && lastPart.type === "refusal") {
							currentBlock.text += event.delta;
							lastPart.refusal += event.delta;
							stream.push({
								type: "text_delta",
								contentIndex: blockIndex(),
								delta: event.delta,
								partial: output,
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
							partial: output,
						});
					}
				}
				// Handle output item completion
				else if (event.type === "response.output_item.done") {
					const item = event.item;

					if (item.type === "reasoning" && currentBlock && currentBlock.type === "thinking") {
						currentBlock.thinking = item.summary?.map((s) => s.text).join("\n\n") || "";
						stream.push({
							type: "thinking_end",
							contentIndex: blockIndex(),
							content: currentBlock.thinking,
							partial: output,
						});
						currentBlock = null;
					} else if (item.type === "message" && currentBlock && currentBlock.type === "text") {
						currentBlock.text = item.content.map((c) => (c.type === "output_text" ? c.text : c.refusal)).join("");
						stream.push({
							type: "text_end",
							contentIndex: blockIndex(),
							content: currentBlock.text,
							partial: output,
						});
						currentBlock = null;
					} else if (item.type === "function_call") {
						const toolCall: AssistantToolCall = {
							type: "toolCall",
							id: item.call_id,
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

						stream.push({ type: "toolcall_end", contentIndex: blockIndex(), toolCall, partial: output });
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

			stream.push({ type: "done", reason: output.stopReason, message: output });
			stream.end({
				_provider: 'openai',
				role: 'assistant',
				message: finalResponse,
				startTimestamp,
				endTimestamp: Date.now()
			});
		}catch(error){
			for (const block of output.content) delete (block as any).index;
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.push({ type: "error", reason: output.stopReason, error: output });

			// Update finalResponse to reflect the error state
			finalResponse.status = options?.signal?.aborted ? "cancelled" : "failed";
			finalResponse.error = error instanceof Error ? {
				message: error.message,
				code: (error as any).code || "unknown_error",
				type: error.name || "Error"
			} as any : { message: String(error) } as any;

			stream.end({
				_provider: 'openai',
				role: 'assistant',
				message: finalResponse,
				startTimestamp,
				endTimestamp: Date.now()
			});
		}
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

function buildParams(model: Model<"openai">, context: Context, options: OpenAIProviderOptions){
	const messages = buildOpenAIMessages(model, context);

	const {apiKey, signal, ...openaiOptions} = options

	const params: ResponseCreateParamsStreaming = {
		...openaiOptions, 
		stream: true
	}


	params.model = model.id;
	params.input = messages

	if(!params.include?.includes('reasoning.encrypted_content')){
		params.include?.push('reasoning.encrypted_content');
	}

	if(context.tools){
		params.tools = convertTools(context.tools)
	}

	return params;
}

function convertTools(tools: readonly Tool[]): OpenAITool[] {
	return tools.map((tool) => ({
		type: "function",
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters as any, // TypeBox already generates JSON Schema
		strict: null,
	}));
}

function mapStopReason(status: OpenAI.Responses.ResponseStatus | undefined): StopReason {
	if (!status) return "stop";
	switch (status) {
		case "completed":
			return "stop";
		case "incomplete":
			return "length";
		case "failed":
		case "cancelled":
			return "error";
		// These two are wonky ...
		case "in_progress":
		case "queued":
			return "stop";
		default: {
			const _exhaustive: never = status;
			throw new Error(`Unhandled stop reason: ${_exhaustive}`);
		}
	}
}
