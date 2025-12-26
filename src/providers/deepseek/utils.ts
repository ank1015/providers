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
import { DeepSeekProviderOptions } from "./types.js";

// Extended types for DeepSeek-specific fields
interface DeepSeekMessage {
	reasoning_content?: string | null;
}

interface DeepSeekUsage {
	prompt_cache_hit_tokens?: number;
	prompt_cache_miss_tokens?: number;
}

export function createClient(model: Model<"deepseek">, apiKey?: string) {
	if (!apiKey) {
		if (!process.env.DEEPSEEK_API_KEY) {
			throw new Error(
				"DeepSeek API key is required. Set DEEPSEEK_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.DEEPSEEK_API_KEY;
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

	const message = choice.message as typeof choice.message & DeepSeekMessage;

	// Handle reasoning/thinking content (DeepSeek-specific)
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

export function getResponseUsage(response: ChatCompletion, model: Model<'deepseek'>): Usage {
	const responseUsage = response.usage as (typeof response.usage & DeepSeekUsage) | undefined;

	// DeepSeek reports cache hits via prompt_cache_hit_tokens
	const cacheHitTokens = responseUsage?.prompt_cache_hit_tokens || 0;

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

export function buildParams(model: Model<"deepseek">, context: Context, options: DeepSeekProviderOptions) {
	const messages = buildDeepSeekMessages(model, context);

	const { apiKey, signal, ...deepseekOptions } = options;
	const params: ChatCompletionCreateParamsNonStreaming = {
		...deepseekOptions,
		model: model.id,
		messages,
		stream: false
	};

	// Add tools if available and supported
	if (context.tools && context.tools.length > 0 && model.tools.includes('function_calling')) {
		const tools: ChatCompletionTool[] = [];
		const convertedTools = convertTools(context.tools);
		for (const convertedTool of convertedTools) {
			tools.push(convertedTool);
		}

		if (deepseekOptions.tools) {
			for (const optionTool of deepseekOptions.tools) {
				tools.push(optionTool);
			}
		}

		params.tools = tools;
	}

	return params;
}

export function buildDeepSeekMessages(_model: Model<'deepseek'>, context: Context): ChatCompletionMessageParam[] {
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
			// DeepSeek chat completions API supports text content
			// For images, we'd need to check if the model supports vision
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
			if (message.model.api === 'deepseek') {
				// Native DeepSeek message - reconstruct from original
				const baseMessage = message as BaseAssistantMessage<'deepseek'>;
				const originalMessage = baseMessage.message.choices[0]?.message;

				if (originalMessage) {
					const assistantMessage: ChatCompletionAssistantMessageParam = originalMessage

					messages.push(assistantMessage);
				}
			} else {
				// Convert from other providers using normalized content
				let textContent = '';
				const toolCalls: ChatCompletionAssistantMessageParam['tool_calls'] = [];
				let reasoningContent = ''

				for (const contentBlock of message.content) {
					if (contentBlock.type === 'thinking') {
						// Wrap thinking in tags for cross-provider context
						reasoningContent += `${sanitizeSurrogates(contentBlock.thinkingText)}`;
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
					reasoning_content: reasoningContent,
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

export function getMockDeepSeekMessage(): ChatCompletion {
	return {
		id: "chatcmpl-123",
		object: "chat.completion",
		created: Math.floor(Date.now() / 1000),
		model: "deepseek-chat",
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
