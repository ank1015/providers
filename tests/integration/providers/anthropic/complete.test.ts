import { describe, it, expect, beforeAll } from 'vitest';
import { completeAnthropic } from '../../../../src/providers/anthropic/complete.js';
import { getModel } from '../../../../src/models.js';
import type { Context, Model } from '../../../../src/types.js';
import { Type } from '@sinclair/typebox';

describe('Anthropic Complete Integration', () => {
	let model: Model<'anthropic'>;
	const apiKey = process.env.ANTHROPIC_API_KEY;

	beforeAll(() => {
		if (!apiKey) {
			throw new Error('ANTHROPIC_API_KEY environment variable is required for integration tests');
		}
		// Use Haiku for testing (fastest and cheapest)
		const testModel = getModel('anthropic', 'claude-haiku-4-5');
		if (!testModel) {
			throw new Error('Test model claude-haiku-4-5 not found');
		}
		model = testModel;
	});

	describe('basic completion', () => {
		it('should return valid BaseAssistantMessage', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "hello" and nothing else.' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-1');
			expect(result.role).toBe('assistant');
			expect(result.id).toBe('test-msg-1');
			expect(result.api).toBe('anthropic');
			expect(result.model).toBe(model);
			expect(result.stopReason).toBeDefined();
			expect(result.content).toBeDefined();
			expect(Array.isArray(result.content)).toBe(true);
			expect(result.message).toBeDefined();
		}, 30000);

		it('should include native Message in message field', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Reply with just "test"' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-2');

			expect(result.message).toBeDefined();
			expect(result.message).toHaveProperty('id');
			expect(result.message).toHaveProperty('content');
			expect(result.message).toHaveProperty('role');
			expect(result.message.role).toBe('assistant');
			expect(result.message).toHaveProperty('stop_reason');
			expect(result.message).toHaveProperty('usage');
		}, 30000);

		it('should calculate duration correctly', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hi' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-3');

			expect(result.duration).toBeGreaterThan(0);
			expect(typeof result.duration).toBe('number');
		}, 30000);

		it('should return text content', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "integration test passed"' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-4');

			expect(result.content.length).toBeGreaterThan(0);
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);

		it('should handle system prompt', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is your role?' }],
					},
				],
				systemPrompt: 'You are a helpful math tutor.',
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-5');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 30000);
	});

	describe('usage tracking', () => {
		it('should track token usage', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Count from 1 to 5' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-6');
            console.log("result0")
            console.log(result);

			expect(result.usage).toBeDefined();
			expect(result.usage.input).toBeGreaterThan(0);
			expect(result.usage.output).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBe(result.usage.input + result.usage.output + result.usage.cacheRead + result.usage.cacheWrite);
		}, 30000);

		it('should calculate cost', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-7');
            console.log("result1")
            console.log(result);

			expect(result.usage.cost).toBeDefined();
			expect(result.usage.cost.total).toBeGreaterThan(0);
			expect(result.usage.cost.input).toBeGreaterThanOrEqual(0);
			expect(result.usage.cost.output).toBeGreaterThanOrEqual(0);
		}, 30000);
	});

	describe('tool calling', () => {
		it('should execute and return tool calls', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is the weather in San Francisco?' }],
					},
				],
				tools: [
					{
						name: 'get_weather',
						description: 'Get the current weather for a location',
						parameters: Type.Object({
							location: Type.String({ description: 'City name' }),
							unit: Type.Optional(Type.Union([Type.Literal('celsius'), Type.Literal('fahrenheit')])),
						}),
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-9');

			// Should return a tool call
			expect(result.stopReason).toBe('toolUse');
			const toolCall = result.content.find(c => c.type === 'toolCall');
			expect(toolCall).toBeDefined();
			if (toolCall && toolCall.type === 'toolCall') {
				expect(toolCall.name).toBe('get_weather');
				expect(toolCall.arguments).toBeDefined();
				expect(toolCall.toolCallId).toBeDefined();
			}
		}, 30000);

		it('should validate tool call arguments', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Search for "typescript testing"' }],
					},
				],
				tools: [
					{
						name: 'search',
						description: 'Search the web',
						parameters: Type.Object({
							query: Type.String({ minLength: 1 }),
							limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
						}),
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-10');

			const toolCall = result.content.find(c => c.type === 'toolCall');
			if (toolCall && toolCall.type === 'toolCall') {
				expect(toolCall.arguments.query).toBeDefined();
				expect(typeof toolCall.arguments.query).toBe('string');
			}
		}, 30000);

		it('should handle tool results in conversation', async () => {
			// First, get a tool call
			const context1: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is 5 + 3?' }],
					},
				],
				tools: [
					{
						name: 'calculate',
						description: 'Perform basic calculations',
						parameters: Type.Object({
							expression: Type.String(),
						}),
					},
				],
			};

			const result1 = await completeAnthropic(model, context1, { apiKey, max_tokens: 2000 }, 'test-msg-11a');

			const toolCall = result1.content.find(c => c.type === 'toolCall');
			expect(toolCall).toBeDefined();

			if (toolCall && toolCall.type === 'toolCall') {
				// Now provide the tool result and continue
				const context2: Context = {
					messages: [
						{
							role: 'user',
							id: 'test-1',
							content: [{ type: 'text', content: 'What is 5 + 3?' }],
						},
						result1,
						{
							role: 'toolResult',
							id: 'result-1',
							toolCallId: toolCall.toolCallId,
							toolName: toolCall.name,
							content: [{ type: 'text', content: '8' }],
							isError: false,
							timestamp: Date.now(),
						},
					],
					tools: [
						{
							name: 'calculate',
							description: 'Perform basic calculations',
							parameters: Type.Object({
								expression: Type.String(),
							}),
						},
					],
				};

				const result2 = await completeAnthropic(model, context2, { apiKey, max_tokens: 2000 }, 'test-msg-11b');

				expect(result2.stopReason).toBe('stop');
				expect(result2.content.length).toBeGreaterThan(0);
			}
		}, 60000);
	});

	describe('error handling', () => {
		it('should handle API errors gracefully', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const result = await completeAnthropic(
				model,
				context,
				{ apiKey: 'invalid-key-12345', max_tokens: 2000 },
				'test-msg-12'
			);

			expect(result.stopReason).toBe('error');
			expect(result.errorMessage).toBeDefined();
			expect(result.usage.input).toBe(0);
			expect(result.usage.output).toBe(0);
			expect(result.usage.totalTokens).toBe(0);
		}, 30000);

		it('should handle abort signal', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Tell me a very long story about dragons' }],
					},
				],
			};

			const controller = new AbortController();

			// Abort immediately
			setTimeout(() => controller.abort(), 10);

			const result = await completeAnthropic(
				model,
				context,
				{ apiKey, signal: controller.signal , max_tokens: 2000},
				'test-msg-13'
			);

			expect(result.stopReason).toBe('aborted');
			expect(result.usage.totalTokens).toBe(0);
		}, 30000);
	});

	describe('multi-turn conversations', () => {
		it('should handle conversation context', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'msg-1',
						content: [{ type: 'text', content: 'My name is Alice' }],
					},
					{
						role: 'assistant',
						id: 'msg-2',
						api: 'anthropic',
						model,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'response',
								content: [{ type: 'text', content: 'Hello Alice! Nice to meet you.' }],
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
						message: {
							id: 'msg-2',
							type: 'message',
							role: 'assistant',
							content: [{ type: 'text', text: 'Hello Alice! Nice to meet you.' }],
							model: model.id,
							stop_reason: 'end_turn',
							stop_sequence: null,
							usage: {
								input_tokens: 10,
								output_tokens: 20,
								cache_creation_input_tokens: 0,
								cache_read_input_tokens: 0,
							},
						} as any,
					},
					{
						role: 'user',
						id: 'msg-3',
						content: [{ type: 'text', content: 'What is my name?' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-msg-14');

			expect(result.stopReason).toBe('stop');
			// Response should reference the name Alice
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);
	});

	describe('cross-provider handoff', () => {
		it('should handle conversation with OpenAI assistant message in history', async () => {
			// Simulate a conversation where a previous response came from OpenAI
			const openaiAssistantMessage = {
				role: 'assistant' as const,
				id: 'msg-openai-1',
				api: 'openai' as const,
				model: { id: 'gpt-4', api: 'openai' } as any,
				timestamp: Date.now(),
				duration: 100,
				stopReason: 'stop' as const,
				content: [
					{
						type: 'response' as const,
						content: [{ type: 'text' as const, content: 'I am GPT-4. The answer is 42.' }],
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

			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'msg-1',
						content: [{ type: 'text', content: 'What is the meaning of life?' }],
					},
					openaiAssistantMessage,
					{
						role: 'user',
						id: 'msg-2',
						content: [{ type: 'text', content: 'What number did you just mention?' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-handoff-1');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
			// The response should understand the context from the OpenAI message
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);

		it('should handle cross-provider handoff with thinking content', async () => {
			// Simulate an OpenAI thinking model response in history
			const openaiThinkingMessage = {
				role: 'assistant' as const,
				id: 'msg-openai-think-1',
				api: 'openai' as const,
				model: { id: 'gpt-5', api: 'openai' } as any,
				timestamp: Date.now(),
				duration: 200,
				stopReason: 'stop' as const,
				content: [
					{
						type: 'thinking' as const,
						thinkingText: 'The user is asking about capitals. Paris is the capital of France.',
					},
					{
						type: 'response' as const,
						content: [{ type: 'text' as const, content: 'The capital of France is Paris.' }],
					},
				],
				usage: {
					input: 10,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 60,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				message: {} as any,
			};

			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'msg-1',
						content: [{ type: 'text', content: 'What is the capital of France?' }],
					},
					openaiThinkingMessage,
					{
						role: 'user',
						id: 'msg-2',
						content: [{ type: 'text', content: 'What city did you just mention?' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-handoff-think-1');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 30000);

		it('should handle cross-provider tool call and result handoff', async () => {
			// Simulate an OpenAI model making a tool call and receiving a result
			const openaiToolCallMessage = {
				role: 'assistant' as const,
				id: 'msg-openai-tool-1',
				api: 'openai' as const,
				model: { id: 'gpt-4', api: 'openai' } as any,
				timestamp: Date.now(),
				duration: 100,
				stopReason: 'toolUse' as const,
				content: [
					{
						type: 'toolCall' as const,
						toolCallId: 'openai-call-123',
						name: 'get_weather',
						arguments: { location: 'Tokyo' },
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

			const toolResult = {
				role: 'toolResult' as const,
				id: 'result-1',
				toolCallId: 'openai-call-123',
				toolName: 'get_weather',
				content: [{ type: 'text' as const, content: 'Sunny, 25°C in Tokyo' }],
				isError: false,
				timestamp: Date.now(),
			};

			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'msg-1',
						content: [{ type: 'text', content: 'What is the weather in Tokyo?' }],
					},
					openaiToolCallMessage,
					toolResult,
				],
				tools: [
					{
						name: 'get_weather',
						description: 'Get weather for a location',
						parameters: Type.Object({
							location: Type.String(),
						}),
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 2000 }, 'test-handoff-tool-1');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
			// Should understand the tool result and respond about the weather
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);
	});

	describe('extended thinking', () => {
		it('should handle extended thinking responses', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Think through this step by step: what is 15 * 23?' }],
					},
				],
			};

			const result = await completeAnthropic(model, context, { apiKey, max_tokens: 4000 }, 'test-msg-15');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);

			// May include thinking content
			const hasThinking = result.content.some(c => c.type === 'thinking');
			const hasResponse = result.content.some(c => c.type === 'response');

			expect(hasResponse).toBe(true);
			// Thinking is optional depending on the model and prompt
		}, 30000);
	});
});
