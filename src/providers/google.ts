import {
	type Content,
	FinishReason,
	FunctionCallingConfigMode,
	type GenerateContentConfig,
	type GenerateContentParameters,
	GenerateContentResponse,
	GoogleGenAI,
	type Part,
    ThinkingLevel,
} from "@google/genai";

import { sanitizeSurrogates } from "../utils/sanitize-unicode";
import { Model, StreamFunction, Context, Tool, Api, AssistantMessage, AssistantTextContent, AssistantThinkingContent, AssistantToolCall, StopReason } from "../types";
import { AssistantMessageEventStream } from "../utils/event-stream";
import { buildGoogleMessages } from "./convert";
import { calculateCost } from "../models";
import { validateToolArguments } from "../utils/validation";
import { generateUUID } from "../utils/uuid";

type Props = {
	apiKey?: string;
	signal?: AbortSignal;
}

export type GoogleProviderOptions = Omit<GenerateContentConfig, 'abortSignal' | 'tools' | 'systemPrompt'> & Props

// Counter for generating unique tool call IDs
let toolCallCounter = 0;

export const streamGoogle: StreamFunction<'google'> = (
    model: Model<'google'>,
    context: Context,
    options: GoogleProviderOptions
) => {
    const stream = new AssistantMessageEventStream();
	const id = generateUUID();

    (async () => {
		const startTimestamp = Date.now();
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: "google-generative-ai" as Api,
			model: model.id,
			id,
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

        let finalResponse: GenerateContentResponse = {
            text: '',
            data: '',
            functionCalls: [],
            executableCode: '',
            codeExecutionResult: ''
        }

        try {
			const client = createClient(model, options?.apiKey);
			const params = buildParams(model, context, options);
			const googleStream = await client.models.generateContentStream(params);

			stream.push({ type: "start", partial: output });
			let currentBlock: AssistantTextContent | AssistantThinkingContent | null = null;
			const blocks = output.content;
			const blockIndex = () => blocks.length - 1;
            const messageInputs: Content[] = [];
			const accumulatedParts: Part[] = [];

			for await (const chunk of googleStream) {
                finalResponse = chunk
				const candidate = chunk.candidates?.[0];
				if (candidate?.content?.parts) {
					// Accumulate parts, merging consecutive parts of the same type
					for (const part of candidate.content.parts) {
						const lastPart = accumulatedParts[accumulatedParts.length - 1];

						// Check if we can merge with the last part
						const canMerge = lastPart &&
							part.text !== undefined &&
							lastPart.text !== undefined &&
							part.thought === lastPart.thought; // Both thinking or both regular text

						if (canMerge) {
							// Merge the text into the last part
							if(part.text){
								lastPart.text += part.text;
							}
							// Copy over thoughtSignature if present
							if (part.thoughtSignature) {
								lastPart.thoughtSignature = part.thoughtSignature;
							}
						} else {
							// Add as a new part
							accumulatedParts.push({ ...part });
						}
					}

					for (const part of candidate.content.parts) {
						if (part.text !== undefined) {
							const isThinking = part.thought === true;
							if (
								!currentBlock ||
								(isThinking && currentBlock.type !== "thinking") ||
								(!isThinking && currentBlock.type !== "text")
							) {
								if (currentBlock) {
									if (currentBlock.type === "text") {
										stream.push({
											type: "text_end",
											contentIndex: blocks.length - 1,
											content: currentBlock.text,
											partial: output,
										});
									} else {
										stream.push({
											type: "thinking_end",
											contentIndex: blockIndex(),
											content: currentBlock.thinking,
											partial: output,
										});
									}
								}
								if (isThinking) {
									currentBlock = { type: "thinking", thinking: "" };
									output.content.push(currentBlock);
									stream.push({ type: "thinking_start", contentIndex: blockIndex(), partial: output });
								} else {
									currentBlock = { type: "text", text: "" };
									output.content.push(currentBlock);
									stream.push({ type: "text_start", contentIndex: blockIndex(), partial: output });
								}
							}
							if (currentBlock.type === "thinking") {
								currentBlock.thinking += part.text;
								stream.push({
									type: "thinking_delta",
									contentIndex: blockIndex(),
									delta: part.text,
									partial: output,
								});
							} else {
								currentBlock.text += part.text;
								stream.push({
									type: "text_delta",
									contentIndex: blockIndex(),
									delta: part.text,
									partial: output,
								});
							}
						}

						if (part.functionCall) {
							if (currentBlock) {
								if (currentBlock.type === "text") {
									stream.push({
										type: "text_end",
										contentIndex: blockIndex(),
										content: currentBlock.text,
										partial: output,
									});
								} else {
									stream.push({
										type: "thinking_end",
										contentIndex: blockIndex(),
										content: currentBlock.thinking,
										partial: output,
									});
								}
								currentBlock = null;
							}

							// Generate unique ID if not provided or if it's a duplicate
							const providedId = part.functionCall.id;
							const needsNewId =
								!providedId || output.content.some((b) => b.type === "toolCall" && b.id === providedId);
							const toolCallId = needsNewId
								? `${part.functionCall.name}_${Date.now()}_${++toolCallCounter}`
								: providedId;

							const toolCall: AssistantToolCall = {
								type: "toolCall",
								id: toolCallId,
								name: part.functionCall.name || "",
								arguments: part.functionCall.args as Record<string, any>,
								...(part.thoughtSignature && { thoughtSignature: part.thoughtSignature }),
							};
							

							// Validate tool arguments if tool definition is available
							if (context.tools) {
								const tool = context.tools.find((t) => t.name === toolCall.name);
								if (tool) {
									toolCall.arguments = validateToolArguments(tool, toolCall)as Record<string, any>;
								}
							}

							output.content.push(toolCall);
							stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
							stream.push({
								type: "toolcall_delta",
								contentIndex: blockIndex(),
								delta: JSON.stringify(toolCall.arguments),
								partial: output,
							});
							stream.push({ type: "toolcall_end", contentIndex: blockIndex(), toolCall, partial: output });
						}
					}
				}

				if (candidate?.finishReason) {
					output.stopReason = mapStopReason(candidate.finishReason);
					if (output.content.some((b) => b.type === "toolCall")) {
						output.stopReason = "toolUse";
					}
				}

				if (chunk.usageMetadata) {
					output.usage = {
						input: chunk.usageMetadata.promptTokenCount || 0,
						output:
							(chunk.usageMetadata.candidatesTokenCount || 0) + (chunk.usageMetadata.thoughtsTokenCount || 0),
						cacheRead: chunk.usageMetadata.cachedContentTokenCount || 0,
						cacheWrite: 0,
						totalTokens: chunk.usageMetadata.totalTokenCount || 0,
						cost: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							total: 0,
						},
					};
					calculateCost(model, output.usage);
				}
			}

			if (currentBlock) {
				if (currentBlock.type === "text") {
					stream.push({
						type: "text_end",
						contentIndex: blockIndex(),
						content: currentBlock.text,
						partial: output,
					});
				} else {
					stream.push({
						type: "thinking_end",
						contentIndex: blockIndex(),
						content: currentBlock.thinking,
						partial: output,
					});
				}
			}

			if (options?.signal?.aborted) {
				throw new Error("Request was aborted");
			}

			if (output.stopReason === "aborted" || output.stopReason === "error") {
				throw new Error("An unkown error ocurred");
			}

			// Build the complete Content from accumulated parts
			if (accumulatedParts.length > 0) {
				messageInputs.push({
					role: 'model',
					parts: accumulatedParts
				});
			}
            finalResponse.candidates = [];
            for(let i=0; i < messageInputs.length; i++){
                finalResponse.candidates?.push({
                    content: messageInputs[i]
                })
            }
			stream.push({ type: "done", reason: output.stopReason, message: output });
            stream.end({
                _provider: 'google',
                role: 'assistant',
                message: finalResponse,
				startTimestamp,
				endTimestamp: Date.now(),
				model: model,
				id
            })

        } catch(error){
			for (const block of output.content) delete (block as any).index;
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.push({ type: "error", reason: output.stopReason, error: output });

			stream.end({
				_provider: 'google',
				role: 'assistant',
				message: finalResponse,
				startTimestamp,
				endTimestamp: Date.now(),
				model: model,
				id,
				error: error instanceof Error ? {
					message: error.message,
					name: error.name,
					stack: error.stack
				} : { message: String(error) }
			})
        }

    })()

    return stream;
}

function createClient(model: Model<"google">, apiKey?: string): GoogleGenAI {
	if (!apiKey) {
		if (!process.env.GEMINI_API_KEY) {
			throw new Error(
				"Gemini API key is required. Set GEMINI_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.GEMINI_API_KEY;
	}
	return new GoogleGenAI({
		apiKey,
		httpOptions: model.headers ? { headers: model.headers } : undefined,
	});
}

function buildParams(model: Model<"google">, context: Context, options: GoogleProviderOptions){

    const contents = buildGoogleMessages(model, context);

	const {apiKey, signal, ...googleOptions} = options

	const config: GenerateContentConfig = {
		...googleOptions
	}

    if(options?.signal){
        config.abortSignal = options.signal;
    }

    if(context.systemPrompt){
        config.systemInstruction = sanitizeSurrogates(context.systemPrompt);
    }

    if(context.tools){
        config.tools = convertTools(context.tools)
    }

	const params: GenerateContentParameters = {
        model: model.id,
        contents,
        config
    };

    return params;
}

/**
 * Transforms a JSON Schema to Google's supported subset.
 * Main transformations:
 * - Converts { "const": "value" } to { "enum": ["value"] }
 * - Converts { "anyOf": [{ "const": "a" }, { "const": "b" }] } to { "enum": ["a", "b"] }
 * - Recursively processes nested objects and arrays
 */
export function transformSchemaForGoogle(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	// Handle arrays
	if (Array.isArray(schema)) {
		return schema.map(transformSchemaForGoogle);
	}

	const transformed: any = {};

	// Handle const keyword - convert to enum
	if ('const' in schema) {
		transformed.enum = [schema.const];
		// Copy over other properties except const
		for (const key in schema) {
			if (key !== 'const') {
				transformed[key] = schema[key];
			}
		}
		return transformed;
	}

	// Handle anyOf with const values - convert to enum
	if ('anyOf' in schema && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
		const allConst = schema.anyOf.every((item: any) => item && typeof item === 'object' && 'const' in item);
		if (allConst) {
			// Extract all const values into a single enum
			transformed.enum = schema.anyOf.map((item: any) => item.const);
			// Copy over other properties from the parent schema
			for (const key in schema) {
				if (key !== 'anyOf') {
					transformed[key] = schema[key];
				}
			}
			// Copy type and other properties from the first anyOf item if not already set
			if (schema.anyOf.length > 0) {
				const firstItem = schema.anyOf[0];
				for (const key in firstItem) {
					if (key !== 'const' && !(key in transformed)) {
						transformed[key] = firstItem[key];
					}
				}
			}
			return transformed;
		}
	}

	// Recursively process all properties
	for (const key in schema) {
		if (key === 'properties' && typeof schema.properties === 'object') {
			// Recursively transform each property
			transformed.properties = {};
			for (const propKey in schema.properties) {
				transformed.properties[propKey] = transformSchemaForGoogle(schema.properties[propKey]);
			}
		} else if (key === 'items' && schema.items) {
			// Recursively transform array items schema
			transformed.items = transformSchemaForGoogle(schema.items);
		} else if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
			// Recursively transform union/intersection schemas
			transformed[key] = Array.isArray(schema[key])
				? schema[key].map(transformSchemaForGoogle)
				: transformSchemaForGoogle(schema[key]);
		} else {
			// Copy other properties as-is
			transformed[key] = schema[key];
		}
	}

	return transformed;
}

function convertTools(tools: readonly Tool[]): any[] | undefined {
	if (tools.length === 0) return undefined;
	return [
		{
			functionDeclarations: tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: transformSchemaForGoogle(tool.parameters),
			})),
		},
	];
}

function mapStopReason(reason: FinishReason): StopReason {
	switch (reason) {
		case FinishReason.STOP:
			return "stop";
		case FinishReason.MAX_TOKENS:
			return "length";
		case FinishReason.BLOCKLIST:
		case FinishReason.PROHIBITED_CONTENT:
		case FinishReason.SPII:
		case FinishReason.SAFETY:
		case FinishReason.IMAGE_SAFETY:
		case FinishReason.IMAGE_PROHIBITED_CONTENT:
		case FinishReason.RECITATION:
		case FinishReason.FINISH_REASON_UNSPECIFIED:
		case FinishReason.OTHER:
		case FinishReason.LANGUAGE:
		case FinishReason.MALFORMED_FUNCTION_CALL:
		case FinishReason.UNEXPECTED_TOOL_CALL:
		case FinishReason.NO_IMAGE:
			return "error";
		default: {
			const _exhaustive: never = reason;
			throw new Error(`Unhandled stop reason: ${_exhaustive}`);
		}
	}
}
