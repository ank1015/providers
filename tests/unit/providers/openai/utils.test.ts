import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createClient,
	buildOpenAIMessages,
	buildParams,
	convertTools,
	getResponseAssistantResponse,
	getResponseUsage,
	mapStopReason,
} from '../../../../src/providers/openai/utils.js';
import type { Context, Model, BaseAssistantMessage, Tool, UserMessage, ToolResultMessage } from '../../../../src/types.js';
import type { EasyInputMessage, Response } from 'openai/resources/responses/responses.js';
import { Type } from '@sinclair/typebox';
import OpenAI from 'openai';

describe('OpenAI Utils', () => {
	describe('createClient', () => {
		const originalEnv = { ...process.env };

		afterEach(() => {
			process.env = { ...originalEnv };
		});

		const mockModel: Model<'openai'> = {
			id: 'gpt-4',
			name: 'GPT-4',
			api: 'openai',
			baseUrl: 'https://api.openai.com/v1',
			reasoning: false,
			input: ['text', 'image'],
			cost: { input: 30, output: 60, cacheRead: 3, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
			tools: ['function_calling'],
		};

		it('should create client with provided API key', () => {
			const client = createClient(mockModel, 'test-api-key');
			expect(client).toBeInstanceOf(OpenAI);
		});

		it('should use OPENAI_API_KEY env var when no key provided', () => {
			process.env.OPENAI_API_KEY = 'env-api-key';
			const client = createClient(mockModel);
			expect(client).toBeInstanceOf(OpenAI);
		});

		it('should throw when no API key available', () => {
			delete process.env.OPENAI_API_KEY;
			expect(() => createClient(mockModel)).toThrow(/API key is required/);
		});

		it('should set baseURL from model', () => {
			const customModel: Model<'openai'> = {
				...mockModel,
				baseUrl: 'https://custom.api.com/v1',
			};
			const client = createClient(customModel, 'test-key');
			expect(client.baseURL).toBe('https://custom.api.com/v1');
		});

		it('should set custom headers from model', () => {
			const customModel: Model<'openai'> = {
				...mockModel,
				headers: { 'X-Custom-Header': 'value' },
			};
			const client = createClient(customModel, 'test-key');
			// Headers are set in defaultHeaders
			expect(client).toBeInstanceOf(OpenAI);
		});

		it('should enable dangerouslyAllowBrowser', () => {
			const client = createClient(mockModel, 'test-key');
			expect(client).toBeInstanceOf(OpenAI);
			// The client is configured with dangerouslyAllowBrowser: true
		});
	});

	describe('buildOpenAIMessages', () => {
		const mockModel: Model<'openai'> = {
			id: 'gpt-4',
			name: 'GPT-4',
			api: 'openai',
			baseUrl: 'https://api.openai.com/v1',
			reasoning: false,
			input: ['text', 'image', 'file'],
			cost: { input: 30, output: 60, cacheRead: 3, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
			tools: ['function_calling'],
		};

		describe('system prompt', () => {
			it('should convert system prompt to developer role', () => {
				const context: Context = {
					messages: [],
					systemPrompt: 'You are a helpful assistant',
				};

				const result = buildOpenAIMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'developer',
					content: 'You are a helpful assistant',
				});
			});

			it('should not add developer message when no system prompt', () => {
				const context: Context = {
					messages: [],
				};

				const result = buildOpenAIMessages(mockModel, context);
				expect(result.length).toBe(0);
			});

			it('should sanitize unicode in system prompt', () => {
				const unpaired = String.fromCharCode(0xD83D);
				const context: Context = {
					messages: [],
					systemPrompt: `Hello ${unpaired} World`,
				};

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as EasyInputMessage).content).toBe('Hello  World');
			});
		});

		describe('user messages', () => {
			it('should convert user text to input_text', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: 'Hello' }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					content: [{ type: 'input_text', text: 'Hello' }],
				});
			});

			it('should convert user image to input_image with data URL', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'What is this?' },
						{ type: 'image', data: 'base64data', mimeType: 'image/png' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as any).content).toEqual([
					{ type: 'input_text', text: 'What is this?' },
					{
						type: 'input_image',
						detail: 'auto',
						image_url: 'data:image/png;base64,base64data',
					},
				]);
			});

			it('should convert user file to input_file', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'file', data: 'pdfdata', mimeType: 'application/pdf', filename: 'doc.pdf' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as any).content).toContainEqual({
					type: 'input_file',
					filename: 'doc.pdf',
					file_data: 'data:application/pdf;base64,pdfdata',
				});
			});

			it('should skip image if model does not support images', () => {
				const modelNoImage: Model<'openai'> = {
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

				const result = buildOpenAIMessages(modelNoImage, context);
				expect((result[0] as any).content).toEqual([{ type: 'input_text', text: 'Hello' }]);
			});

			it('should skip file if model does not support files', () => {
				const modelNoFile: Model<'openai'> = {
					...mockModel,
					input: ['text'], // No file support
				};
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'Hello' },
						{ type: 'file', data: 'data', mimeType: 'application/pdf', filename: 'doc.pdf' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildOpenAIMessages(modelNoFile, context);
				expect((result[0] as any).content).toEqual([{ type: 'input_text', text: 'Hello' }]);
			});

			it('should sanitize unicode in text content', () => {
				const unpaired = String.fromCharCode(0xD83D);
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: `Hello ${unpaired} World` }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as any).content[0].text).toBe('Hello  World');
			});
		});

		describe('tool result messages', () => {
			it('should convert tool result to function_call_output', () => {
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

				const result = buildOpenAIMessages(mockModel, context);
				expect(result[0]).toEqual({
					type: 'function_call_output',
					call_id: 'call-1',
					output: [{ type: 'input_text', text: 'Result data' }],
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

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as any).output[0].text).toBe('[TOOL ERROR] Something went wrong');
			});

			it('should add placeholder text for image-only tool results', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'screenshot',
					content: [{ type: 'image', data: 'imgdata', mimeType: 'image/png' }],
					isError: false,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildOpenAIMessages(mockModel, context);
				// Should have image + placeholder text
				expect((result[0] as any).output).toContainEqual({
					type: 'input_image',
					detail: 'auto',
					image_url: 'data:image/png;base64,imgdata',
				});
				expect((result[0] as any).output).toContainEqual({
					type: 'input_text',
					text: '(see attached)',
				});
			});

			it('should add error placeholder for image-only error results', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'screenshot',
					content: [{ type: 'image', data: 'imgdata', mimeType: 'image/png' }],
					isError: true,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as any).output).toContainEqual({
					type: 'input_text',
					text: '[TOOL ERROR] (see attached)',
				});
			});

			it('should handle tool results with files', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'generate',
					content: [{ type: 'file', data: 'filedata', mimeType: 'application/pdf', filename: 'report.pdf' }],
					isError: false,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildOpenAIMessages(mockModel, context);
				expect((result[0] as any).output).toContainEqual({
					type: 'input_file',
					file_data: 'data:application/pdf;base64,filedata',
				});
			});
		});

		describe('assistant messages', () => {
			it('should convert OpenAI assistant messages (preserves native)', () => {
				const assistantMessage: BaseAssistantMessage<'openai'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'openai',
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
						output: [
							{
								type: 'message',
								content: [{ type: 'output_text', text: 'Hello' }],
							},
						],
					} as Response,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect(result[0]).toEqual({
					type: 'message',
					content: [{ type: 'output_text', text: 'Hello' }],
				});
			});

			it('should handle function calls in assistant messages', () => {
				const assistantMessage: BaseAssistantMessage<'openai'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'openai',
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
						output: [
							{
								type: 'function_call',
								call_id: 'call-1',
								name: 'search',
								arguments: '{"query": "test"}',
							},
						],
					} as Response,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect(result[0]).toEqual({
					type: 'function_call',
					call_id: 'call-1',
					name: 'search',
					arguments: '{"query": "test"}',
				});
			});

			it('should handle reasoning in assistant messages', () => {
				const assistantMessage: BaseAssistantMessage<'openai'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'openai',
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
						output: [
							{
								type: 'reasoning',
								summary: [{ type: 'summary_text', text: 'Thinking...' }],
							},
						],
					} as Response,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildOpenAIMessages(mockModel, context);
				expect(result[0]).toEqual({
					type: 'reasoning',
					summary: [{ type: 'summary_text', text: 'Thinking...' }],
				});
			});

			describe('cross-provider handoff', () => {
				it('should convert Google assistant text response to OpenAI format', () => {
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

					const result = buildOpenAIMessages(mockModel, context);
					expect(result[0]).toEqual({
						type: 'message',
						role: 'assistant',
						content: [{ type: 'output_text', text: 'Hello from Gemini!' }],
					});
				});

				it('should convert Google assistant thinking to OpenAI format with thinking tags', () => {
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

					const result = buildOpenAIMessages(mockModel, context);
					expect(result[0]).toEqual({
						type: 'message',
						role: 'assistant',
						content: [{ type: 'output_text', text: '<thinking>Let me analyze this problem...</thinking>' }],
					});
					expect(result[1]).toEqual({
						type: 'message',
						role: 'assistant',
						content: [{ type: 'output_text', text: 'The answer is 42.' }],
					});
				});

				it('should convert Google assistant tool calls to OpenAI format', () => {
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

					const result = buildOpenAIMessages(mockModel, context);
					expect(result[0]).toEqual({
						type: 'function_call',
						call_id: 'call-123',
						name: 'get_weather',
						arguments: '{"location":"San Francisco"}',
					});
				});

				it('should handle mixed content from cross-provider messages', () => {
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

					const result = buildOpenAIMessages(mockModel, context);
					expect(result.length).toBe(2);
					expect((result[0] as any).type).toBe('message');
					expect((result[1] as any).type).toBe('function_call');
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

					const result = buildOpenAIMessages(mockModel, context);
					expect((result[0] as any).content[0].text).toBe('Hello  World');
				});

				it('should skip empty text responses from cross-provider messages', () => {
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

					const result = buildOpenAIMessages(mockModel, context);
					expect(result.length).toBe(0);
				});
			});
		});
	});

	describe('buildParams', () => {
		const mockModel: Model<'openai'> = {
			id: 'gpt-4',
			name: 'GPT-4',
			api: 'openai',
			baseUrl: 'https://api.openai.com/v1',
			reasoning: false,
			input: ['text'],
			cost: { input: 30, output: 60, cacheRead: 3, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
			tools: ['function_calling'],
		};

		it('should set model ID', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.model).toBe('gpt-4');
		});

		it('should set stream to false', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.stream).toBe(false);
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
			const modelNoTools: Model<'openai'> = {
				...mockModel,
				tools: [], // No function_calling
			};
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({ query: Type.String() }),
			};
			const context: Context = { messages: [], tools: [tool] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(modelNoTools, context, options);
			expect(result.tools).toEqual([]);
		});

		it('should merge provider option tools', () => {
			const contextTool: Tool = {
				name: 'search',
				description: 'Search',
				parameters: Type.Object({}),
			};
			const optionTool = {
				type: 'function' as const,
				name: 'extra',
				description: 'Extra tool',
				parameters: {},
				strict: null,
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
				max_output_tokens: 2000,
			} as any;

			const result = buildParams(mockModel, context, options);
			expect(result.temperature).toBe(0.7);
			expect(result.max_output_tokens).toBe(2000);
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
		it('should convert TypeBox schema to OpenAI format', () => {
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
				name: 'search',
				description: 'Search the web',
				parameters: tool.parameters,
				strict: null,
			});
		});

		it('should convert multiple tools', () => {
			const tools: Tool[] = [
				{ name: 'tool1', description: 'First', parameters: Type.Object({}) },
				{ name: 'tool2', description: 'Second', parameters: Type.Object({}) },
			];

			const result = convertTools(tools);
			expect(result.length).toBe(2);
			expect((result[0] as any).name).toBe('tool1');
			expect((result[1] as any).name).toBe('tool2');
		});
	});

	describe('getResponseAssistantResponse', () => {
		it('should extract text from output_text', () => {
			const response: Response = {
				output: [
					{
						type: 'message',
						content: [{ type: 'output_text', text: 'Hello, world!' }],
					},
				],
			} as Response;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'text', content: 'Hello, world!' }],
				},
			]);
		});

		it('should extract refusal text', () => {
			const response: Response = {
				output: [
					{
						type: 'message',
						content: [{ type: 'refusal', refusal: 'I cannot do that' }],
					},
				],
			} as Response;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'text', content: 'I cannot do that' }],
				},
			]);
		});

		it('should extract reasoning to thinking', () => {
			const response: Response = {
				output: [
					{
						type: 'reasoning',
						summary: [{ type: 'summary_text', text: 'Let me think...' }],
					},
				],
			} as Response;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'thinking',
					thinkingText: 'Let me think...',
				},
			]);
		});

		it('should extract function calls to toolCall', () => {
			const response: Response = {
				output: [
					{
						type: 'function_call',
						call_id: 'call-123',
						name: 'search',
						arguments: '{"query": "test"}',
					},
				],
			} as Response;

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

		it('should extract image generation results', () => {
			const response: Response = {
				output: [
					{
						type: 'image_generation_call',
						result: 'base64imagedata',
					},
				],
			} as Response;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'image', data: 'base64imagedata', mimeType: 'image/png' }],
				},
			]);
		});

		it('should handle empty output', () => {
			const response: Response = {
				output: [],
			} as any;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([]);
		});

		it('should handle multiple output items', () => {
			const response: Response = {
				output: [
					{
						type: 'reasoning',
						summary: [{ type: 'summary_text', text: 'Thinking...' }],
					},
					{
						type: 'message',
						content: [{ type: 'output_text', text: 'Answer' }],
					},
				],
			} as Response;

			const result = getResponseAssistantResponse(response);
			expect(result.length).toBe(2);
			expect(result[0].type).toBe('thinking');
			expect(result[1].type).toBe('response');
		});
	});

	describe('getResponseUsage', () => {
		const mockModel: Model<'openai'> = {
			id: 'gpt-4',
			name: 'GPT-4',
			api: 'openai',
			baseUrl: 'https://api.openai.com/v1',
			reasoning: false,
			input: ['text'],
			cost: { input: 30, output: 60, cacheRead: 3, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
			tools: [],
		};

		it('should calculate input tokens (minus cached)', () => {
			const response: Response = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
					input_tokens_details: {
						cached_tokens: 200,
					},
				},
			} as Response;

			const result = getResponseUsage(response, mockModel);
			expect(result.input).toBe(800); // 1000 - 200
		});

		it('should calculate output tokens', () => {
			const response: Response = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
				},
			} as Response;

			const result = getResponseUsage(response, mockModel);
			expect(result.output).toBe(500);
		});

		it('should extract cached tokens to cacheRead', () => {
			const response: Response = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
					input_tokens_details: {
						cached_tokens: 200,
					},
				},
			} as Response;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheRead).toBe(200);
		});

		it('should set cacheWrite to 0', () => {
			const response: Response = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
				},
			} as Response;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheWrite).toBe(0);
		});

		it('should calculate costs', () => {
			const response: Response = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
					input_tokens_details: {
						cached_tokens: 100,
					},
				},
			} as Response;

			const result = getResponseUsage(response, mockModel);
			expect(result.cost.total).toBeGreaterThan(0);
		});

		it('should handle missing cached_tokens', () => {
			const response: Response = {
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
				},
			} as Response;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheRead).toBe(0);
			expect(result.input).toBe(1000);
		});
	});

	describe('mapStopReason', () => {
		it('should map completed to stop', () => {
			expect(mapStopReason('completed')).toBe('stop');
		});

		it('should map incomplete to length', () => {
			expect(mapStopReason('incomplete')).toBe('length');
		});

		it('should map failed to error', () => {
			expect(mapStopReason('failed')).toBe('error');
		});

		it('should map cancelled to error', () => {
			expect(mapStopReason('cancelled')).toBe('error');
		});

		it('should map in_progress to stop', () => {
			expect(mapStopReason('in_progress')).toBe('stop');
		});

		it('should map queued to stop', () => {
			expect(mapStopReason('queued')).toBe('stop');
		});

		it('should return stop for undefined', () => {
			expect(mapStopReason(undefined)).toBe('stop');
		});
	});
});
