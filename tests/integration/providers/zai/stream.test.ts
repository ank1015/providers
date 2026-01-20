import { describe, it, expect, beforeAll } from 'vitest';
import { streamZai } from '../../../../src/providers/zai/stream.js';
import { getModel } from '../../../../src/models.js';
import type { Context, Model, BaseAssistantEvent } from '../../../../src/types.js';
import { Type } from '@sinclair/typebox';

describe('Zai Stream Integration', () => {
	let model: Model<'zai'>;
	const apiKey = process.env.ZAI_API_KEY;

	beforeAll(() => {
		if (!apiKey) {
			throw new Error('ZAI_API_KEY environment variable is required for integration tests');
		}

		const testModel = getModel('zai', 'glm-4.7');
		if (!testModel) {
			throw new Error('Test model glm-4.7 not found');
		}
		model = testModel;
	});

	describe('basic streaming', () => {
		it('should emit start event first', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "hello"' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-1');

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events.length).toBeGreaterThan(0);
			expect(events[0].type).toBe('start');
		}, 30000);

		it('should emit text_start before text deltas', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "streaming test"' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-2');

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const textStartIndex = events.findIndex(e => e.type === 'text_start');
			const firstTextDeltaIndex = events.findIndex(e => e.type === 'text_delta');

			expect(textStartIndex).toBeGreaterThan(-1);
			if (firstTextDeltaIndex > -1) {
				expect(textStartIndex).toBeLessThan(firstTextDeltaIndex);
			}
		}, 30000);

		it('should emit text_delta with incremental text', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Count from 1 to 3' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-3');

			const deltas: string[] = [];
			for await (const event of stream) {
				if (event.type === 'text_delta') {
					deltas.push(event.delta);
				}
			}

			expect(deltas.length).toBeGreaterThan(0);
			expect(deltas.every(d => typeof d === 'string')).toBe(true);
		}, 30000);

		it('should emit text_end with complete content', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "complete"' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-4');

			let textEndEvent: BaseAssistantEvent<'zai'> | undefined;
			for await (const event of stream) {
				if (event.type === 'text_end') {
					textEndEvent = event;
				}
			}

			expect(textEndEvent).toBeDefined();
			if (textEndEvent && textEndEvent.type === 'text_end') {
				expect(textEndEvent.content).toBeDefined();
				expect(Array.isArray(textEndEvent.content)).toBe(true);
			}
		}, 30000);

		it('should emit done event at the end', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hi' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-5');

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const lastEvent = events[events.length - 1];
			expect(lastEvent.type).toBe('done');
			if (lastEvent.type === 'done') {
				expect(lastEvent.reason).toBeDefined();
			}
		}, 30000);
	});

	describe('result() promise', () => {
		it('should return complete BaseAssistantMessage', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "result test"' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-6');

			// Consume stream
			for await (const _ of stream) {
				// Just consume
			}

			const result = await stream.result();

			expect(result.role).toBe('assistant');
			expect(result.id).toBe('test-msg-6');
			expect(result.api).toBe('zai');
			expect(result.model).toBe(model);
			expect(result.stopReason).toBeDefined();
			expect(result.content).toBeDefined();
			expect(result.message).toBeDefined();
			expect(result.usage).toBeDefined();
		}, 30000);

		it('should calculate usage in final result', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Count from 1 to 5' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-7');

			// Consume stream
			for await (const _ of stream) {
				// Just consume
			}

			const result = await stream.result();

			expect(result.usage.input).toBeGreaterThanOrEqual(0);
			expect(result.usage.output).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBeGreaterThan(0);
			expect(result.usage.cost.total).toBeGreaterThanOrEqual(0);
		}, 30000);

		it('should be awaitable without consuming stream', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-8');

			// Don't consume stream, just await result
			const result = await stream.result();

			expect(result.role).toBe('assistant');
			expect(result.content).toBeDefined();
		}, 30000);
	});

	describe('tool call streaming', () => {
		it('should emit toolcall_start/delta/end for function calls', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is the weather in Tokyo?' }],
					},
				],
				tools: [
					{
						name: 'get_weather',
						description: 'Get the current weather',
						parameters: Type.Object({
							location: Type.String(),
							unit: Type.Optional(Type.Union([Type.Literal('celsius'), Type.Literal('fahrenheit')])),
						}),
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-9');

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const toolcallStart = events.find(e => e.type === 'toolcall_start');
			const toolcallEnd = events.find(e => e.type === 'toolcall_end');

			expect(toolcallStart).toBeDefined();
			expect(toolcallEnd).toBeDefined();

			if (toolcallEnd && toolcallEnd.type === 'toolcall_end') {
				expect(toolcallEnd.toolCall).toBeDefined();
				expect(toolcallEnd.toolCall.name).toBe('get_weather');
				expect(toolcallEnd.toolCall.arguments).toBeDefined();
				expect(toolcallEnd.toolCall.toolCallId).toBeDefined();
			}
		}, 30000);

		it('should parse partial JSON during streaming', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Search for "vitest testing"' }],
					},
				],
				tools: [
					{
						name: 'search',
						description: 'Search the web',
						parameters: Type.Object({
							query: Type.String(),
							limit: Type.Optional(Type.Number()),
						}),
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-10');

			const toolcallDeltas: string[] = [];
			for await (const event of stream) {
				if (event.type === 'toolcall_delta') {
					toolcallDeltas.push(event.delta);
				}
			}

			// Should have received some deltas for the arguments JSON
			expect(toolcallDeltas.length).toBeGreaterThan(0);
		}, 30000);

		it('should validate tool arguments on completion', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Get weather for Paris' }],
					},
				],
				tools: [
					{
						name: 'get_weather',
						description: 'Get weather',
						parameters: Type.Object({
							location: Type.String({ minLength: 1 }),
						}),
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-11');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();
			const toolCall = result.content.find(c => c.type === 'toolCall');

			if (toolCall && toolCall.type === 'toolCall') {
				expect(toolCall.arguments.location).toBeDefined();
				expect(typeof toolCall.arguments.location).toBe('string');
			}
		}, 30000);
	});

	describe('thinking/reasoning streaming', () => {
		it('should emit thinking_start/delta/end with thinking enabled', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Solve: What is 15 * 23?' }],
					},
				],
			};

			const stream = streamZai(
				model,
				context,
				{ apiKey, thinking: { type: 'enabled' } },
				'test-msg-12'
			);

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			// GLM-4.7 with thinking enabled should have thinking events
			const thinkingStart = events.find(e => e.type === 'thinking_start');
			if (thinkingStart) {
				const thinkingEnd = events.find(e => e.type === 'thinking_end');
				expect(thinkingEnd).toBeDefined();

				// Check for thinking deltas
				const thinkingDeltas = events.filter(e => e.type === 'thinking_delta');
				expect(thinkingDeltas.length).toBeGreaterThan(0);
			}
		}, 60000);

		it('should accumulate reasoning_content in final message', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Explain step by step: 2 + 2 = ?' }],
					},
				],
			};

			const stream = streamZai(
				model,
				context,
				{ apiKey, thinking: { type: 'enabled' } },
				'test-msg-13'
			);

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Check if thinking content was captured
			const thinkingContent = result.content.find(c => c.type === 'thinking');
			if (thinkingContent && thinkingContent.type === 'thinking') {
				expect(thinkingContent.thinkingText.length).toBeGreaterThan(0);
			}
		}, 60000);

		it('should preserve thinking across turns with clear_thinking: false', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Think about what 3 + 4 equals' }],
					},
				],
			};

			const stream = streamZai(
				model,
				context,
				{ apiKey, thinking: { type: 'enabled', clear_thinking: false } },
				'test-msg-14'
			);

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Check if reasoning_content is in the native message (preserved thinking)
			const message = result.message.choices[0]?.message as any;
			if (message?.reasoning_content) {
				expect(typeof message.reasoning_content).toBe('string');
				expect(message.reasoning_content.length).toBeGreaterThan(0);
			}
		}, 60000);
	});

	describe('abort handling', () => {
		it('should handle abort signal', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Tell me a very long story about space exploration' }],
					},
				],
			};

			const controller = new AbortController();
			const stream = streamZai(model, context, { apiKey, signal: controller.signal }, 'test-msg-15');

			// Consume a few events then abort
			let eventCount = 0;
			try {
				for await (const event of stream) {
					eventCount++;
					if (eventCount > 2) {
						controller.abort();
					}
				}
			} catch (e) {
				// Expected to throw or stop
			}

			const result = await stream.result();
			expect(result.stopReason).toBe('aborted');
		}, 30000);

		it('should emit error event on abort', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Count to 100' }],
					},
				],
			};

			const controller = new AbortController();
			const stream = streamZai(model, context, { apiKey, signal: controller.signal }, 'test-msg-16');

			const events: BaseAssistantEvent<'zai'>[] = [];
			let eventCount = 0;

			try {
				for await (const event of stream) {
					events.push(event);
					eventCount++;
					if (eventCount > 2) {
						controller.abort();
					}
				}
			} catch (e) {
				// May throw
			}

			// Should have error event or aborted in result
			const hasErrorEvent = events.some(e => e.type === 'error');
			const result = await stream.result();

			expect(hasErrorEvent || result.stopReason === 'aborted').toBe(true);
		}, 30000);
	});

	describe('error handling', () => {
		it('should emit error event on API error', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const stream = streamZai(
				model,
				context,
				{ apiKey: 'invalid-key-12345' },
				'test-msg-17'
			);

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const errorEvent = events.find(e => e.type === 'error');
			expect(errorEvent).toBeDefined();
		}, 30000);

		it('should return error result on API error', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const stream = streamZai(
				model,
				context,
				{ apiKey: 'invalid-key-12345' },
				'test-msg-18'
			);

			// Consume stream
			for await (const _ of stream) {
				// Just consume
			}

			const result = await stream.result();

			expect(result.stopReason).toBe('error');
			expect(result.errorMessage).toBeDefined();
			expect(result.usage.totalTokens).toBe(0);
		}, 30000);
	});

	describe('message updates', () => {
		it('should update message timestamp in events', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-19');

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			// All events should have message with timestamp
			events.forEach(event => {
				expect(event.message.timestamp).toBeDefined();
				expect(typeof event.message.timestamp).toBe('number');
			});
		}, 30000);

		it('should include contentIndex in delta events', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say hello' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-20');

			const events: BaseAssistantEvent<'zai'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const deltaEvents = events.filter(e => e.type === 'text_delta' || e.type === 'thinking_delta' || e.type === 'toolcall_delta');

			if (deltaEvents.length > 0) {
				deltaEvents.forEach(event => {
					if ('contentIndex' in event) {
						expect(typeof event.contentIndex).toBe('number');
					}
				});
			}
		}, 30000);
	});

	describe('system prompt handling', () => {
		it('should handle system prompt in streaming', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'What is your role?' }],
					},
				],
				systemPrompt: 'You are a helpful assistant.',
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-21');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();
			expect(result.stopReason).toBe('stop');
		}, 30000);
	});

	describe('native message format', () => {
		it('should include ChatCompletion in final result message', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "test"' }],
					},
				],
			};

			const stream = streamZai(model, context, { apiKey }, 'test-msg-22');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Should have ChatCompletion structure
			expect(result.message).toBeDefined();
			expect(result.message).toHaveProperty('id');
			expect(result.message).toHaveProperty('choices');
			expect(result.message).toHaveProperty('model');
			expect(result.message).toHaveProperty('usage');
		}, 30000);

		it('should include reasoning_content in message when thinking enabled', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Think about: What is 5 + 3?' }],
					},
				],
			};

			const stream = streamZai(
				model,
				context,
				{ apiKey, thinking: { type: 'enabled' } },
				'test-msg-23'
			);

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Check if reasoning_content is in the native message
			const message = result.message.choices[0]?.message as any;
			if (message?.reasoning_content) {
				expect(typeof message.reasoning_content).toBe('string');
				expect(message.reasoning_content.length).toBeGreaterThan(0);
			}
		}, 60000);
	});
});
