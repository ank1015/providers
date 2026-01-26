import { describe, it, expect, beforeAll } from 'vitest';
import { completeCerebras } from '../../../../src/providers/cerebras/complete.js';
import { getModel } from '../../../../src/models.js';
import type { Context, Model } from '../../../../src/types.js';
import { Type } from '@sinclair/typebox';

describe('Cerebras Complete Integration', () => {
	let model: Model<'cerebras'>;
	const apiKey = process.env.CEREBRAS_API_KEY;

	beforeAll(() => {
		if (!apiKey) {
			throw new Error('CEREBRAS_API_KEY environment variable is required for integration tests');
		}

		// Use the zai-glm-4.7 model for testing
		const testModel = getModel('cerebras', 'zai-glm-4.7');
		if (!testModel) {
			throw new Error('Test model zai-glm-4.7 not found');
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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-1');

			expect(result.role).toBe('assistant');
			expect(result.id).toBe('test-msg-1');
			expect(result.api).toBe('cerebras');
			expect(result.model).toBe(model);
			expect(result.stopReason).toBeDefined();
			expect(result.content).toBeDefined();
			expect(Array.isArray(result.content)).toBe(true);
			expect(result.message).toBeDefined();
		}, 30000);

		it('should include native ChatCompletion in message field', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Reply with just "test"' }],
					},
				],
			};

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-2');

			expect(result.message).toBeDefined();
			expect(result.message).toHaveProperty('id');
			expect(result.message).toHaveProperty('choices');
			expect(result.message).toHaveProperty('model');
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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-3');

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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-4');

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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-5');

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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-6');

			expect(result.usage).toBeDefined();
			expect(result.usage.input).toBeGreaterThan(0);
			expect(result.usage.output).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBeGreaterThan(0);
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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-7');

			expect(result.usage.cost).toBeDefined();
			expect(result.usage.cost.total).toBeGreaterThanOrEqual(0);
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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-8');

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

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-9');

			const toolCall = result.content.find(c => c.type === 'toolCall');
			if (toolCall && toolCall.type === 'toolCall') {
				expect(toolCall.arguments.query).toBeDefined();
				expect(typeof toolCall.arguments.query).toBe('string');
			}
		}, 30000);
	});

	describe('reasoning (GLM model)', () => {
		it('should support reasoning with parsed format', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Solve: What is 15 * 23?' }],
					},
				],
			};

			const result = await completeCerebras(
				model,
				context,
				{ apiKey, reasoning_format: 'parsed' },
				'test-msg-reasoning-1'
			);

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);

			// Check if thinking content was captured
			const thinkingContent = result.content.find(c => c.type === 'thinking');
			if (thinkingContent && thinkingContent.type === 'thinking') {
				expect(thinkingContent.thinkingText.length).toBeGreaterThan(0);
			}
		}, 60000);

		it('should return reasoning in separate field when parsed', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Think about: What is the capital of France?' }],
					},
				],
			};

			const result = await completeCerebras(
				model,
				context,
				{ apiKey, reasoning_format: 'parsed' },
				'test-msg-reasoning-2'
			);

			expect(result.stopReason).toBe('stop');
			// Check if reasoning is in the native message
			const message = result.message.choices[0]?.message as any;
			if (message?.reasoning) {
				expect(typeof message.reasoning).toBe('string');
			}
		}, 60000);

		it('should work with reasoning disabled', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "no reasoning"' }],
					},
				],
			};

			const result = await completeCerebras(
				model,
				context,
				{ apiKey, disable_reasoning: true },
				'test-msg-reasoning-3'
			);

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 30000);

		it('should work with hidden reasoning format', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is 2 + 2?' }],
					},
				],
			};

			const result = await completeCerebras(
				model,
				context,
				{ apiKey, reasoning_format: 'hidden' },
				'test-msg-reasoning-4'
			);

			expect(result.stopReason).toBe('stop');
			// With hidden format, reasoning should not appear
			const message = result.message.choices[0]?.message as any;
			// reasoning field should not exist or be empty when hidden
			if (message?.reasoning) {
				expect(message.reasoning).toBeFalsy();
			}
		}, 30000);
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

			const result = await completeCerebras(
				model,
				context,
				{ apiKey: 'invalid-key-12345' },
				'test-msg-10'
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

			const result = await completeCerebras(
				model,
				context,
				{ apiKey, signal: controller.signal },
				'test-msg-11'
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
						api: 'cerebras',
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
						message: { choices: [] } as any,
					},
					{
						role: 'user',
						id: 'msg-3',
						content: [{ type: 'text', content: 'What is my name?' }],
					},
				],
			};

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-12');

			expect(result.stopReason).toBe('stop');
			// Response should reference the name Alice
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);

		it('should handle preserved thinking in conversation history', async () => {
			// Simulate a previous turn with thinking content preserved
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'msg-1',
						content: [{ type: 'text', content: 'What is 5 + 3?' }],
					},
					{
						role: 'assistant',
						id: 'msg-2',
						api: 'cerebras',
						model,
						timestamp: Date.now(),
						duration: 100,
						stopReason: 'stop',
						content: [
							{
								type: 'thinking',
								thinkingText: 'I need to add 5 and 3. 5 + 3 = 8.',
							},
							{
								type: 'response',
								content: [{ type: 'text', content: 'The answer is 8.' }],
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
						message: { choices: [] } as any,
					},
					{
						role: 'user',
						id: 'msg-3',
						content: [{ type: 'text', content: 'What was the previous calculation result?' }],
					},
				],
			};

			const result = await completeCerebras(model, context, { apiKey }, 'test-msg-13');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 30000);
	});

	describe('cross-provider handoff', () => {
		it('should handle conversation with OpenAI assistant message in history', async () => {
			// Simulate a conversation where a previous response came from OpenAI
			const openaiAssistantMessage = {
				role: 'assistant' as const,
				id: 'msg-openai-1',
				api: 'openai' as const,
				model: { id: 'gpt-5', api: 'openai' } as any,
				timestamp: Date.now(),
				duration: 100,
				stopReason: 'stop' as const,
				content: [
					{
						type: 'response' as const,
						content: [{ type: 'text' as const, content: 'I am GPT. I told you the answer is 42.' }],
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

			const result = await completeCerebras(model, context, { apiKey }, 'test-handoff-1');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
			// The response should understand the context from the OpenAI message
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);

		it('should handle cross-provider handoff with thinking content', async () => {
			// Simulate an Anthropic thinking model response in history
			const anthropicThinkingMessage = {
				role: 'assistant' as const,
				id: 'msg-anthropic-think-1',
				api: 'anthropic' as const,
				model: { id: 'claude-sonnet-4-5', api: 'anthropic' } as any,
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
					anthropicThinkingMessage,
					{
						role: 'user',
						id: 'msg-2',
						content: [{ type: 'text', content: 'What city did you just mention?' }],
					},
				],
			};

			const result = await completeCerebras(model, context, { apiKey }, 'test-handoff-think-1');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 30000);

		it('should handle cross-provider tool call and result handoff', async () => {
			// Simulate a Google model making a tool call and receiving a result
			const googleToolCallMessage = {
				role: 'assistant' as const,
				id: 'msg-google-tool-1',
				api: 'google' as const,
				model: { id: 'gemini-3-flash-preview', api: 'google' } as any,
				timestamp: Date.now(),
				duration: 100,
				stopReason: 'toolUse' as const,
				content: [
					{
						type: 'toolCall' as const,
						toolCallId: 'google-call-123',
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
				toolCallId: 'google-call-123',
				toolName: 'get_weather',
				content: [{ type: 'text' as const, content: 'Sunny, 25C in Tokyo' }],
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
					googleToolCallMessage,
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

			const result = await completeCerebras(model, context, { apiKey }, 'test-handoff-tool-1');

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
			// Should understand the tool result and respond about the weather
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);
	});
});

describe('Cerebras GPT-OSS Model', () => {
	let gptModel: Model<'cerebras'>;
	const apiKey = process.env.CEREBRAS_API_KEY;

	beforeAll(() => {
		if (!apiKey) {
			throw new Error('CEREBRAS_API_KEY environment variable is required for integration tests');
		}

		// Use the gpt-oss-120b model for testing
		const testModel = getModel('cerebras', 'gpt-oss-120b');
		if (!testModel) {
			throw new Error('Test model gpt-oss-120b not found');
		}
		gptModel = testModel;
	});

	describe('reasoning effort (GPT-OSS specific)', () => {
		it('should support low reasoning effort', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is 2 + 2?' }],
					},
				],
			};

			const result = await completeCerebras(
				gptModel,
				context,
				{ apiKey, reasoning_effort: 'low' },
				'test-gpt-low-effort'
			);

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 60000);

		it('should support medium reasoning effort', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Solve: 15 * 7' }],
					},
				],
			};

			const result = await completeCerebras(
				gptModel,
				context,
				{ apiKey, reasoning_effort: 'medium' },
				'test-gpt-medium-effort'
			);

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 60000);

		it('should support high reasoning effort', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Explain quantum entanglement briefly.' }],
					},
				],
			};

			const result = await completeCerebras(
				gptModel,
				context,
				{ apiKey, reasoning_effort: 'high' },
				'test-gpt-high-effort'
			);

			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 90000);
	});

	describe('basic completion', () => {
		it('should return valid response from GPT-OSS model', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "GPT-OSS works"' }],
					},
				],
			};

			const result = await completeCerebras(gptModel, context, { apiKey }, 'test-gpt-basic');

			expect(result.role).toBe('assistant');
			expect(result.api).toBe('cerebras');
			expect(result.stopReason).toBe('stop');
			expect(result.content.length).toBeGreaterThan(0);
		}, 60000);
	});
});
