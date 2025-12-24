import { describe, it, expect, afterEach } from 'vitest';
import {
	createClient,
	buildGoogleMessages,
	buildParams,
	convertTools,
	transformSchemaForGoogle,
	getResponseAssistantResponse,
	getResponseUsage,
	getAssistantStopReason,
	mapStopReason,
} from '../../../../src/providers/google/utils.js';
import type { Context, Model, BaseAssistantMessage, Tool, UserMessage, ToolResultMessage } from '../../../../src/types.js';
import type { Content, ContentListUnion, GenerateContentResponse } from '@google/genai';
import { FinishReason, GoogleGenAI } from '@google/genai';
import { Type } from '@sinclair/typebox';

describe('Google Utils', () => {
	describe('createClient', () => {
		const originalEnv = { ...process.env };

		afterEach(() => {
			process.env = { ...originalEnv };
		});

		const mockModel: Model<'google'> = {
			id: 'gemini-pro',
			name: 'Gemini Pro',
			api: 'google',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
			reasoning: true,
			input: ['text', 'image', 'file'],
			cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
			contextWindow: 1048576,
			maxTokens: 65536,
			tools: ['function_calling'],
		};

		it('should create client with provided API key', () => {
			const client = createClient(mockModel, 'test-api-key');
			expect(client).toBeInstanceOf(GoogleGenAI);
		});

		it('should use GEMINI_API_KEY env var when no key provided', () => {
			process.env.GEMINI_API_KEY = 'env-api-key';
			const client = createClient(mockModel);
			expect(client).toBeInstanceOf(GoogleGenAI);
		});

		it('should throw when no API key available', () => {
			delete process.env.GEMINI_API_KEY;
			expect(() => createClient(mockModel)).toThrow(/API key is required/);
		});

		it('should set custom headers from model', () => {
			const customModel: Model<'google'> = {
				...mockModel,
				headers: { 'X-Custom-Header': 'value' },
			};
			const client = createClient(customModel, 'test-key');
			expect(client).toBeInstanceOf(GoogleGenAI);
		});
	});

	describe('buildGoogleMessages', () => {
		const mockModel: Model<'google'> = {
			id: 'gemini-pro',
			name: 'Gemini Pro',
			api: 'google',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
			reasoning: true,
			input: ['text', 'image', 'file'],
			cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
			contextWindow: 1048576,
			maxTokens: 65536,
			tools: ['function_calling'],
		};

		describe('user messages', () => {
			it('should convert user text to text part', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: 'Hello' }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					parts: [{ text: 'Hello' }],
				});
			});

			it('should convert user image to inlineData', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'text', content: 'What is this?' },
						{ type: 'image', data: 'base64data', mimeType: 'image/png' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0].parts).toEqual([
					{ text: 'What is this?' },
					{ inlineData: { mimeType: 'image/png', data: 'base64data' } },
				]);
			});

			it('should convert user file to inlineData', () => {
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [
						{ type: 'file', data: 'pdfdata', mimeType: 'application/pdf', filename: 'doc.pdf' },
					],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0].parts).toContainEqual({
					inlineData: { mimeType: 'application/pdf', data: 'pdfdata' },
				});
			});

			it('should skip image if model does not support images', () => {
				const modelNoImage: Model<'google'> = {
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

				const result = buildGoogleMessages(modelNoImage, context);
				expect(result[0].parts).toEqual([{ text: 'Hello' }]);
			});

			it('should skip file if model does not support files', () => {
				const modelNoFile: Model<'google'> = {
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

				const result = buildGoogleMessages(modelNoFile, context);
				expect(result[0].parts).toEqual([{ text: 'Hello' }]);
			});

			it('should sanitize unicode in text', () => {
				const unpaired = String.fromCharCode(0xD83D);
				const userMessage: UserMessage = {
					role: 'user',
					id: 'msg-1',
					content: [{ type: 'text', content: `Hello ${unpaired} World` }],
				};
				const context: Context = { messages: [userMessage] };

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0].parts[0].text).toBe('Hello  World');
			});
		});

		describe('tool result messages', () => {
			it('should convert tool result to functionResponse', () => {
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

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'user',
					parts: [
						{
							functionResponse: {
								id: 'call-1',
								name: 'search',
								parts: [],
								response: {
									result: 'Result data',
									isError: false,
								},
							},
						},
					],
				});
			});

			it('should include isError in functionResponse', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'search',
					content: [{ type: 'text', content: 'Error occurred' }],
					isError: true,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0].parts[0].functionResponse?.response.isError).toBe(true);
			});

			it('should handle tool results with images', () => {
				const toolResult: ToolResultMessage = {
					role: 'toolResult',
					id: 'result-1',
					toolCallId: 'call-1',
					toolName: 'screenshot',
					content: [
						{ type: 'text', content: 'Screenshot taken' },
						{ type: 'image', data: 'imgdata', mimeType: 'image/png' },
					],
					isError: false,
					timestamp: Date.now(),
				};
				const context: Context = { messages: [toolResult] };

				const result = buildGoogleMessages(mockModel, context);
				const functionResponse = result[0].parts[0].functionResponse;
				expect(functionResponse?.parts).toContainEqual({
					inlineData: { mimeType: 'image/png', data: 'imgdata' },
				});
			});

			it('should use default placeholder for image-only results', () => {
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

				const result = buildGoogleMessages(mockModel, context);
				const functionResponse = result[0].parts[0].functionResponse;
				expect(functionResponse?.response.result).toBe('(see attached:)');
			});
		});

		describe('assistant messages', () => {
			it('should convert Google assistant messages (preserves candidates)', () => {
				const assistantMessage: BaseAssistantMessage<'google'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'google',
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
						candidates: [
							{
								content: {
									role: 'model',
									parts: [{ text: 'Hello' }],
								},
							},
						],
					} as GenerateContentResponse,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildGoogleMessages(mockModel, context);
				expect(result[0]).toEqual({
					role: 'model',
					parts: [{ text: 'Hello' }],
				});
			});

			it('should handle multiple candidates', () => {
				const assistantMessage: BaseAssistantMessage<'google'> = {
					role: 'assistant',
					id: 'msg-1',
					api: 'google',
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
						candidates: [
							{ content: { role: 'model', parts: [{ text: 'First' }] } },
							{ content: { role: 'model', parts: [{ text: 'Second' }] } },
						],
					} as GenerateContentResponse,
				};
				const context: Context = { messages: [assistantMessage] };

				const result = buildGoogleMessages(mockModel, context);
				expect((result as any).length).toBe(2);
			});

			describe('cross-provider handoff', () => {
				it('should convert OpenAI assistant text response to Google format', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4o', api: 'openai' } as any,
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

					const result = buildGoogleMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'model',
						parts: [{ text: 'Hello from GPT!' }],
					});
				});

				it('should convert OpenAI assistant thinking to Google format with thinking tags', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'o1', api: 'openai' } as any,
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

					const result = buildGoogleMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'model',
						parts: [
							{ text: '<thinking>Let me analyze this problem...</thinking>', thought: true },
							{ text: 'The answer is 42.' },
						],
					});
				});

				it('should convert OpenAI assistant tool calls to Google format', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4o', api: 'openai' } as any,
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

					const result = buildGoogleMessages(mockModel, context);
					expect(result[0]).toEqual({
						role: 'model',
						parts: [
							{
								functionCall: {
									id: 'call-123',
									name: 'get_weather',
									args: { location: 'San Francisco' },
								},
							},
						],
					});
				});

				it('should handle mixed content from cross-provider messages', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4o', api: 'openai' } as any,
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

					const result = buildGoogleMessages(mockModel, context);
					expect(result[0].parts.length).toBe(2);
					expect(result[0].parts[0]).toEqual({ text: 'I will search for that.' });
					expect(result[0].parts[1]).toEqual({
						functionCall: {
							id: 'call-456',
							name: 'search',
							args: { query: 'test' },
						},
					});
				});

				it('should sanitize unicode in cross-provider messages', () => {
					const unpaired = String.fromCharCode(0xD83D);
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4o', api: 'openai' } as any,
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

					const result = buildGoogleMessages(mockModel, context);
					expect(result[0].parts[0].text).toBe('Hello  World');
				});

				it('should skip empty content from cross-provider messages', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4o', api: 'openai' } as any,
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
						message: {} as any,
					};
					const context: Context = { messages: [assistantMessage as any] };

					const result = buildGoogleMessages(mockModel, context);
					expect((result as Content[]).length).toBe(0);
				});

				it('should skip empty text responses from cross-provider messages', () => {
					const assistantMessage: BaseAssistantMessage<'openai'> = {
						role: 'assistant',
						id: 'msg-1',
						api: 'openai',
						model: { id: 'gpt-4o', api: 'openai' } as any,
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

					const result = buildGoogleMessages(mockModel, context);
					expect((result as Content[]).length).toBe(0);
				});
			});
		});
	});

	describe('buildParams', () => {
		const mockModel: Model<'google'> = {
			id: 'gemini-pro',
			name: 'Gemini Pro',
			api: 'google',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
			reasoning: true,
			input: ['text'],
			cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
			contextWindow: 1048576,
			maxTokens: 65536,
			tools: ['function_calling'],
		};

		it('should set model ID', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.model).toBe('gemini-pro');
		});

		it('should set systemInstruction from context.systemPrompt', () => {
			const context: Context = {
				messages: [],
				systemPrompt: 'You are helpful',
			};
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.config?.systemInstruction).toBe('You are helpful');
		});

		it('should set abortSignal from options.signal', () => {
			const context: Context = { messages: [] };
			const signal = new AbortController().signal;
			const options = { apiKey: 'test', signal };

			const result = buildParams(mockModel, context, options);
			expect(result.config?.abortSignal).toBe(signal);
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
			expect(result.config?.tools).toBeDefined();
			expect(result.config?.tools?.length).toBeGreaterThan(0);
		});

		it('should not add tools when model does not support function_calling', () => {
			const modelNoTools: Model<'google'> = {
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
			expect(result.config?.tools).toBeUndefined();
		});

		it('should merge provider option tools', () => {
			const contextTool: Tool = {
				name: 'search',
				description: 'Search',
				parameters: Type.Object({}),
			};
			const optionTool = {
				functionDeclarations: [{ name: 'extra', description: 'Extra', parameters: {} }],
			};
			const context: Context = { messages: [], tools: [contextTool] };
			const options = { apiKey: 'test', signal: undefined, tools: [optionTool] };

			const result = buildParams(mockModel, context, options);
			expect(result.config?.tools?.length).toBe(2);
		});

		it('should pass through other options', () => {
			const context: Context = { messages: [] };
			const options = {
				apiKey: 'test',
				signal: undefined,
				temperature: 0.7,
				maxOutputTokens: 2000,
			} as any;

			const result = buildParams(mockModel, context, options);
			expect(result.config?.temperature).toBe(0.7);
			expect(result.config?.maxOutputTokens).toBe(2000);
		});

		it('should not include apiKey or signal in config', () => {
			const context: Context = { messages: [] };
			const options = { apiKey: 'test-key', signal: new AbortController().signal };

			const result = buildParams(mockModel, context, options);
			expect(result.config).not.toHaveProperty('apiKey');
		});

		it('should sanitize unicode in system instruction', () => {
			const unpaired = String.fromCharCode(0xD83D);
			const context: Context = {
				messages: [],
				systemPrompt: `Hello ${unpaired} World`,
			};
			const options = { apiKey: 'test', signal: undefined };

			const result = buildParams(mockModel, context, options);
			expect(result.config?.systemInstruction).toBe('Hello  World');
		});
	});

	describe('transformSchemaForGoogle', () => {
		it('should convert const to enum', () => {
			const schema = { const: 'value', type: 'string' };
			const result = transformSchemaForGoogle(schema);
			expect(result).toEqual({ enum: ['value'], type: 'string' });
		});

		it('should convert anyOf with consts to single enum', () => {
			const schema = {
				anyOf: [
					{ const: 'option1', type: 'string' },
					{ const: 'option2', type: 'string' },
					{ const: 'option3', type: 'string' },
				],
			};
			const result = transformSchemaForGoogle(schema);
			expect(result).toEqual({
				enum: ['option1', 'option2', 'option3'],
				type: 'string',
			});
		});

		it('should recursively transform nested properties', () => {
			const schema = {
				type: 'object',
				properties: {
					status: { const: 'active' },
					nested: {
						type: 'object',
						properties: {
							value: { const: 'test' },
						},
					},
				},
			};
			const result: any = transformSchemaForGoogle(schema);
			expect(result.properties.status).toEqual({ enum: ['active'] });
			expect(result.properties.nested.properties.value).toEqual({ enum: ['test'] });
		});

		it('should transform array items schema', () => {
			const schema = {
				type: 'array',
				items: { const: 'fixed' },
			};
			const result: any = transformSchemaForGoogle(schema);
			expect(result.items).toEqual({ enum: ['fixed'] });
		});

		it('should handle anyOf with non-const values', () => {
			const schema = {
				anyOf: [
					{ type: 'string' },
					{ type: 'number' },
				],
			};
			const result: any = transformSchemaForGoogle(schema);
			expect(result.anyOf).toBeDefined();
			expect(result.anyOf.length).toBe(2);
		});

		it('should preserve non-const schemas unchanged', () => {
			const schema = {
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'number' },
				},
			};
			const result = transformSchemaForGoogle(schema);
			expect(result).toEqual(schema);
		});

		it('should handle primitives', () => {
			expect(transformSchemaForGoogle('string')).toBe('string');
			expect(transformSchemaForGoogle(42)).toBe(42);
			expect(transformSchemaForGoogle(null)).toBe(null);
		});

		it('should handle arrays of schemas', () => {
			const schemas = [{ const: 'a' }, { const: 'b' }];
			const result = transformSchemaForGoogle(schemas) as any[];
			expect(result[0]).toEqual({ enum: ['a'] });
			expect(result[1]).toEqual({ enum: ['b'] });
		});
	});

	describe('convertTools', () => {
		it('should wrap tools in functionDeclarations', () => {
			const tool: Tool = {
				name: 'search',
				description: 'Search the web',
				parameters: Type.Object({ query: Type.String() }),
			};

			const result = convertTools([tool]);
			expect(result[0]).toHaveProperty('functionDeclarations');
			expect(result[0].functionDeclarations[0].name).toBe('search');
			expect(result[0].functionDeclarations[0].description).toBe('Search the web');
			expect(result[0].functionDeclarations[0].parameters).toBeDefined();
			expect(result[0].functionDeclarations[0].parameters.type).toBe('object');
		});

		it('should transform schemas for Google compatibility', () => {
			const tool: Tool = {
				name: 'setStatus',
				description: 'Set status',
				parameters: Type.Object({
					status: Type.Union([
						Type.Literal('active'),
						Type.Literal('inactive'),
					]),
				}),
			};

			const result = convertTools([tool]);
			const params: any = result[0].functionDeclarations[0].parameters;
			// The anyOf should be converted to enum
			expect(params.properties.status.enum).toEqual(['active', 'inactive']);
		});

		it('should convert multiple tools', () => {
			const tools: Tool[] = [
				{ name: 'tool1', description: 'First', parameters: Type.Object({}) },
				{ name: 'tool2', description: 'Second', parameters: Type.Object({}) },
			];

			const result = convertTools(tools);
			expect(result[0].functionDeclarations.length).toBe(2);
		});
	});

	describe('getResponseAssistantResponse', () => {
		it('should extract text parts', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{
						content: {
							role: 'model',
							parts: [{ text: 'Hello, world!' }],
						},
					},
				],
			} as GenerateContentResponse;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'text', content: 'Hello, world!' }],
				},
			]);
		});

		it('should detect thinking via thought: true', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{
						content: {
							role: 'model',
							parts: [{ text: 'Let me think...', thought: true }],
						},
					},
				],
			} as GenerateContentResponse;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'thinking',
					thinkingText: 'Let me think...',
				},
			]);
		});

		it('should extract function calls', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{
						content: {
							role: 'model',
							parts: [
								{
									functionCall: {
										id: 'call-123',
										name: 'search',
										args: { query: 'test' },
									},
								},
							],
						},
					},
				],
			} as any;

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

		it('should generate tool call IDs if missing', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{
						content: {
							role: 'model',
							parts: [
								{
									functionCall: {
										name: 'search',
										args: { query: 'test' },
									},
								},
							],
						},
					},
				],
			} as any;

			const result = getResponseAssistantResponse(response);
			expect(result[0].type).toBe('toolCall');
			expect((result[0] as any).toolCallId).toBeDefined();
			expect((result[0] as any).toolCallId).toContain('search');
		});

		it('should extract inline images', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{
						content: {
							role: 'model',
							parts: [
								{
									inlineData: {
										mimeType: 'image/png',
										data: 'base64data',
									},
								},
							],
						},
					},
				],
			} as GenerateContentResponse;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([
				{
					type: 'response',
					content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
				},
			]);
		});

		it('should handle empty candidates', () => {
			const response: GenerateContentResponse = {
				candidates: [],
			} as any;

			const result = getResponseAssistantResponse(response);
			expect(result).toEqual([]);
		});

		it('should handle mixed content types', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{
						content: {
							role: 'model',
							parts: [
								{ text: 'Thinking...', thought: true },
								{ text: 'Here is the answer' },
								{ functionCall: { name: 'tool', args: {} } },
							],
						},
					},
				],
			} as GenerateContentResponse;

			const result = getResponseAssistantResponse(response);
			expect(result.length).toBe(3);
			expect(result[0].type).toBe('thinking');
			expect(result[1].type).toBe('response');
			expect(result[2].type).toBe('toolCall');
		});
	});

	describe('getResponseUsage', () => {
		const mockModel: Model<'google'> = {
			id: 'gemini-pro',
			name: 'Gemini Pro',
			api: 'google',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
			reasoning: true,
			input: ['text'],
			cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
			contextWindow: 1048576,
			maxTokens: 65536,
			tools: [],
		};

		it('should extract input tokens from promptTokenCount', () => {
			const response: GenerateContentResponse = {
				usageMetadata: {
					promptTokenCount: 1000,
					candidatesTokenCount: 500,
					totalTokenCount: 1500,
				},
			} as GenerateContentResponse;

			const result = getResponseUsage(response, mockModel);
			expect(result.input).toBe(1000);
		});

		it('should include thoughtsTokenCount in output', () => {
			const response: GenerateContentResponse = {
				usageMetadata: {
					promptTokenCount: 1000,
					candidatesTokenCount: 500,
					thoughtsTokenCount: 200,
					totalTokenCount: 1700,
				},
			} as GenerateContentResponse;

			const result = getResponseUsage(response, mockModel);
			expect(result.output).toBe(700); // 500 + 200
		});

		it('should extract cachedContentTokenCount to cacheRead', () => {
			const response: GenerateContentResponse = {
				usageMetadata: {
					promptTokenCount: 1000,
					candidatesTokenCount: 500,
					cachedContentTokenCount: 200,
					totalTokenCount: 1500,
				},
			} as GenerateContentResponse;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheRead).toBe(200);
		});

		it('should set cacheWrite to 0', () => {
			const response: GenerateContentResponse = {
				usageMetadata: {
					promptTokenCount: 1000,
					candidatesTokenCount: 500,
					totalTokenCount: 1500,
				},
			} as GenerateContentResponse;

			const result = getResponseUsage(response, mockModel);
			expect(result.cacheWrite).toBe(0);
		});

		it('should calculate costs', () => {
			const response: GenerateContentResponse = {
				usageMetadata: {
					promptTokenCount: 1000,
					candidatesTokenCount: 500,
					totalTokenCount: 1500,
				},
			} as GenerateContentResponse;

			const result = getResponseUsage(response, mockModel);
			expect(result.cost.total).toBeGreaterThan(0);
		});

		it('should handle missing usageMetadata fields', () => {
			const response: GenerateContentResponse = {
				usageMetadata: {},
			} as GenerateContentResponse;

			const result = getResponseUsage(response, mockModel);
			expect(result.input).toBe(0);
			expect(result.output).toBe(0);
			expect(result.cacheRead).toBe(0);
		});
	});

	describe('getAssistantStopReason', () => {
		it('should extract finishReason from first candidate', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{ finishReason: FinishReason.STOP },
				],
			} as GenerateContentResponse;

			const result = getAssistantStopReason(response);
			expect(result).toBe('stop');
		});

		it('should return stop for no candidates', () => {
			const response: GenerateContentResponse = {
				candidates: [],
			} as any;

			const result = getAssistantStopReason(response);
			expect(result).toBe('stop');
		});

		it('should use first candidate when multiple exist', () => {
			const response: GenerateContentResponse = {
				candidates: [
					{ finishReason: FinishReason.MAX_TOKENS },
					{ finishReason: FinishReason.STOP },
				],
			} as GenerateContentResponse;

			const result = getAssistantStopReason(response);
			expect(result).toBe('length'); // First candidate has MAX_TOKENS
		});
	});

	describe('mapStopReason', () => {
		it('should map STOP to stop', () => {
			expect(mapStopReason(FinishReason.STOP)).toBe('stop');
		});

		it('should map MAX_TOKENS to length', () => {
			expect(mapStopReason(FinishReason.MAX_TOKENS)).toBe('length');
		});

		it('should map safety reasons to error', () => {
			expect(mapStopReason(FinishReason.SAFETY)).toBe('error');
			expect(mapStopReason(FinishReason.IMAGE_SAFETY)).toBe('error');
			expect(mapStopReason(FinishReason.PROHIBITED_CONTENT)).toBe('error');
			expect(mapStopReason(FinishReason.IMAGE_PROHIBITED_CONTENT)).toBe('error');
		});

		it('should map content policy reasons to error', () => {
			expect(mapStopReason(FinishReason.BLOCKLIST)).toBe('error');
			expect(mapStopReason(FinishReason.SPII)).toBe('error');
			expect(mapStopReason(FinishReason.RECITATION)).toBe('error');
		});

		it('should map technical issues to error', () => {
			expect(mapStopReason(FinishReason.MALFORMED_FUNCTION_CALL)).toBe('error');
			expect(mapStopReason(FinishReason.UNEXPECTED_TOOL_CALL)).toBe('error');
			expect(mapStopReason(FinishReason.NO_IMAGE)).toBe('error');
		});

		it('should map unspecified reasons to error', () => {
			expect(mapStopReason(FinishReason.FINISH_REASON_UNSPECIFIED)).toBe('error');
			expect(mapStopReason(FinishReason.OTHER)).toBe('error');
			expect(mapStopReason(FinishReason.LANGUAGE)).toBe('error');
		});
	});
});
