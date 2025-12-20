import { describe, it, expect, beforeAll } from 'vitest';
import { completeOpenAI } from '../../../../src/providers/openai/complete.js';
import { getModel } from '../../../../src/models.js';
import type { Context, Model } from '../../../../src/types.js';
import { Type } from '@sinclair/typebox';

describe('OpenAI Complete Integration', () => {
	let model: Model<'openai'>;
	const apiKey = process.env.OPENAI_API_KEY;

	beforeAll(() => {
		if (!apiKey) {
			throw new Error('OPENAI_API_KEY environment variable is required for integration tests');
		}

		// Use a fast, cheap model for testing
		const testModel = getModel('openai', 'gpt-5-nano');
		if (!testModel) {
			throw new Error('Test model gpt-5-nano not found');
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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-1');

			expect(result.role).toBe('assistant');
			expect(result.id).toBe('test-msg-1');
			expect(result.api).toBe('openai');
			expect(result.model).toBe(model);
			expect(result.stopReason).toBeDefined();
			expect(result.content).toBeDefined();
			expect(Array.isArray(result.content)).toBe(true);
			expect(result.message).toBeDefined();
		}, 30000);

		it('should include native Response in message field', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Reply with just "test"' }],
					},
				],
			};

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-2');

			expect(result.message).toBeDefined();
			expect(result.message).toHaveProperty('id');
			expect(result.message).toHaveProperty('output');
			expect(result.message).toHaveProperty('status');
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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-3');

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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-4');

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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-5');

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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-6');

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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-7');

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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-8');

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

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-9');

			const toolCall = result.content.find(c => c.type === 'toolCall');
			if (toolCall && toolCall.type === 'toolCall') {
				expect(toolCall.arguments.query).toBeDefined();
				expect(typeof toolCall.arguments.query).toBe('string');
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

			const result = await completeOpenAI(
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

			const result = await completeOpenAI(
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
						api: 'openai',
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
						message: { output: [] } as any,
					},
					{
						role: 'user',
						id: 'msg-3',
						content: [{ type: 'text', content: 'What is my name?' }],
					},
				],
			};

			const result = await completeOpenAI(model, context, { apiKey }, 'test-msg-12');

			expect(result.stopReason).toBe('stop');
			// Response should reference the name Alice
			const textContent = result.content.find(c => c.type === 'response');
			expect(textContent).toBeDefined();
		}, 30000);
	});
});
