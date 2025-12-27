import Anthropic from "@anthropic-ai/sdk";
import { AssistantResponse, BaseAssistantMessage, Context, Model, StopReason, Tool, Usage, TextContent } from "../../types.js";
import type {
	Message as AnthropicMessage,
	MessageParam,
	ContentBlock,
	TextBlock,
	ToolUseBlock,
	MessageCreateParamsNonStreaming,
	TextBlockParam,
	ImageBlockParam,
	ToolResultBlockParam,
	ToolUseBlockParam,
	MessageCreateParamsBase
} from "@anthropic-ai/sdk/resources/messages.js";
import { sanitizeSurrogates } from "../../utils/sanitize-unicode.js";
import { calculateCost } from "../../models.js";
import { AnthropicProviderOptions } from "./types.js";
import { RedactedThinkingBlock, ThinkingBlock } from "@anthropic-ai/sdk/resources";


export function createClient(model: Model<"anthropic">, apiKey?: string, interleavedThinking?: boolean): { client: Anthropic; isOAuthToken: boolean } {
	if (!apiKey) {
		if (!process.env.ANTHROPIC_API_KEY) {
			throw new Error(
				"Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.ANTHROPIC_API_KEY;
	}
	const betaFeatures = ["fine-grained-tool-streaming-2025-05-14"];
	if (interleavedThinking) {
		betaFeatures.push("interleaved-thinking-2025-05-14");
	}

	if (apiKey.includes("sk-ant-oat")) {
		const defaultHeaders = {
			accept: "application/json",
			"anthropic-dangerous-direct-browser-access": "true",
			"anthropic-beta": `oauth-2025-04-20,${betaFeatures.join(",")}`,
			...(model.headers || {}),
		};

		const client = new Anthropic({
			apiKey: null,
			authToken: apiKey,
			baseURL: model.baseUrl,
			defaultHeaders,
			dangerouslyAllowBrowser: true,
		});

		return { client, isOAuthToken: true };
	} else {
		const defaultHeaders = {
			accept: "application/json",
			"anthropic-dangerous-direct-browser-access": "true",
			"anthropic-beta": betaFeatures.join(","),
			...(model.headers || {}),
		};

		const client = new Anthropic({
			apiKey,
			baseURL: model.baseUrl,
			dangerouslyAllowBrowser: true,
			defaultHeaders,
		});

		return { client, isOAuthToken: false };
	}
}

export function getResponseAssistantResponse(response: AnthropicMessage): AssistantResponse {
	const assistantResponse: AssistantResponse = [];

	if (response.content) {
		for (const block of response.content) {
			// Handle thinking blocks (extended thinking)
			if (block.type === 'thinking') {
				const thinkingBlock = block as ThinkingBlock;
				assistantResponse.push({
					type: 'thinking',
					thinkingText: thinkingBlock.thinking
				});
			}
			// Handle redacted thinking blocks
			else if (block.type === 'redacted_thinking') {
				const redactedBlock = block as RedactedThinkingBlock;
				assistantResponse.push({
					type: 'thinking',
					thinkingText: `[Redacted: ${redactedBlock.data}]`
				});
			}
			// Handle text content
			else if (block.type === 'text') {
				const textBlock = block as TextBlock;
				assistantResponse.push({
					type: 'response',
					content: [{
						type: 'text',
						content: textBlock.text
					}]
				});
			}
			// Handle tool use
			else if (block.type === 'tool_use') {
				const toolBlock = block as ToolUseBlock;
				assistantResponse.push({
					type: 'toolCall',
					toolCallId: toolBlock.id,
					name: toolBlock.name,
					arguments: toolBlock.input as Record<string, any>
				});
			}
		}
	}

	return assistantResponse;
}

export function getResponseUsage(response: AnthropicMessage, model: Model<'anthropic'>): Usage {
	const usage: Usage = {
		input: response.usage.input_tokens,
		output: response.usage.output_tokens,
		cacheRead: response.usage.cache_read_input_tokens || 0,
		cacheWrite: response.usage.cache_creation_input_tokens || 0,
		totalTokens: response.usage.input_tokens + response.usage.output_tokens + (response.usage.cache_read_input_tokens || 0) + (response.usage.cache_creation_input_tokens || 0),
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
	};
	calculateCost(model, usage);
	return usage;
}

export function buildParams(model: Model<"anthropic">, context: Context, options: AnthropicProviderOptions, isOAuthToken: boolean): MessageCreateParamsBase {
	const messages = buildAnthropicMessages(model, context);

	const { apiKey, signal, ...anthropicOptions } = options;
	const params: MessageCreateParamsBase = {
		...anthropicOptions,
		model: model.id,
		messages,
		max_tokens: anthropicOptions.max_tokens || model.maxTokens,
		stream: false
	};

	// For OAuth tokens, we MUST include Claude Code identity
	if (isOAuthToken) {
		params.system = [
			{
				type: "text",
				text: "You are Claude Code, Anthropic's official CLI for Claude.",
				cache_control: {
					type: "ephemeral",
				},
			},
		];
		if (context.systemPrompt) {
			params.system.push({
				type: "text",
				text: sanitizeSurrogates(context.systemPrompt),
				cache_control: {
					type: "ephemeral",
				},
			});
		}
	} else if (context.systemPrompt) {
		// Add cache control to system prompt for non-OAuth tokens
		params.system = [
			{
				type: "text",
				text: sanitizeSurrogates(context.systemPrompt),
				cache_control: {
					type: "ephemeral",
				},
			},
		];
	}

	// Add tools if available and supported
	if (context.tools && context.tools.length > 0 && model.tools.includes('function_calling')) {
		const tools = convertTools(context.tools);
		params.tools = tools;
	}

	return params;
}

export function buildAnthropicMessages(model: Model<'anthropic'>, context: Context): MessageParam[] {
	const messages: MessageParam[] = [];

	for (const message of context.messages) {
		// Handle user messages
		if (message.role === 'user') {
			const content: (TextBlockParam | ImageBlockParam)[] = [];

			for (const contentItem of message.content) {
				if (contentItem.type === 'text') {
					content.push({
						type: 'text',
						text: sanitizeSurrogates(contentItem.content)
					});
				}
				if (contentItem.type === 'image' && model.input.includes("image")) {
					content.push({
						type: 'image',
						source: {
							type: 'base64',
							media_type: contentItem.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
							data: contentItem.data
						}
					});
				}
				// Note: Anthropic supports documents via DocumentBlockParam, but our SDK uses 'file' type
				// We could extend this to support PDF documents if needed
			}

			if (content.length > 0) {
				messages.push({
					role: 'user',
					content
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

			const toolResultContent: ToolResultBlockParam = {
				type: 'tool_result',
				tool_use_id: message.toolCallId,
				content: sanitizeSurrogates(textContent || (message.isError ? '[TOOL ERROR]' : '')),
				is_error: message.isError
			};

			messages.push({
				role: 'user',
				content: [toolResultContent]
			});
		}

		// Handle assistant messages
		if (message.role === 'assistant') {
			if (message.model.api === 'anthropic') {
				// Native Anthropic message - use original content
				const baseMessage = message as BaseAssistantMessage<'anthropic'>;
				if (baseMessage.message.content && baseMessage.message.content.length > 0) {
					messages.push({
						role: 'assistant',
						content: baseMessage.message.content as ContentBlock[]
					});
				}
			} else {
				// Convert from other providers using normalized content
				const content: (TextBlockParam | ToolUseBlockParam)[] = [];

				for (const contentBlock of message.content) {
					if (contentBlock.type === 'thinking') {
						// Wrap thinking in tags for cross-provider context
						content.push({
							type: 'text',
							text: `<thinking>${sanitizeSurrogates(contentBlock.thinkingText)}</thinking>`
						});
					} else if (contentBlock.type === 'response') {
						const textContent = contentBlock.content
							.filter(c => c.type === 'text')
							.map(c => sanitizeSurrogates((c as TextContent).content))
							.join('');

						if (textContent) {
							content.push({
								type: 'text',
								text: textContent
							});
						}
					} else if (contentBlock.type === 'toolCall') {
						content.push({
							type: 'tool_use',
							id: contentBlock.toolCallId,
							name: contentBlock.name,
							input: contentBlock.arguments
						});
					}
				}

				if (content.length > 0) {
					messages.push({
						role: 'assistant',
						content
					});
				}
			}
		}
	}

	return messages;
}

function convertTools(tools: Tool[]): Anthropic.Messages.Tool[] {
	if (!tools) return [];

	return tools.map((tool) => {
		const jsonSchema = tool.parameters as any; // TypeBox already generates JSON Schema

		return {
			name: tool.name,
			description: tool.description,
			input_schema: {
				type: "object" as const,
				properties: jsonSchema.properties || {},
				required: jsonSchema.required || [],
			},
		};
	});
}


export function mapStopReason(reason: Anthropic.Messages.StopReason): StopReason {
	switch (reason) {
		case "end_turn":
			return "stop";
		case "max_tokens":
			return "length";
		case "tool_use":
			return "toolUse";
		case "refusal":
			return "error";
		case "pause_turn": // Stop is good enough -> resubmit
			return "stop";
		case "stop_sequence":
			return "stop"; // We don't supply stop sequences, so this should never happen
		default: {
			const _exhaustive: never = reason;
			throw new Error(`Unhandled stop reason: ${_exhaustive}`);
		}
	}
}


export function getMockAnthropicMessage(): AnthropicMessage {
	return {
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
	};
}
