import OpenAI from "openai";
import { AssistantResponse, BaseAssistantMessage, Context, Model, StopReason, Tool, Usage, TextContent, ImageContent } from "../../types.js";
import type {
	ChatCompletion,
	ChatCompletionMessageParam,
	ChatCompletionTool,
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionAssistantMessageParam,
	ChatCompletionToolMessageParam,
	ChatCompletionContentPart
} from "openai/resources/chat/completions.js";
import { sanitizeSurrogates } from "../../utils/sanitize-unicode.js";
import { calculateCost } from "../../models.js";
import { KimiProviderOptions } from "./types.js";

// Extended types for Kimi-specific fields
interface KimiMessage {
	reasoning_content?: string | null;
}

interface KimiUsage {
	cached_tokens?: number;
}

export function createClient(model: Model<"kimi">, apiKey?: string) {
	if (!apiKey) {
		if (!process.env.KIMI_API_KEY) {
			throw new Error(
				"Kimi API key is required. Set KIMI_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.KIMI_API_KEY;
	}
	return new OpenAI({
		apiKey,
		baseURL: model.baseUrl,
		dangerouslyAllowBrowser: true,
		defaultHeaders: model.headers,
	});
}

export function getResponseAssistantResponse(response: ChatCompletion): AssistantResponse {
	const assistantResponse: AssistantResponse = [];
	const choice = response.choices[0];

	if (!choice?.message) {
		return assistantResponse;
	}

	const message = choice.message as typeof choice.message & KimiMessage;

	// Handle reasoning/thinking content (Kimi-specific)
	if (message.reasoning_content) {
		assistantResponse.push({
			type: 'thinking',
			thinkingText: message.reasoning_content
		});
	}

	// Handle text content
	if (message.content) {
		assistantResponse.push({
			type: 'response',
			content: [{
				type: 'text',
				content: message.content
			}]
		});
	}

	// Handle tool calls
	if (message.tool_calls) {
		for (const toolCall of message.tool_calls) {
			// Only handle function tool calls
			if (toolCall.type === 'function') {
				assistantResponse.push({
					type: 'toolCall',
					toolCallId: toolCall.id,
					name: toolCall.function.name,
					arguments: JSON.parse(toolCall.function.arguments || '{}')
				});
			}
		}
	}

	return assistantResponse;
}

export function getAssistantStopReason(response: ChatCompletion): StopReason {
	const finishReason = response.choices[0]?.finish_reason;
	return mapStopReason(finishReason);
}

export function getResponseUsage(response: ChatCompletion, model: Model<'kimi'>): Usage {
	const responseUsage = response.usage as (typeof response.usage & KimiUsage) | undefined;

	// Kimi reports cache hits via cached_tokens field
	const cacheHitTokens = responseUsage?.cached_tokens || 0;

	const usage: Usage = {
		input: (responseUsage?.prompt_tokens || 0) - cacheHitTokens,
		output: responseUsage?.completion_tokens || 0,
		cacheRead: cacheHitTokens,
		cacheWrite: 0,
		totalTokens: responseUsage?.total_tokens || 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
	};
	calculateCost(model, usage);
	return usage;
}

export function buildParams(model: Model<"kimi">, context: Context, options: KimiProviderOptions) {
	const messages = buildKimiMessages(model, context);

	const { apiKey, signal, thinking, ...kimiOptions } = options;
	const params: ChatCompletionCreateParamsNonStreaming & { thinking?: { type: string } } = {
		...kimiOptions,
		model: model.id,
		messages,
		stream: false
	};

	// Determine thinking configuration
	let thinkingEnabled = false;
	if (thinking) {
		params.thinking = thinking;
		thinkingEnabled = thinking.type === "enabled";
	} else if (model.reasoning) {
		// Default to enabled for reasoning models
		params.thinking = { type: "enabled" };
		thinkingEnabled = true;
	}

	// Set temperature if not provided - Kimi has strict requirements:
	// - kimi-k2.5 with thinking: must be 1.0
	// - kimi-k2.5 without thinking: must be 0.6
	// - other models: default 0.6
	if (params.temperature === undefined) {
		if (model.id === 'kimi-k2.5') {
			params.temperature = thinkingEnabled ? 1.0 : 0.6;
		} else {
			params.temperature = 0.6;
		}
	}

	// Set max_tokens if not provided - Kimi thinking models require >= 16000
	// to ensure reasoning_content and content can be fully returned
	if (params.max_tokens === undefined && thinkingEnabled) {
		params.max_tokens = 16000;
	}

	// Add tools if available and supported
	if (context.tools && context.tools.length > 0 && model.tools.includes('function_calling')) {
		const tools: ChatCompletionTool[] = [];
		const convertedTools = convertTools(context.tools);
		for (const convertedTool of convertedTools) {
			tools.push(convertedTool);
		}

		if (kimiOptions.tools) {
			for (const optionTool of kimiOptions.tools) {
				tools.push(optionTool);
			}
		}

		params.tools = tools;
	}

	return params;
}

export function buildKimiMessages(model: Model<'kimi'>, context: Context): ChatCompletionMessageParam[] {
	const messages: ChatCompletionMessageParam[] = [];

	// Add system prompt
	if (context.systemPrompt) {
		messages.push({
			role: 'system',
			content: sanitizeSurrogates(context.systemPrompt)
		});
	}

	for (const message of context.messages) {
		// Handle user messages
		if (message.role === 'user') {
			// Kimi supports text and image content
			const supportsImages = model.input.includes('image');

			if (supportsImages && message.content.some(c => c.type === 'image')) {
				// Build multimodal content
				const contentParts: ChatCompletionContentPart[] = [];

				for (const c of message.content) {
					if (c.type === 'text') {
						contentParts.push({
							type: 'text',
							text: sanitizeSurrogates((c as TextContent).content)
						});
					} else if (c.type === 'image') {
						const imageContent = c as ImageContent;
						contentParts.push({
							type: 'image_url',
							image_url: {
								url: `data:${imageContent.mimeType};base64,${imageContent.data}`
							}
						});
					}
				}

				if (contentParts.length > 0) {
					messages.push({
						role: 'user',
						content: contentParts
					});
				}
			} else {
				// Text-only content
				const textContents = message.content
					.filter(c => c.type === 'text')
					.map(c => sanitizeSurrogates((c as TextContent).content))
					.join('\n');

				if (textContents) {
					messages.push({
						role: 'user',
						content: textContents
					});
				}
			}
		}

		// Handle tool results
		if (message.role === 'toolResult') {
			const textContent = message.content
				.filter(c => c.type === 'text')
				.map(c => {
					const text = (c as TextContent).content;
					return message.isError ? `[TOOL ERROR] ${text}` : text;
				})
				.join('\n');

			const toolMessage: ChatCompletionToolMessageParam = {
				role: 'tool',
				tool_call_id: message.toolCallId,
				content: sanitizeSurrogates(textContent || (message.isError ? '[TOOL ERROR]' : ''))
			};
			messages.push(toolMessage);
		}

		// Handle assistant messages
		if (message.role === 'assistant') {
			if (message.model.api === 'kimi') {
				// Native Kimi message - reconstruct from original
				const baseMessage = message as BaseAssistantMessage<'kimi'>;
				const originalMessage = baseMessage.message.choices[0]?.message;

				if (originalMessage) {
					const assistantMessage: ChatCompletionAssistantMessageParam = originalMessage;
					messages.push(assistantMessage);
				}
			} else {
				// Convert from other providers using normalized content
				let textContent = '';
				const toolCalls: ChatCompletionAssistantMessageParam['tool_calls'] = [];
				let reasoningContent = '';

				for (const contentBlock of message.content) {
					if (contentBlock.type === 'thinking') {
						reasoningContent += sanitizeSurrogates(contentBlock.thinkingText);
					} else if (contentBlock.type === 'response') {
						const text = contentBlock.content
							.filter(c => c.type === 'text')
							.map(c => sanitizeSurrogates((c as TextContent).content))
							.join('');
						textContent += text;
					} else if (contentBlock.type === 'toolCall') {
						toolCalls.push({
							id: contentBlock.toolCallId,
							type: 'function',
							function: {
								name: contentBlock.name,
								arguments: JSON.stringify(contentBlock.arguments)
							}
						});
					}
				}

				const assistantMessage: any = {
					role: 'assistant',
					reasoning_content: reasoningContent || undefined,
					content: textContent || null
				};

				if (toolCalls.length > 0) {
					assistantMessage.tool_calls = toolCalls;
				}

				messages.push(assistantMessage);
			}
		}
	}

	return messages;
}

export function convertTools(tools: readonly Tool[]): ChatCompletionTool[] {
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters as Record<string, unknown>
		}
	}));
}

export function mapStopReason(finishReason: string | null | undefined): StopReason {
	if (!finishReason) return "stop";

	switch (finishReason) {
		case "stop":
			return "stop";
		case "length":
			return "length";
		case "tool_calls":
			return "toolUse";
		case "content_filter":
			return "error";
		default:
			return "stop";
	}
}

export function getMockKimiMessage(): ChatCompletion {
	return {
		id: "chatcmpl-123",
		object: "chat.completion",
		created: Math.floor(Date.now() / 1000),
		model: "kimi-k2.5",
		choices: [{
			index: 0,
			message: {
				role: "assistant",
				content: "",
				refusal: null
			},
			finish_reason: "stop",
			logprobs: null
		}],
		usage: {
			prompt_tokens: 0,
			completion_tokens: 0,
			total_tokens: 0
		}
	};
}
