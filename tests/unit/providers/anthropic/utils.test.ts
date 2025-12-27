import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createClient,
	buildAnthropicMessages,
	buildParams,
	getResponseAssistantResponse,
	getResponseUsage,
	mapStopReason,
} from '../../../../src/providers/anthropic/utils.js';
import type { Context, Model, BaseAssistantMessage, Tool, UserMessage, ToolResultMessage } from '../../../../src/types.js';
import type { Message as AnthropicMessage } from '@anthropic-ai/sdk/resources/messages.js';
import { Type } from '@sinclair/typebox';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProviderOptions } from '../../../../src/providers/anthropic/types.js';

describe('Anthropic Utils', () => {
	describe('createClient', () => {
		const originalEnv = { ...process.env };

		afterEach(() => {
			process.env = { ...originalEnv };
		});

		const mockModel: Model<'anthropic'> = {
			id: 'claude-sonnet-4-5',
			name: 'Claude Sonnet 4.5',
			api: 'anthropic',
			baseUrl: 'https://api.anthropic.com',
			reasoning: true,
			input: ['text', 'image'],
			cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
			contextWindow: 200000,
			maxTokens: 64000,
			tools: ['function_calling'],
		};

		it('should create client with provided API key', () => {
			const { client, isOAuthToken } = createClient(mockModel, 'test-api-key');
			expect(client).toBeInstanceOf(Anthropic);
			expect(isOAuthToken).toBe(false);
		});

		it('should use ANTHROPIC_API_KEY env var when no key provided', () => {
			process.env.ANTHROPIC_API_KEY = 'env-api-key';
			const { client, isOAuthToken } = createClient(mockModel);
			expect(client).toBeInstanceOf(Anthropic);
			expect(isOAuthToken).toBe(false);
		});

		it('should throw when no API key available', () => {
			delete process.env.ANTHROPIC_API_KEY;
			expect(() => createClient(mockModel)).toThrow(/API key is required/);
		});

		it('should detect OAuth tokens (sk-ant-oat prefix)', () => {
			const { client, isOAuthToken } = createClient(mockModel, 'sk-ant-oat-test-token');
			expect(client).toBeInstanceOf(Anthropic);
			expect(isOAuthToken).toBe(true);
		});

		it('should set baseURL from model', () => {
			const customModel: Model<'anthropic'> = {
				...mockModel,
				baseUrl: 'https://custom.api.com',
			};
			const { client } = createClient(customModel, 'test-key');
			expect(client.baseURL).toBe('https://custom.api.com');
		});

		it('should set custom headers from model', () => {
			const customModel: Model<'anthropic'> = {
				...mockModel,
				headers: { 'X-Custom-Header': 'value' },
			};
			const { client } = createClient(customModel, 'test-key');
			expect(client).toBeInstanceOf(Anthropic);
		});

		it('should enable dangerouslyAllowBrowser', () => {
			const { client } = createClient(mockModel, 'test-key');
			expect(client).toBeInstanceOf(Anthropic);
		});

		it('should include beta headers for non-OAuth tokens', () => {
			const { client } = createClient(mockModel, 'test-key', true);
			expect(client).toBeInstanceOf(Anthropic);
		});

		it('should include oauth beta header for OAuth tokens', () => {
			const { client } = createClient(mockModel, 'sk-ant-oat-test', true);
			expect(client).toBeInstanceOf(Anthropic);
		});
	});

	describe('buildAnthropicMessages', () => {
		const mockModel: Model<'anthropic'> = {
			id: 'claude-sonnet-4-5',
			name: 'Claude Sonnet 4.5',
			api: 'anthropic',
			baseUrl: 'https://api.anthropic.com',
			reasoning: true,
			input: ['text', 'image'],
			cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
			contextWindow: 200000,
			maxTokens: 64000,
			tools: ['function_calling'],
		};

		describe('user messages', () => {
			it('should convert user text to text block', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: 'Hello Claude' }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildAnthropicMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					content: [{ type: 'text', text: 'Hello Claude' }],
				});
			});

			it('should convert user image to image block with base64 source', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'What is this?' },
						{ type: 'image', data: 'base64data', mimeType: 'image/png' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content).toEqual([
					{ type: 'text', text: 'What is this?' },
					{
						type: 'image',
						source: {
							type: 'base64',
							media_type: 'image/png',
							data: 'base64data',
						},
					},
				]);
			});

			it('should skip image if model does not support images', () => {
				const modelNoImage: Model<'anthropic'> = {
					...mockModel,
					input: ['text'], // No image support
				};
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'Hello' },
						{ type: 'image', data: 'base64data', mimeType: 'image/png' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildAnthropicMessages(modelNoImage, context);
				expect((result[0] as any).content).toEqual([{ type: 'text', text: 'Hello' }]);
			});

			it('should sanitize unicode in text content', () => {
				const unpaired = String.fromCharCode(0xD83D);
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: `Hello ${unpaired} World` }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content[0].text).toBe('Hello  World');
			});

			it('should handle multiple content items', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'First' },
						{ type: 'text', content: 'Second' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content.length).toBe(2);
			});

			it('should support all image mimeTypes', () => {
				const mimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

				for (const mimeType of mimeTypes) {
					const userMessage: UserMessage = {
						role: 'user',
						id: 'msg-1',
						content: [{ type: 'image', data: 'data', mimeType }],
					};
					const context: Context = { messages: [userMessage] };

					const result = buildAnthropicMessages(mockModel, context);
					expect((result[0] as any).content[0].source.media_type).toBe(mimeType);
				}
			});
		});

		describe('tool result messages', () => {
			it('should convert tool result to tool_result block', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'search',
					content: [{ type: 'text', content: 'Result data' }],
					isError: false,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildAnthropicMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					content: [{
						type: 'tool_result',
						tool_use_id: 'call-1',
						content: 'Result data',
						is_error: false,
					}],
				});
			});

			it('should prefix error tool results with [TOOL ERROR]', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'search',
					content: [{ type: 'text', content: 'Something went wrong' }],
					isError: true,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content[0].content).toBe('[TOOL ERROR] Something went wrong');
				expect((result[0] as any).content[0].is_error).toBe(true);
			});

			it('should handle empty tool result content', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'search',
					content: [],
					isError: false,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content[0].content).toBe('');
			});

			it('should add error placeholder for empty error results', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'search',
					content: [],
					isError: true,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content[0].content).toBe('[TOOL ERROR]');
			});

			it('should combine multiple text content items', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'search',
					content: [
						{ type: 'text', content: 'First' },
						{ type: 'text', content: 'Second' },
					],
					isError: false,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildAnthropicMessages(mockModel, context);
				expect((result[0] as any).content[0].content).toBe('First\nSecond');
			});
		});

		describe('assistant messages', () => {
			it('should convert Anthropic assistant messages (preserves native)', () => {
				const assistantMessage: BaseAssistantMessage<'anthropic'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'anthropic',
					model: mockModel,
					timestamp: Date.now(),
					duration: 100,
					stopReason: 'stop',
					content: [],
					usage: {
						input: 10,
						output: 20,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 30,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					message: {
						id: 'msg-1',
						type: 'message',
						role: 'assistant',
						content: [{ type: 'text', text: 'Hello' }],
						model: 'claude-sonnet-4-5',
						stop_reason: 'end_turn',
						stop_sequence: null,
						usage: {
							input_tokens: 10,
							output_tokens: 20,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					} as AnthropicMessage,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildAnthropicMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'assistant',
					content: [{ type: 'text', text: 'Hello' }],
				});
			});

			it('should handle tool_use in assistant messages', () => {
				const assistantMessage: BaseAssistantMessage<'anthropic'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'anthropic',
					model: mockModel,
					timestamp: Date.now(),
					duration: 100,
					stopReason: 'toolUse',
					content: [],
					usage: {
						input: 10,
						output: 20,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 30,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					message: {
						id: 'msg-1',
						type: 'message',
						role: 'assistant',
						content: [
							{
								type: 'tool_use',
								id: 'call-1',
								name: 'search',
								input: { query: 'test' },
							},
						],
						model: 'claude-sonnet-4-5',
						stop_reason: 'tool_use',
						stop_sequence: null,
						usage: {
							input_tokens: 10,
							output_tokens: 20,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					} as AnthropicMessage,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildAnthropicMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'assistant',
					content: [
						{
							type: 'tool_use',
							id: 'call-1',
							name: 'search',
							input: { query: 'test' },
						},
					],
				});
			});

			describe('cross-provider handoff', () => {
				it('should convert OpenAI assistant text response to Anthropic format', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4', api: 'openai' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'response',
								content: [{ type: 'text', content: 'Hello from GPT!' }],
							},
						],
						usage: {
							input: 10,
							output: 20,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 30,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildAnthropicMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'assistant',
						content: [{ type: 'text', text: 'Hello from GPT!' }],
					});
				});

				it('should convert OpenAI assistant thinking to Anthropic format with thinking tags', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-5', api: 'openai' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'thinking',
								thinkingText: 'Let me analyze this problem...',
							},
							{
								type: 'response',
								content: [{ type: 'text', content: 'The answer is 42.' }],
							},
						],
						usage: {
							input: 10,
							output: 20,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 30,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildAnthropicMessages(mockModel, context);
                    console.log(result)
					expect(result[0]).toEqual({
						role: 'assistant',
						content: [{ type: 'text', text: '<thinking>Let me analyze this problem...</thinking>' }, { type: 'text', text: 'The answer is 42.' }],
					});
				});

				it('should convert Google assistant tool calls to Anthropic format', () => {
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-3-pro', api: 'google' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'toolUse',
						content: [
							{
								type: 'toolCall',
								toolCallId: 'call-123',
								name: 'get_weather',
								arguments: { location: 'San Francisco' },
							},
						],
						usage: {
							input: 10,
							output: 20,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 30,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildAnthropicMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'assistant',
						content: [
							{
								type: 'tool_use',
								id: 'call-123',
								name: 'get_weather',
								input: { location: 'San Francisco' },
							},
						],
					});
				});

				it('should handle mixed content from cross-provider messages', () => {
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-3-pro', api: 'google' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'toolUse',
						content: [
							{
								type: 'response',
								content: [{ type: 'text', content: 'I will search for that.' }],
							},
							{
								type: 'toolCall',
								toolCallId: 'call-456',
								name: 'search',
								arguments: { query: 'test' },
							},
						],
						usage: {
							input: 10,
							output: 20,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 30,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildAnthropicMessages(mockModel, context);
					expect(result.length).toBe(1);
					expect((result[0] as any).content.length).toBe(2);
					expect((result[0] as any).content[0].type).toBe('text');
					expect((result[0] as any).content[1].type).toBe('tool_use');
				});

				it('should sanitize unicode in cross-provider messages', () => {
					const unpaired = String.fromCharCode(0xD83D);
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-3-pro', api: 'google' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'response',
								content: [{ type: 'text', content: `Hello ${unpaired} World` }],
							},
						],
						usage: {
							input: 10,
							output: 20,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 30,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildAnthropicMessages(mockModel, context);
					expect((result[0] as any).content[0].text).toBe('Hello  World');
				});

				it('should skip empty text responses from cross-provider messages', () => {
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-3-pro', api: 'google' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'response',
								content: [{ type: 'text', content: '' }],
							},
						],
						usage: {
							input: 10,
							output: 20,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 30,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildAnthropicMessages(mockModel, context);
					expect(result.length).toBe(0);
				});
			});
		});
	});

	describe('buildParams', () => {
		const mockModel: Model<'anthropic'> = {
			id: 'claude-sonnet-4-5',
			name: 'Claude Sonnet 4.5',
			api: 'anthropic',
			baseUrl: 'https://api.anthropic.com',
			reasoning: true,
			input: ['text'],
			cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
			contextWindow: 200000,
			maxTokens: 64000,
			tools: ['function_calling'],
		};

		it('should set model ID', () => {
			const context: Context = { messages: [] };
			const options: AnthropicProviderOptions = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, false);
			expect(result.model).toBe('claude-sonnet-4-5');
		});

		it('should set stream to false', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, false);
			expect(result.stream).toBe(false);
		});

		it('should set max_tokens from model', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options, false);
			expect(result.max_tokens).toBe(64000);
		});

		it('should use custom max_tokens if provided', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined, max_tokens: 1000 };

			const result = buildParams(mockModel, context, options, false);
			expect(result.max_tokens).toBe(1000);
		});

		it('should add system prompt with cache control for non-OAuth', () => {
			const context: Context = {
				messages: [],
				systemPrompt: 'You are a helpful assistant',
			};
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, false);
			expect(result.system).toEqual([
				{
					type: 'text',
					text: 'You are a helpful assistant',
					cache_control: { type: 'ephemeral' },
				},
			]);
		});

		it('should add Claude Code identity for OAuth tokens', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, true);
			expect(result.system).toEqual([
				{
					type: 'text',
					text: 'You are Claude Code, Anthropic\'s official CLI for Claude.',
					cache_control: { type: 'ephemeral' },
				},
			]);
		});

		it('should add both Claude Code identity and system prompt for OAuth', () => {
			const context: Context = {
				messages: [],
				systemPrompt: 'Additional instructions',
			};
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, true);
			expect(result.system?.length).toBe(2);
			expect((result.system as any)[0].text).toContain('Claude Code');
			expect((result.system as any)[1].text).toBe('Additional instructions');
		});

		it('should convert tools when model supports function_calling', () => {
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({ query: Type.String() }),
			};
			const context: Context = { messages: [], tools: [tool] };
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, false);
			expect(result.tools).toBeDefined();
			expect(result.tools?.length).toBeGreaterThan(0);
		});

		it('should not add tools when model does not support function_calling', () => {
			const modelNoTools: Model<'anthropic'> = {
				...mockModel,
				tools: [], // No function_calling
			};
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({ query: Type.String() }),
			};
			const context: Context = { messages: [], tools: [tool] };
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(modelNoTools, context, options, false);
			expect(result.tools).toBeUndefined();
		});

		it('should pass through other options', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				temperature: 0.7,
				top_p: 0.9,
			} as any;

			const result = buildParams(mockModel, context, options, false);
			expect(result.temperature).toBe(0.7);
			expect(result.top_p).toBe(0.9);
		});

		it('should not include apiKey or signal in params', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test-key', signal: new AbortController().signal, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, false);
			expect(result).not.toHaveProperty('apiKey');
			expect(result).not.toHaveProperty('signal');
		});

		it('should sanitize unicode in system prompt', () => {
			const unpaired = String.fromCharCode(0xD83D);
			const context: Context = {
				messages: [],
				systemPrompt: `Hello ${unpaired} World`,
			};
			const options = { apiKey: 'test', signal: undefined, max_tokens: 8000 };

			const result = buildParams(mockModel, context, options, false);
			expect((result.system as any)[0].text).toBe('Hello  World');
		});
	});

	describe('getResponseAssistantResponse', () => {
		it('should extract text from text block', () => {
			const response: AnthropicMessage = {
				id: 'msg-1',
				type: 'message',
				role: 'assistant',
				content: [{ type: 'text', text: 'Hello, world!' }],
				model: 'claude-sonnet-4-5',
				stop_reason: 'end_turn',
				stop_sequence: null,
				usage: {
					input_tokens: 10,
					output_tokens: 20,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'text', content: 'Hello, world!' }],
				},
			]);
		});

		it('should extract thinking blocks', () => {
			const response: AnthropicMessage = {
				id: 'msg-1',
				type: 'message',
				role: 'assistant',
				content: [
					{ type: 'thinking', thinking: 'Let me think...' } as any,
				],
				model: 'claude-sonnet-4-5',
				stop_reason: 'end_turn',
				stop_sequence: null,
				usage: {
					input_tokens: 10,
					output_tokens: 20,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'thinking',
					thinkingText: 'Let me think...',
				},
			]);
		});

		it('should extract redacted thinking blocks', () => {
			const response: AnthropicMessage = {
				id: 'msg-1',
				type: 'message',
				role: 'assistant',
				content: [
					{ type: 'redacted_thinking', data: 'summary' } as any,
				],
				model: 'claude-sonnet-4-5',
				stop_reason: 'end_turn',
				stop_sequence: null,
				usage: {
					input_tokens: 10,
					output_tokens: 20,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'thinking',
					thinkingText: '[Redacted: summary]',
				},
			]);
		});

		it('should extract tool_use to toolCall', () => {
			const response: AnthropicMessage = {
				id: 'msg-1',
				type: 'message',
				role: 'assistant',
				content: [
					{
						type: 'tool_use',
						id: 'call-123',
						name: 'search',
						input: { query: 'test' },
					},
				],
				model: 'claude-sonnet-4-5',
				stop_reason: 'tool_use',
				stop_sequence: null,
				usage: {
					input_tokens: 10,
					output_tokens: 20,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'toolCall',
					toolCallId: 'call-123',
					name: 'search',
					arguments: { query: 'test' },
				},
			]);
		});

		it('should handle empty content', () => {
			const response: AnthropicMessage = {
				id: 'msg-1',
				type: 'message',
				role: 'assistant',
				content: [],
				model: 'claude-sonnet-4-5',
				stop_reason: 'end_turn',
				stop_sequence: null,
				usage: {
                    input_tokens: 0,
                    output_tokens: 0,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                    cache_creation: null,
                    server_tool_use: null,
                    service_tier: null
				},
			} as AnthropicMessage;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([]);
		});

		it('should handle multiple content blocks', () => {
			const response: AnthropicMessage = {
				id: 'msg-1',
				type: 'message',
				role: 'assistant',
				content: [
					{ type: 'thinking', thinking: 'Thinking...' } as any,
					{ type: 'text', text: 'Answer' },
				],
				model: 'claude-sonnet-4-5',
				stop_reason: 'end_turn',
				stop_sequence: null,
				usage: {
					input_tokens: 10,
					output_tokens: 20,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseAssistantResponse(response);
			expect(result.length).toBe(2);
			expect(result[0].type).toBe('thinking');
			expect(result[1].type).toBe('response');
		});
	});

	describe('getResponseUsage', () => {
		const mockModel: Model<'anthropic'> = {
			id: 'claude-sonnet-4-5',
			name: 'Claude Sonnet 4.5',
			api: 'anthropic',
			baseUrl: 'https://api.anthropic.com',
			reasoning: true,
			input: ['text'],
			cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
			contextWindow: 200000,
			maxTokens: 64000,
			tools: [],
		};

		it('should calculate input tokens', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.input).toBe(1000);
		});

		it('should calculate output tokens', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.output).toBe(500);
		});

		it('should extract cache_read_input_tokens to cacheRead', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 200,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheRead).toBe(200);
		});

		it('should extract cache_creation_input_tokens to cacheWrite', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_creation_input_tokens: 100,
					cache_read_input_tokens: 0,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheWrite).toBe(100);
		});

		it('should calculate total tokens', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_creation_input_tokens: 100,
					cache_read_input_tokens: 200,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.totalTokens).toBe(1800); // 1000 + 500 + 100 + 200
		});

		it('should calculate costs', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_creation_input_tokens: 100,
					cache_read_input_tokens: 200,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.cost.total).toBeGreaterThan(0);
			expect(result.cost.input).toBeGreaterThan(0);
			expect(result.cost.output).toBeGreaterThan(0);
			expect(result.cost.cacheRead).toBeGreaterThan(0);
			expect(result.cost.cacheWrite).toBeGreaterThan(0);
		});

		it('should handle missing cache tokens', () => {
			const response: AnthropicMessage = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
				},
			} as AnthropicMessage;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheRead).toBe(0);
			expect(result.cacheWrite).toBe(0);
		});
	});

	describe('mapStopReason', () => {
		it('should map end_turn to stop', () => {
			expect(mapStopReason('end_turn')).toBe('stop');
		});

		it('should map max_tokens to length', () => {
			expect(mapStopReason('max_tokens')).toBe('length');
		});

		it('should map tool_use to toolUse', () => {
			expect(mapStopReason('tool_use')).toBe('toolUse');
		});

		it('should map refusal to error', () => {
			expect(mapStopReason('refusal')).toBe('error');
		});

		it('should map pause_turn to stop', () => {
			expect(mapStopReason('pause_turn')).toBe('stop');
		});

		it('should map stop_sequence to stop', () => {
			expect(mapStopReason('stop_sequence')).toBe('stop');
		});
	});
});
