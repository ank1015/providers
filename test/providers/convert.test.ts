import { describe, it, expect } from 'vitest';
import { buildOpenAIMessages, buildGoogleMessages } from '../../src/providers/convert';
import { Context, Model, UserMessage, ToolResultMessage, NativeOpenAIMessage } from '../../src/types';

// Mock models for testing
const mockOpenAIModel: Model<'openai'> = {
	id: 'test-openai',
	name: 'Test OpenAI',
	api: 'openai',
	baseUrl: 'https://api.openai.com',
	reasoning: false,
	input: ['text', 'image', 'file'],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 4096,
};

const mockGoogleModel: Model<'google'> = {
	id: 'test-google',
	name: 'Test Google',
	api: 'google',
	baseUrl: 'https://generativelanguage.googleapis.com',
	reasoning: false,
	input: ['text', 'image', 'file'],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 8192,
};

describe('buildOpenAIMessages', () => {
	describe('System prompt conversion', () => {
		it('should convert system prompt to developer role', () => {
			const context: Context = {
				systemPrompt: 'You are a helpful assistant.',
				messages: [],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				role: 'developer',
				content: 'You are a helpful assistant.',
			});
		});

		it('should handle missing system prompt', () => {
			const context: Context = {
				messages: [],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(0);
		});

		it('should sanitize unicode surrogates in system prompt', () => {
			const context: Context = {
				systemPrompt: 'Test \uD800 invalid surrogate',
				messages: [],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result[0]).toMatchObject({
				role: 'developer',
			});
			// Surrogate should be removed by sanitizeSurrogates
			expect((result[0] as any).content).not.toContain('\uD800');
		});
	});

	describe('User message conversion', () => {
		it('should convert user message with text content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [{ type: 'text', content: 'Hello, world!' }],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				role: 'user',
				content: [
					{
						type: 'input_text',
						text: 'Hello, world!',
					},
				],
			});
		});

		it('should convert user message with image content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'Look at this image:' },
					{ type: 'image', data: 'base64data', mimeType: 'image/jpeg' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				role: 'user',
				content: [
					{ type: 'input_text', text: 'Look at this image:' },
					{
						type: 'input_image',
						detail: 'auto',
						image_url: 'data:image/jpeg;base64,base64data',
					},
				],
			});
		});

		it('should convert user message with file content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'Here is a PDF:' },
					{ type: 'file', data: 'base64pdfdata', mimeType: 'application/pdf' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				role: 'user',
				content: [
					{ type: 'input_text', text: 'Here is a PDF:' },
					{
						type: 'input_file',
						file_data: 'data:application/pdf;base64,base64pdfdata',
					},
				],
			});
		});

		it('should convert user message with mixed content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'Check this out:' },
					{ type: 'image', data: 'imagedata', mimeType: 'image/png' },
					{ type: 'text', content: 'And this file:' },
					{ type: 'file', data: 'filedata', mimeType: 'text/plain' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect((result[0] as any).content).toHaveLength(4);
		});

		it('should skip images when model does not support them', () => {
			const modelWithoutImages: Model<'openai'> = {
				...mockOpenAIModel,
				input: ['text'],
			};

			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'Text only' },
					{ type: 'image', data: 'imagedata', mimeType: 'image/png' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildOpenAIMessages(modelWithoutImages, context);

			expect(result).toHaveLength(1);
			expect((result[0] as any).content).toHaveLength(1);
			expect((result[0] as any).content[0]).toEqual({
				type: 'input_text',
				text: 'Text only',
			});
		});
	});

	describe('Tool result conversion', () => {
		it('should convert tool result with text content', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'calculator',
				toolCallId: 'call_123',
				content: [{ type: 'text', content: 'Result: 42' }],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'function_call_output',
				call_id: 'call_123',
				output: [
					{
						type: 'input_text',
						text: 'Result: 42',
					},
				],
			});
		});

		it('should convert tool result with image content', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'screenshot',
				toolCallId: 'call_456',
				content: [
					{ type: 'text', content: '(see attached)' },
					{ type: 'image', data: 'screenshotdata', mimeType: 'image/png' },
				],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect((result[0] as any).output).toHaveLength(2);
		});

		it('should convert tool result with error flag', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'failing_tool',
				toolCallId: 'call_789',
				content: [{ type: 'text', content: 'Error: Something went wrong' }],
				isError: true,
				error: {
					message: 'Something went wrong',
					name: 'Error',
				},
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect((result[0] as any).call_id).toBe('call_789');
		});

		it('should add "(see attached)" text for non-text content', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'image_tool',
				toolCallId: 'call_999',
				content: [{ type: 'image', data: 'imagedata', mimeType: 'image/png' }],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			const output = (result[0] as any).output;
			expect(output).toContainEqual({
				type: 'input_text',
				text: '(see attached)',
			});
		});
	});

	describe('Assistant message conversion', () => {
		it('should convert native OpenAI assistant message', () => {
			const assistantMessage: NativeOpenAIMessage = {
				role: 'assistant',
				_provider: 'openai',
				message: {
					id: 'resp_123',
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
					user: undefined,
					metadata: {},
					previous_response_id: null,
					temperature: 1,
					text: {},
					tool_choice: "auto",
					tools: [],
					top_p: 1,
					truncation: "disabled",
					output: [
						{
							type: 'message',
							role: 'assistant',
							content: [{ type: 'output_text', text: 'Hello!', annotations: [] }],
							id: '',
							status: 'completed'
						},
					],
					usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: {cached_tokens: 0}, output_tokens_details: {reasoning_tokens: 0} },
				},
			};

			const context: Context = {
				messages: [assistantMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				type: 'message',
				role: 'assistant',
				content: [{ type: 'output_text', text: 'Hello!', annotations: [] }],
    			id: '',
    			status: 'completed'
			});
		});

		it('should handle assistant message with function call', () => {
			const assistantMessage: NativeOpenAIMessage = {
				role: 'assistant',
				_provider: 'openai',
				message: {
					output: [
						{
							type: 'function_call',
							call_id: 'call_123',
							name: 'calculator',
							arguments: '{"expression": "2 + 2"}',
						},
					],
					id: 'resp_123',
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
					user: undefined,
					metadata: {},
					previous_response_id: null,
					temperature: 1,
					text: {},
					tool_choice: "auto",
					tools: [],
					top_p: 1,
					truncation: "disabled",
					usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: {cached_tokens: 0}, output_tokens_details: {reasoning_tokens: 0} },
				},
			};

			const context: Context = {
				messages: [assistantMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				type: 'function_call',
				name: 'calculator',
			});
		});

		it('should handle assistant message with reasoning', () => {
			const assistantMessage: NativeOpenAIMessage = {
				role: 'assistant',
				_provider: 'openai',
				message: {
					id: 'resp_789',
					object: 'response',
					output: [
						{
							type: 'reasoning',
							id:'',
							summary: [],
						},
					],
					created_at: 1740855869,
					output_text: '',
					status: "completed",
					incomplete_details: null,
					parallel_tool_calls: false,
					error: null,
					instructions: null,
					max_output_tokens: null,
					model: "gpt-4o-mini-2024-07-18",
					user: undefined,
					metadata: {},
					previous_response_id: null,
					temperature: 1,
					text: {},
					tool_choice: "auto",
					tools: [],
					top_p: 1,
					truncation: "disabled",
					usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: {cached_tokens: 0}, output_tokens_details: {reasoning_tokens: 0} },
				},
			};

			const context: Context = {
				messages: [assistantMessage],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				type: 'reasoning',
			});
		});

		it('should throw error for cross-provider conversion (Google → OpenAI)', () => {
			const googleAssistantMessage = {
				role: 'assistant' as const,
				_provider: 'google' as const,
				message: {} as any,
			};

			const context: Context = {
				messages: [googleAssistantMessage],
			};

			expect(() => buildOpenAIMessages(mockOpenAIModel, context)).toThrow(
				/Cannot convert google assistant message to openai format/
			);
		});
	});

	describe('Multiple messages', () => {
		it('should handle multiple messages in sequence', () => {
			const context: Context = {
				systemPrompt: 'System prompt',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Question 1' }],
						timestamp: Date.now(),
					},
					{
						role: 'user',
						content: [{ type: 'text', content: 'Question 2' }],
						timestamp: Date.now(),
					},
				],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(3); // system + 2 user messages
		});

		it('should handle conversation with tool calls', () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Calculate 2 + 2' }],
						timestamp: Date.now(),
					},
					{
						role: 'toolResult',
						toolName: 'calculator',
						toolCallId: 'call_123',
						content: [{ type: 'text', content: '4' }],
						isError: false,
						timestamp: Date.now(),
					},
				],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(2);
		});
	});

	describe('Empty messages', () => {
		it('should handle empty messages array', () => {
			const context: Context = {
				messages: [],
			};

			const result = buildOpenAIMessages(mockOpenAIModel, context);

			expect(result).toHaveLength(0);
		});
	});
});

describe('buildGoogleMessages', () => {
	describe('User message conversion', () => {
		it('should convert user message with text content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [{ type: 'text', content: 'Hello, Gemini!' }],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				role: 'user',
				parts: [{ text: 'Hello, Gemini!' }],
			});
		});

		it('should convert user message with image content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'Describe this image:' },
					{ type: 'image', data: 'base64imagedata', mimeType: 'image/jpeg' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				role: 'user',
				parts: [
					{ text: 'Describe this image:' },
					{ inlineData: { mimeType: 'image/jpeg', data: 'base64imagedata' } },
				],
			});
		});

		it('should convert user message with file content', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'Analyze this document:' },
					{ type: 'file', data: 'base64filedata', mimeType: 'application/pdf' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				role: 'user',
				parts: [
					{ text: 'Analyze this document:' },
					{ inlineData: { mimeType: 'application/pdf', data: 'base64filedata' } },
				],
			});
		});

		it('should handle mixed content types', () => {
			const userMessage: UserMessage = {
				role: 'user',
				content: [
					{ type: 'text', content: 'First text' },
					{ type: 'image', data: 'img1', mimeType: 'image/png' },
					{ type: 'text', content: 'Second text' },
					{ type: 'file', data: 'file1', mimeType: 'text/plain' },
				],
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [userMessage],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			expect((result[0] as any).parts).toHaveLength(4);
		});
	});

	describe('Tool result conversion', () => {
		it('should convert tool result with text content', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'search',
				toolCallId: 'call_123',
				content: [{ type: 'text', content: 'Search results here' }],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				role: 'user',
				parts: [
					{
						functionResponse: {
							id: 'call_123',
							name: 'search',
							response: {
								result: 'Search results here',
								isError: false,
							},
						},
					},
				],
			});
		});

		it('should convert tool result with error flag', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'failing_tool',
				toolCallId: 'call_456',
				content: [{ type: 'text', content: 'Error occurred' }],
				isError: true,
				error: {
					message: 'Something went wrong',
				},
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			expect((result[0] as any).parts[0].functionResponse.response.isError).toBe(true);
		});

		it('should handle tool result with image content', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'screenshot',
				toolCallId: 'call_789',
				content: [
					{ type: 'text', content: 'Screenshot taken' },
					{ type: 'image', data: 'screenshotdata', mimeType: 'image/png' },
				],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(1);
			const functionResponse = (result[0] as any).parts[0].functionResponse;
			expect(functionResponse.parts).toHaveLength(1); // Image part
			expect(functionResponse.response.result).toBe('Screenshot taken');
		});

		it('should use default text when no text content present', () => {
			const toolResult: ToolResultMessage = {
				role: 'toolResult',
				toolName: 'image_tool',
				toolCallId: 'call_999',
				content: [{ type: 'image', data: 'imagedata', mimeType: 'image/png' }],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [toolResult],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			const functionResponse = (result[0] as any).parts[0].functionResponse;
			expect(functionResponse.response.result).toBe('(see attached:)');
		});
	});

	describe('Assistant message conversion', () => {
		it('should throw error for cross-provider conversion (OpenAI → Google)', () => {
			const openaiAssistantMessage: NativeOpenAIMessage = {
				role: 'assistant',
				_provider: 'openai',
				message: {} as any,
			};

			const context: Context = {
				messages: [openaiAssistantMessage],
			};

			expect(() => buildGoogleMessages(mockGoogleModel, context)).toThrow(
				/Cannot convert openai assistant message to google format/
			);
		});
	});

	describe('Multiple messages', () => {
		it('should handle multiple user messages', () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'First message' }],
						timestamp: Date.now(),
					},
					{
						role: 'user',
						content: [{ type: 'text', content: 'Second message' }],
						timestamp: Date.now(),
					},
				],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(2);
		});
	});

	describe('Empty messages', () => {
		it('should handle empty messages array', () => {
			const context: Context = {
				messages: [],
			};

			const result = buildGoogleMessages(mockGoogleModel, context);

			expect(result).toHaveLength(0);
		});
	});
});

describe('Cross-provider consistency', () => {
	it('should handle same user message for both providers', () => {
		const userMessage: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello!' }],
			timestamp: Date.now(),
		};

		const context: Context = {
			messages: [userMessage],
		};

		const openaiResult = buildOpenAIMessages(mockOpenAIModel, context);
		const googleResult = buildGoogleMessages(mockGoogleModel, context);

		// Both should produce exactly 1 message
		expect(openaiResult).toHaveLength(1);
		expect(googleResult).toHaveLength(1);

		// Both should have role 'user'
		expect((openaiResult[0] as any).role).toBe('user');
		expect((googleResult[0] as any).role).toBe('user');
	});

	it('should handle same tool result for both providers', () => {
		const toolResult: ToolResultMessage = {
			role: 'toolResult',
			toolName: 'test_tool',
			toolCallId: 'call_123',
			content: [{ type: 'text', content: 'Result' }],
			isError: false,
			timestamp: Date.now(),
		};

		const context: Context = {
			messages: [toolResult],
		};

		const openaiResult = buildOpenAIMessages(mockOpenAIModel, context);
		const googleResult = buildGoogleMessages(mockGoogleModel, context);

		// Both should produce exactly 1 message
		expect(openaiResult).toHaveLength(1);
		expect(googleResult).toHaveLength(1);

		// Both should reference the tool call ID
		expect((openaiResult[0] as any).call_id).toBe('call_123');
		expect((googleResult[0] as any).parts[0].functionResponse.id).toBe('call_123');
	});
});
