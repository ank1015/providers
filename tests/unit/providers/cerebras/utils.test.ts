import { describe, it, expect, afterEach } from 'vitest';
import {
	createClient,
	buildCerebrasMessages,
	buildParams,
	convertTools,
	getResponseAssistantResponse,
	getResponseUsage,
	getAssistantStopReason,
	mapStopReason,
	getMockCerebrasMessage,
} from '../../../../src/providers/cerebras/utils.js';
import type { Context, Model, BaseAssistantMessage, Tool, UserMessage, ToolResultMessage } from '../../../../src/types.js';
import type { ChatCompletion } from 'openai/resources/chat/completions.js';
import { Type } from '@sinclair/typebox';
import OpenAI from 'openai';

describe('Cerebras Utils', () => {
	describe('createClient', () => {
		const originalEnv = { ...process.env };

		afterEach(() => {
			process.env = { ...originalEnv };
		});

		const mockModel: Model<'cerebras'> = {
			id: 'zai-glm-4.7',
			name: 'Z.ai GLM 4.7',
			api: 'cerebras',
			baseUrl: 'https://api.cerebras.ai/v1',
			reasoning: true,
			input: ['text'],
			cost: { input: 2.25, output: 2.75, cacheRead: 2.25, cacheWrite: 0 },
			contextWindow: 131000,
			maxTokens: 40000,
			tools: ['function_calling'],
		};

		it('should create client with provided API key', () => {
			const client = createClient(mockModel, 'test-api-key');
			expect(client).toBeInstanceOf(OpenAI);
		});

		it('should use CEREBRAS_API_KEY env var when no key provided', () => {
			process.env.CEREBRAS_API_KEY = 'env-api-key';
			const client = createClient(mockModel);
			expect(client).toBeInstanceOf(OpenAI);
		});

		it('should throw when no API key available', () => {
			delete process.env.CEREBRAS_API_KEY;
			expect(() => createClient(mockModel)).toThrow(/API key is required/);
		});

		it('should set baseURL from model', () => {
			const customModel: Model<'cerebras'> = {
				...mockModel,
				baseUrl: 'https://custom.cerebras.ai/v1',
			};
			const client = createClient(customModel, 'test-key');
			expect(client.baseURL).toBe('https://custom.cerebras.ai/v1');
		});

		it('should set custom headers from model', () => {
			const customModel: Model<'cerebras'> = {
				...mockModel,
				headers: { 'X-Custom-Header': 'value' },
			};
			const client = createClient(customModel, 'test-key');
			expect(client).toBeInstanceOf(OpenAI);
		});
	});

	describe('buildCerebrasMessages', () => {
		const mockModel: Model<'cerebras'> = {
			id: 'zai-glm-4.7',
			name: 'Z.ai GLM 4.7',
			api: 'cerebras',
			baseUrl: 'https://api.cerebras.ai/v1',
			reasoning: true,
			input: ['text'],
			cost: { input: 2.25, output: 2.75, cacheRead: 2.25, cacheWrite: 0 },
			contextWindow: 131000,
			maxTokens: 40000,
			tools: ['function_calling'],
		};

		describe('system prompt', () => {
			it('should convert system prompt to system role', () => {
				const context: Context = {
					messages: [],
					systemPrompt: 'You are a helpful assistant',
				};

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'system',
					content: 'You are a helpful assistant',
				});
			});

			it('should not add system message when no system prompt', () => {
				const context: Context = {
					messages: [],
				};

				const result = buildCerebrasMessages(mockModel, context);
				expect(result.length).toBe(0);
			});

			it('should sanitize unicode in system prompt', () => {
				const unpaired = String.fromCharCode(0xD83D);
				const context: Context = {
					messages: [],
					systemPrompt: `Hello ${unpaired} World`,
				};

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0].content).toBe('Hello  World');
			});
		});

		describe('user messages', () => {
			it('should convert user text to content string', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: 'Hello' }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					content: 'Hello',
				});
			});

			it('should concatenate multiple text contents', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'Hello' },
						{ type: 'text', content: 'World' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					content: 'Hello\nWorld',
				});
			});

			it('should sanitize unicode in text content', () => {
				const unpaired = String.fromCharCode(0xD83D);
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: `Hello ${unpaired} World` }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0].content).toBe('Hello  World');
			});

			it('should skip non-text content types', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'Hello' },
						{ type: 'image', data: 'base64data', mimeType: 'image/png' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0].content).toBe('Hello');
			});
		});

		describe('tool result messages', () => {
			it('should convert tool result to tool role message', () => {
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

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'tool',
					tool_call_id: 'call-1',
					content: 'Result data',
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

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0].content).toBe('[TOOL ERROR] Something went wrong');
			});

			it('should handle empty tool results', () => {
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

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'tool',
					tool_call_id: 'call-1',
					content: '',
				});
			});

			it('should handle error tool results with no content', () => {
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

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0].content).toBe('[TOOL ERROR]');
			});
		});

		describe('assistant messages', () => {
			it('should convert Cerebras assistant messages (preserves native)', () => {
				const mockChatCompletion: any = {
					id: 'chatcmpl-123',
					object: 'chat.completion',
					created: Date.now(),
					model: 'zai-glm-4.7',
					choices: [{
						index: 0,
						message: {
							role: 'assistant',
							content: 'Hello from Cerebras!',
						},
						finish_reason: 'stop',
						logprobs: null,
					}],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				};

				const assistantMessage: BaseAssistantMessage<'cerebras'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'cerebras',
					model: mockModel,
					timestamp: Date.now(),
					duration: 100,
					stopReason: 'stop',
					content: [{ type: 'response', content: [{ type: 'text', content: 'Hello from Cerebras!' }] }],
					usage: {
						input: 10,
						output: 5,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 15,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					message: mockChatCompletion,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'assistant',
					content: 'Hello from Cerebras!',
				});
			});

			it('should handle assistant messages with tool calls', () => {
				const mockChatCompletion: any = {
					id: 'chatcmpl-123',
					object: 'chat.completion',
					created: Date.now(),
					model: 'zai-glm-4.7',
					choices: [{
						index: 0,
						message: {
							role: 'assistant',
							content: null,
							tool_calls: [{
								id: 'call-123',
								type: 'function',
								function: {
									name: 'search',
									arguments: '{"query": "test"}',
								},
							}],
						},
						finish_reason: 'tool_calls',
						logprobs: null,
					}],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				};

				const assistantMessage: BaseAssistantMessage<'cerebras'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'cerebras',
					model: mockModel,
					timestamp: Date.now(),
					duration: 100,
					stopReason: 'toolUse',
					content: [{ type: 'toolCall', toolCallId: 'call-123', name: 'search', arguments: { query: 'test' } }],
					usage: {
						input: 10,
						output: 5,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 15,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					message: mockChatCompletion,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildCerebrasMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'assistant',
					content: null,
					tool_calls: [{
						id: 'call-123',
						type: 'function',
						function: {
							name: 'search',
							arguments: '{"query": "test"}',
						},
					}],
				});
			});

			describe('cross-provider handoff', () => {
				it('should convert Google assistant text response to Cerebras format', () => {
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-2.0-flash', api: 'google' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'response',
								content: [{ type: 'text', content: 'Hello from Gemini!' }],
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

					const result = buildCerebrasMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'assistant',
						content: 'Hello from Gemini!',
					});
				});

				it('should convert cross-provider thinking to <think> tags for Cerebras', () => {
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-2.0-flash-thinking', api: 'google' } as any,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'thinking',
								thinkingText: 'Let me analyze this...',
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

					const result = buildCerebrasMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'assistant',
						content: '<think>Let me analyze this...</think>The answer is 42.',
					});
				});

				it('should convert cross-provider tool calls to Cerebras format', () => {
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-2.0-flash', api: 'google' } as any,
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

					const result = buildCerebrasMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'assistant',
						content: null,
						tool_calls: [{
							id: 'call-123',
							type: 'function',
							function: {
								name: 'get_weather',
								arguments: '{"location":"San Francisco"}',
							},
						}],
					});
				});

				it('should sanitize unicode in cross-provider messages', () => {
					const unpaired = String.fromCharCode(0xD83D);
					const assistantMessage: BaseAssistantMessage<'google'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'google',
						model: { id: 'gemini-2.0-flash', api: 'google' } as any,
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

					const result = buildCerebrasMessages(mockModel, context);
					expect(result[0].content).toBe('Hello  World');
				});
			});
		});
	});

	describe('buildParams', () => {
		const mockModel: Model<'cerebras'> = {
			id: 'zai-glm-4.7',
			name: 'Z.ai GLM 4.7',
			api: 'cerebras',
			baseUrl: 'https://api.cerebras.ai/v1',
			reasoning: true,
			input: ['text'],
			cost: { input: 2.25, output: 2.75, cacheRead: 2.25, cacheWrite: 0 },
			contextWindow: 131000,
			maxTokens: 40000,
			tools: ['function_calling'],
		};

		it('should set model ID', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.model).toBe('zai-glm-4.7');
		});

		it('should set stream to false', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.stream).toBe(false);
		});

		it('should add reasoning_format=parsed by default for reasoning models', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options) as any;
			expect(result.reasoning_format).toBe('parsed');
		});

		it('should pass through custom reasoning_format', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				reasoning_format: 'raw' as const
			};

			const result = buildParams(mockModel, context, options) as any;
			expect(result.reasoning_format).toBe('raw');
		});

		it('should pass through reasoning_effort parameter (GPT-OSS specific)', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				reasoning_effort: 'high' as const
			};

			const result = buildParams(mockModel, context, options) as any;
			expect(result.reasoning_effort).toBe('high');
		});

		it('should pass through disable_reasoning parameter (GLM specific)', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				disable_reasoning: true
			};

			const result = buildParams(mockModel, context, options) as any;
			expect(result.disable_reasoning).toBe(true);
		});

		it('should pass through clear_thinking parameter (GLM specific)', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				clear_thinking: false
			};

			const result = buildParams(mockModel, context, options) as any;
			expect(result.clear_thinking).toBe(false);
		});

		it('should convert tools when model supports function_calling', () => {
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({ query: Type.String() }),
			};
			const context: Context = { messages: [], tools: [tool] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.tools).toBeDefined();
			expect(result.tools?.length).toBeGreaterThan(0);
		});

		it('should not add tools when model does not support function_calling', () => {
			const modelNoTools: Model<'cerebras'> = {
				...mockModel,
				tools: [],
			};
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({ query: Type.String() }),
			};
			const context: Context = { messages: [], tools: [tool] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(modelNoTools, context, options);
			expect(result.tools).toBeUndefined();
		});

		it('should merge provider option tools', () => {
			const contextTool: Tool = {
				name: 'search',
				description: 'Search',
				parameters: Type.Object({}),
			};
			const optionTool = {
				type: 'function' as const,
				function: {
					name: 'extra',
					description: 'Extra tool',
					parameters: {},
				},
			};
			const context: Context = { messages: [], tools: [contextTool] };
			const options = { apiKey: 'test', signal: undefined, tools: [optionTool] };

			const result = buildParams(mockModel, context, options);
			expect(result.tools?.length).toBe(2);
		});

		it('should pass through other options', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				temperature: 0.7,
				max_tokens: 2000,
			} as any;

			const result = buildParams(mockModel, context, options);
			expect(result.temperature).toBe(0.7);
			expect(result.max_tokens).toBe(2000);
		});

		it('should not include apiKey or signal in params', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test-key', signal: new AbortController().signal };

			const result = buildParams(mockModel, context, options);
			expect(result).not.toHaveProperty('apiKey');
			expect(result).not.toHaveProperty('signal');
		});
	});

	describe('convertTools', () => {
		it('should convert TypeBox schema to chat completion format with strict mode', () => {
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({
					query: Type.String(),
					limit: Type.Number(),
				}),
			};

			const result = convertTools([tool]);
			expect(result[0]).toEqual({
				type: 'function',
				function: {
					name: 'search',
					description: 'Search the web',
					parameters: tool.parameters,
					strict: true, // Cerebras supports strict mode
				},
			});
		});

		it('should convert multiple tools', () => {
			const tools: Tool[] = [
				{ name: 'tool1', description: 'First', parameters: Type.Object({}) },
				{ name: 'tool2', description: 'Second', parameters: Type.Object({}) },
			];

			const result = convertTools(tools);
			expect(result.length).toBe(2);
			expect((result[0] as any).function.name).toBe('tool1');
			expect((result[1] as any).function.name).toBe('tool2');
		});
	});

	describe('getResponseAssistantResponse', () => {
		it('should extract text content', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: {
						role: 'assistant',
						content: 'Hello, world!',
						refusal: null,
					},
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			};

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'text', content: 'Hello, world!' }],
				},
			]);
		});

		it('should extract reasoning as thinking (Cerebras uses "reasoning" field)', () => {
			const response = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: {
						role: 'assistant',
						content: 'The answer is 42.',
						reasoning: 'Let me think about this...' as any,
						refusal: null,
					},
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			} as any;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'thinking',
					thinkingText: 'Let me think about this...',
				},
				{
					type: 'response',
					content: [{ type: 'text', content: 'The answer is 42.' }],
				},
			]);
		});

		it('should extract tool calls', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: {
						role: 'assistant',
						content: null,
						refusal: null,
						tool_calls: [{
							id: 'call-123',
							type: 'function',
							function: {
								name: 'search',
								arguments: '{"query": "test"}',
							},
						}],
					},
					finish_reason: 'tool_calls',
					logprobs: null,
				}],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			};

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

		it('should handle multiple tool calls', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: {
						role: 'assistant',
						content: null,
						refusal: null,
						tool_calls: [
							{
								id: 'call-1',
								type: 'function',
								function: { name: 'tool1', arguments: '{}' },
							},
							{
								id: 'call-2',
								type: 'function',
								function: { name: 'tool2', arguments: '{}' },
							},
						],
					},
					finish_reason: 'tool_calls',
					logprobs: null,
				}],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			};

			const result = getResponseAssistantResponse(response);
			expect(result.length).toBe(2);
			expect(result[0].type).toBe('toolCall');
			expect(result[1].type).toBe('toolCall');
		});

		it('should handle empty choices', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [],
				usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
			};

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([]);
		});
	});

	describe('getResponseUsage', () => {
		const mockModel: Model<'cerebras'> = {
			id: 'zai-glm-4.7',
			name: 'Z.ai GLM 4.7',
			api: 'cerebras',
			baseUrl: 'https://api.cerebras.ai/v1',
			reasoning: true,
			input: ['text'],
			cost: { input: 2.25, output: 2.75, cacheRead: 2.25, cacheWrite: 0 },
			contextWindow: 131000,
			maxTokens: 40000,
			tools: [],
		};

		it('should calculate input tokens', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: {
					prompt_tokens: 1000,
					completion_tokens: 500,
					total_tokens: 1500,
				},
			};

			const result = getResponseUsage(response, mockModel);
			expect(result.input).toBe(1000);
		});

		it('should calculate output tokens', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: {
					prompt_tokens: 1000,
					completion_tokens: 500,
					total_tokens: 1500,
				},
			};

			const result = getResponseUsage(response, mockModel);
			expect(result.output).toBe(500);
		});

		it('should extract cache hit tokens from prompt_tokens_details.cached_tokens', () => {
			const response = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: {
					prompt_tokens: 1000,
					completion_tokens: 500,
					total_tokens: 1500,
					prompt_tokens_details: {
						cached_tokens: 200,
					},
				},
			} as ChatCompletion;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheRead).toBe(200);
			expect(result.input).toBe(800); // 1000 - 200
		});

		it('should set cacheWrite to 0', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: {
					prompt_tokens: 1000,
					completion_tokens: 500,
					total_tokens: 1500,
				},
			};

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheWrite).toBe(0);
		});

		it('should calculate costs', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: {
					prompt_tokens: 1000,
					completion_tokens: 500,
					total_tokens: 1500,
				},
			};

			const result = getResponseUsage(response, mockModel);
			expect(result.cost.total).toBeGreaterThan(0);
		});

		it('should handle missing usage', () => {
			const response = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
			} as ChatCompletion;

			const result = getResponseUsage(response, mockModel);
			expect(result.input).toBe(0);
			expect(result.output).toBe(0);
		});
	});

	describe('getAssistantStopReason', () => {
		it('should return stop reason from response', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: 'Hello', refusal: null },
					finish_reason: 'stop',
					logprobs: null,
				}],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			};

			const result = getAssistantStopReason(response);
			expect(result).toBe('stop');
		});

		it('should return toolUse for tool_calls finish reason', () => {
			const response: ChatCompletion = {
				id: 'chatcmpl-123',
				object: 'chat.completion',
				created: Date.now(),
				model: 'zai-glm-4.7',
				choices: [{
					index: 0,
					message: { role: 'assistant', content: null, refusal: null, tool_calls: [] },
					finish_reason: 'tool_calls',
					logprobs: null,
				}],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			};

			const result = getAssistantStopReason(response);
			expect(result).toBe('toolUse');
		});
	});

	describe('mapStopReason', () => {
		it('should map stop to stop', () => {
			expect(mapStopReason('stop')).toBe('stop');
		});

		it('should map length to length', () => {
			expect(mapStopReason('length')).toBe('length');
		});

		it('should map tool_calls to toolUse', () => {
			expect(mapStopReason('tool_calls')).toBe('toolUse');
		});

		it('should map content_filter to error', () => {
			expect(mapStopReason('content_filter')).toBe('error');
		});

		it('should return stop for null', () => {
			expect(mapStopReason(null)).toBe('stop');
		});

		it('should return stop for undefined', () => {
			expect(mapStopReason(undefined)).toBe('stop');
		});

		it('should return stop for unknown values', () => {
			expect(mapStopReason('unknown_reason')).toBe('stop');
		});
	});

	describe('getMockCerebrasMessage', () => {
		it('should return a valid ChatCompletion structure', () => {
			const mock = getMockCerebrasMessage();
			expect(mock.id).toBeDefined();
			expect(mock.object).toBe('chat.completion');
			expect(mock.model).toBe('zai-glm-4.7');
			expect(mock.choices).toBeDefined();
			expect(mock.choices.length).toBe(1);
			expect(mock.choices[0].message.role).toBe('assistant');
		});

		it('should have empty content', () => {
			const mock = getMockCerebrasMessage();
			expect(mock.choices[0].message.content).toBe('');
		});

		it('should have zero usage', () => {
			const mock = getMockCerebrasMessage();
			expect(mock.usage?.prompt_tokens).toBe(0);
			expect(mock.usage?.completion_tokens).toBe(0);
			expect(mock.usage?.total_tokens).toBe(0);
		});
	});
});
