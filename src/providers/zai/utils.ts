import OpenAI from "openai";
import { AssistantResponse, BaseAssistantMessage, Context, Model, StopReason, Tool, Usage, TextContent } from "../../types.js";
import type {
	ChatCompletion,
	ChatCompletionMessageParam,
	ChatCompletionTool,
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionAssistantMessageParam,
	ChatCompletionToolMessageParam
} from "openai/resources/chat/completions.js";
import { sanitizeSurrogates } from "../../utils/sanitize-unicode.js";
import { calculateCost } from "../../models.js";
import { ZaiProviderOptions } from "./types.js";

// Extended types for Z.AI-specific fields
interface ZaiMessage {
	reasoning_content?: string | null;
}

interface ZaiUsage {
	prompt_tokens_details?: {
		cached_tokens?: number;
	};
}

export function createClient(model: Model<"zai">, apiKey?: string) {
	if (!apiKey) {
		if (!process.env.ZAI_API_KEY) {
			throw new Error(
				"Z.AI API key is required. Set ZAI_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.ZAI_API_KEY;
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

	const message = choice.message as typeof choice.message & ZaiMessage;

	// Handle reasoning/thinking content (Z.AI-specific)
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

export function getResponseUsage(response: ChatCompletion, model: Model<'zai'>): Usage {
	const responseUsage = response.usage as (typeof response.usage & ZaiUsage) | undefined;

	// Z.AI reports cache hits via prompt_tokens_details.cached_tokens (like OpenAI)
	const cacheHitTokens = responseUsage?.prompt_tokens_details?.cached_tokens || 0;

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

export function buildParams(model: Model<"zai">, context: Context, options: ZaiProviderOptions) {
	const messages = buildZaiMessages(model, context);

	const { apiKey, signal, thinking, ...zaiOptions } = options;
	const params: ChatCompletionCreateParamsNonStreaming & { thinking?: { type: string; clear_thinking?: boolean } } = {
		...zaiOptions,
		model: model.id,
		messages,
		stream: false
	};

	// Add thinking configuration if provided, default to enabled for reasoning models
	if (thinking) {
		params.thinking = thinking;
	} else if (model.reasoning) {
		// Default to enabled for reasoning models
		params.thinking = { type: "enabled" };
	}

	// Add tools if available and supported
	if (context.tools && context.tools.length > 0 && model.tools.includes('function_calling')) {
		const tools: ChatCompletionTool[] = [];
		const convertedTools = convertTools(context.tools);
		for (const convertedTool of convertedTools) {
			tools.push(convertedTool);
		}

		if (zaiOptions.tools) {
			for (const optionTool of zaiOptions.tools) {
				tools.push(optionTool);
			}
		}

		params.tools = tools;
	}

	return params;
}

export function buildZaiMessages(_model: Model<'zai'>, context: Context): ChatCompletionMessageParam[] {
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
			// Z.AI chat completions API supports text content
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
			if (message.model.api === 'zai') {
				// Native Z.AI message - reconstruct from original
				const baseMessage = message as BaseAssistantMessage<'zai'>;
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
		case "sensitive":
		case "content_filter":
		case "network_error":
			return "error";
		default:
			return "stop";
	}
}

export function getMockZaiMessage(): ChatCompletion {
	return {
		id: "chatcmpl-123",
		object: "chat.completion",
		created: Math.floor(Date.now() / 1000),
		model: "glm-4.7",
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
