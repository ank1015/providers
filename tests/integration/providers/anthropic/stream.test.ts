import { describe, it, expect, beforeAll } from 'vitest';
import { streamAnthropic } from '../../../../src/providers/anthropic/stream.js';
import { getModel } from '../../../../src/models.js';
import type { Context, Model, BaseAssistantEvent } from '../../../../src/types.js';
import { Type } from '@sinclair/typebox';

describe('Anthropic Stream Integration', () => {
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-1');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-2');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-3');

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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-4');

			let textEndEvent: BaseAssistantEvent<'anthropic'> | undefined;
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-5');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-6');

			// Consume stream
			for await (const _ of stream) {
				// Just consume
			}

			const result = await stream.result();

			expect(result.role).toBe('assistant');
			expect(result.id).toBe('test-msg-6');
			expect(result.api).toBe('anthropic');
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-7');

			// Consume stream
			for await (const _ of stream) {
				// Just consume
			}

			const result = await stream.result();

			expect(result.usage.input).toBeGreaterThan(0);
			expect(result.usage.output).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBeGreaterThan(0);
			expect(result.usage.cost.total).toBeGreaterThan(0);
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-8');

			// Don't consume stream, just await result
			const result = await stream.result();

			expect(result.role).toBe('assistant');
			expect(result.content).toBeDefined();
		}, 30000);

		it('should populate message.content with native Anthropic content blocks', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "native content test"' }],
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-native');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Verify native Anthropic message content is populated (bug fix verification)
			expect(result.message).toBeDefined();
			expect(result.message.content).toBeDefined();
			expect(Array.isArray(result.message.content)).toBe(true);
			expect(result.message.content.length).toBeGreaterThan(0);

			// Verify the content has the expected Anthropic structure
			const textBlock = result.message.content.find((c: any) => c.type === 'text');
			expect(textBlock).toBeDefined();
			if (textBlock && textBlock.type === 'text') {
				expect(typeof textBlock.text).toBe('string');
				expect(textBlock.text.length).toBeGreaterThan(0);
			}
		}, 30000);

		it('should capture message metadata (id, model) from stream', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hi' }],
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-metadata');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Verify message metadata is captured from message_start event (bug fix verification)
			expect(result.message.id).toBeDefined();
			expect(result.message.id).not.toBe('msg_01XFDUDYJgAACzvnptvVoYEL'); // Should not be the mock ID
			expect(result.message.id).toMatch(/^msg_/); // Anthropic message IDs start with msg_
			expect(result.message.model).toBeDefined();
			expect(result.message.role).toBe('assistant');
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 500 }, 'test-msg-9');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 500 }, 'test-msg-10');

			const toolcallDeltas: string[] = [];
			for await (const event of stream) {
				if (event.type === 'toolcall_delta') {
					toolcallDeltas.push(event.delta);
				}
			}

			// Should have received some deltas for the arguments JSON
			expect(toolcallDeltas.length).toBeGreaterThan(0);
		}, 30000);

		it('should return toolUse stop reason when tool is called', async () => {
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 500 }, 'test-msg-11');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			expect(result.stopReason).toBe('toolUse');
			const toolCall = result.content.find(c => c.type === 'toolCall');
			expect(toolCall).toBeDefined();
			if (toolCall && toolCall.type === 'toolCall') {
				expect(toolCall.arguments.location).toBeDefined();
				expect(typeof toolCall.arguments.location).toBe('string');
			}
		}, 30000);

		it('should populate tool_use in native message content', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Calculate 5 + 3' }],
					},
				],
				tools: [
					{
						name: 'calculate',
						description: 'Perform calculations',
						parameters: Type.Object({
							expression: Type.String(),
						}),
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 500 }, 'test-msg-tool-native');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Verify native content has tool_use block properly populated (bug fix verification)
			expect(result.message.content).toBeDefined();
			const toolUseBlock = result.message.content.find((c: any) => c.type === 'tool_use');
			expect(toolUseBlock).toBeDefined();
			if (toolUseBlock) {
				expect((toolUseBlock as any).id).toBeDefined();
				expect((toolUseBlock as any).name).toBe('calculate');
				expect((toolUseBlock as any).input).toBeDefined();
				expect(typeof (toolUseBlock as any).input).toBe('object');
			}
		}, 30000);
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
			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 2000, signal: controller.signal }, 'test-msg-12');

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
			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 2000, signal: controller.signal }, 'test-msg-13');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

		it('should preserve input token count when aborted', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Write a long essay about the history of computing' }],
					},
				],
			};

			const controller = new AbortController();
			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 2000, signal: controller.signal }, 'test-msg-abort-usage');

			let eventCount = 0;
			try {
				for await (const event of stream) {
					eventCount++;
					// Abort after receiving start event to ensure message_start was processed
					if (eventCount > 1) {
						controller.abort();
					}
				}
			} catch (e) {
				// Expected
			}

			const result = await stream.result();

			// Input tokens should be preserved from message_start even when aborted (bug fix verification)
			expect(result.usage.input).toBeGreaterThan(0);
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

			const stream = streamAnthropic(
				model,
				context,
				{ apiKey: 'invalid-key-12345', max_tokens: 100 },
				'test-msg-14'
			);

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

			const stream = streamAnthropic(
				model,
				context,
				{ apiKey: 'invalid-key-12345', max_tokens: 100 },
				'test-msg-15'
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-16');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-17');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const deltaEvents = events.filter(e => e.type === 'text_delta' || e.type === 'thinking_delta' || e.type === 'toolcall_delta');

			if (deltaEvents.length > 0) {
				deltaEvents.forEach(event => {
					if ('contentIndex' in event) {
						expect(typeof event.contentIndex).toBe('number');
						expect(event.contentIndex).toBeGreaterThanOrEqual(0);
					}
				});
			}
		}, 30000);

		it('should handle first content block correctly (index 0)', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Say "test"' }],
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-index0');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Verify first content block is properly populated (bug fix verification for findIndex === 0)
			expect(result.content.length).toBeGreaterThan(0);
			expect(result.message.content.length).toBeGreaterThan(0);

			// The first text block should have content
			const firstTextBlock = result.message.content.find((c: any) => c.type === 'text');
			if (firstTextBlock && firstTextBlock.type === 'text') {
				expect(firstTextBlock.text.length).toBeGreaterThan(0);
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 200 }, 'test-msg-18');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();
			expect(result.stopReason).toBe('stop');
		}, 30000);
	});

	describe('usage tracking during stream', () => {
		it('should have usage data in done event', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-usage');

			let doneEvent: BaseAssistantEvent<'anthropic'> | undefined;
			for await (const event of stream) {
				if (event.type === 'done') {
					doneEvent = event;
				}
			}

			expect(doneEvent).toBeDefined();
			if (doneEvent && doneEvent.type === 'done') {
				expect(doneEvent.message.usage.input).toBeGreaterThan(0);
				expect(doneEvent.message.usage.output).toBeGreaterThan(0);
			}
		}, 30000);

		it('should preserve input tokens from message_start in final usage', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Count from 1 to 10' }],
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 200 }, 'test-msg-input-tokens');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			// Input tokens should be preserved and not overwritten by message_delta (bug fix verification)
			expect(result.usage.input).toBeGreaterThan(0);
			expect(result.usage.output).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBe(
				result.usage.input + result.usage.output + result.usage.cacheRead + result.usage.cacheWrite
			);
		}, 30000);
	});

	describe('duration tracking', () => {
		it('should calculate duration in final result', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'Hello' }],
					},
				],
			};

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 100 }, 'test-msg-duration');

			for await (const _ of stream) {
				// Consume
			}

			const result = await stream.result();

			expect(result.duration).toBeDefined();
			expect(result.duration).toBeGreaterThan(0);
			expect(typeof result.duration).toBe('number');
		}, 30000);
	});

	describe('multi-block responses', () => {
		it('should handle responses with text followed by tool call', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						id: 'test-1',
						content: [{ type: 'text', content: 'I want to check the weather in London. Can you help me with that?' }],
					},
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

			const stream = streamAnthropic(model, context, { apiKey, max_tokens: 500 }, 'test-msg-multiblock');

			const events: BaseAssistantEvent<'anthropic'>[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			const result = await stream.result();

			// May have both text and tool call content
			const hasText = result.content.some(c => c.type === 'response');
			const hasTool = result.content.some(c => c.type === 'toolCall');

			// At minimum should have one of them
			expect(hasText || hasTool).toBe(true);

			// Native message should also have the content
			expect(result.message.content.length).toBeGreaterThan(0);
		}, 30000);
	});
});
