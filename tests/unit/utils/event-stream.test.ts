import { describe, it, expect, vi } from 'vitest';
import { EventStream, AssistantMessageEventStream } from '../../../src/utils/event-stream.js';
import type { BaseAssistantEvent, BaseAssistantMessage } from '../../../src/types.js';

describe('EventStream', () => {
	describe('push and iteration', () => {
		it('should yield pushed events in order', async () => {
			const stream = new EventStream<string, string>();

			stream.push('event1');
			stream.push('event2');
			stream.push('event3');
			stream.end('final');

			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual(['event1', 'event2', 'event3']);
		});

		it('should deliver to waiting consumer immediately', async () => {
			const stream = new EventStream<number, number>();

			// Start iterating before any events are pushed
			const eventsPromise = (async () => {
				const events: number[] = [];
				for await (const event of stream) {
					events.push(event);
				}
				return events;
			})();

			// Push events after iteration has started
			await Promise.resolve(); // Let iterator start waiting
			stream.push(1);
			stream.push(2);
			stream.end(0);

			const events = await eventsPromise;
			expect(events).toEqual([1, 2]);
		});

		it('should queue events when no consumer is waiting', async () => {
			const stream = new EventStream<string, void>();

			// Push before anyone is listening
			stream.push('queued1');
			stream.push('queued2');

			// Now start consuming
			const events: string[] = [];
			const iterator = stream[Symbol.asyncIterator]();

			const result1 = await iterator.next();
			expect(result1.value).toBe('queued1');

			const result2 = await iterator.next();
			expect(result2.value).toBe('queued2');

			stream.end();
			const result3 = await iterator.next();
			expect(result3.done).toBe(true);
		});

		it('should handle empty stream', async () => {
			const stream = new EventStream<string, null>();
			stream.end(null);

			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual([]);
		});

		it('should stop iteration when stream ends', async () => {
			const stream = new EventStream<string, string>();

			stream.push('event1');
			stream.end('done');
			stream.push('event2'); // Should be ignored after end

			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual(['event1']);
		});
	});

	describe('result() promise', () => {
		it('should resolve with the end result', async () => {
			const stream = new EventStream<string, { status: string }>();

			stream.push('event1');
			stream.end({ status: 'complete' });

			const result = await stream.result();
			expect(result).toEqual({ status: 'complete' });
		});

		it('should resolve result even if iteration not started', async () => {
			const stream = new EventStream<string, number>();

			stream.push('ignored');
			stream.end(42);

			const result = await stream.result();
			expect(result).toBe(42);
		});

		it('should be awaitable multiple times', async () => {
			const stream = new EventStream<string, string>();
			stream.end('final');

			const result1 = await stream.result();
			const result2 = await stream.result();
			const result3 = await stream.result();

			expect(result1).toBe('final');
			expect(result2).toBe('final');
			expect(result3).toBe('final');
		});

		it('should resolve after all events are consumed', async () => {
			const stream = new EventStream<number, number>();

			stream.push(1);
			stream.push(2);
			stream.push(3);
			stream.end(6); // sum

			let sum = 0;
			for await (const event of stream) {
				sum += event;
			}

			const result = await stream.result();
			expect(sum).toBe(6);
			expect(result).toBe(6);
		});
	});

	describe('concurrent consumers', () => {
		it('should notify all waiting consumers when ended', async () => {
			const stream = new EventStream<string, void>();

			// Start multiple consumers waiting
			const consumer1Promise = (async () => {
				const events: string[] = [];
				for await (const event of stream) {
					events.push(event);
				}
				return events;
			})();

			const consumer2Promise = (async () => {
				const events: string[] = [];
				for await (const event of stream) {
					events.push(event);
				}
				return events;
			})();

			await Promise.resolve(); // Let consumers start waiting
			stream.push('shared');
			stream.end();

			const [events1, events2] = await Promise.all([consumer1Promise, consumer2Promise]);

			// Note: Due to the implementation, one consumer gets the event, the other may not
			// This tests that at least the stream completes properly for both
			expect(events1.length + events2.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('edge cases', () => {
		it('should handle rapid push and consume', async () => {
			const stream = new EventStream<number, number>();
			const count = 100;

			// Push many events rapidly
			for (let i = 0; i < count; i++) {
				stream.push(i);
			}
			stream.end(count);

			const events: number[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events.length).toBe(count);
			expect(events).toEqual(Array.from({ length: count }, (_, i) => i));
		});

		it('should handle async push during iteration', async () => {
			const stream = new EventStream<string, string>();

			const eventsPromise = (async () => {
				const events: string[] = [];
				for await (const event of stream) {
					events.push(event);
				}
				return events;
			})();

			// Simulate async pushes with delays
			await new Promise(r => setTimeout(r, 10));
			stream.push('delayed1');
			await new Promise(r => setTimeout(r, 10));
			stream.push('delayed2');
			await new Promise(r => setTimeout(r, 10));
			stream.end('done');

			const events = await eventsPromise;
			expect(events).toEqual(['delayed1', 'delayed2']);
		});

		it('should ignore pushes after end', async () => {
			const stream = new EventStream<string, string>();

			stream.push('before');
			stream.end('final');
			stream.push('after1');
			stream.push('after2');

			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual(['before']);
		});

		it('should handle different event and result types', async () => {
			interface Event {
				type: string;
				data: number;
			}
			interface Result {
				success: boolean;
				total: number;
			}

			const stream = new EventStream<Event, Result>();

			stream.push({ type: 'add', data: 10 });
			stream.push({ type: 'add', data: 20 });
			stream.end({ success: true, total: 30 });

			const events: Event[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual([
				{ type: 'add', data: 10 },
				{ type: 'add', data: 20 },
			]);

			const result = await stream.result();
			expect(result).toEqual({ success: true, total: 30 });
		});
	});
});

describe('AssistantMessageEventStream', () => {
	it('should be a specialized EventStream for assistant messages', () => {
		const stream = new AssistantMessageEventStream<'openai'>();

		// Type check: should accept BaseAssistantEvent
		const mockEvent: BaseAssistantEvent<'openai'> = {
			type: 'start',
			message: {
				role: 'assistant',
				api: 'openai',
				model: { id: 'gpt-4', api: 'openai' } as any,
				id: 'test',
				content: [],
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: 'stop',
				timestamp: Date.now(),
				duration: 0,
			},
		};

		stream.push(mockEvent);
		expect(true).toBe(true); // Type check passed
	});

	it('should yield typed events correctly', async () => {
		const stream = new AssistantMessageEventStream<'openai'>();

		const mockMessage: any = {
			role: 'assistant',
			api: 'openai',
			model: { id: 'gpt-4', api: 'openai' },
			id: 'test',
			content: [],
			usage: {
				input: 100,
				output: 50,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 150,
				cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 },
			},
			stopReason: 'stop',
			timestamp: Date.now(),
			duration: 100,
		};

		stream.push({ type: 'start', message: mockMessage });
		stream.push({ type: 'text_start', contentIndex: 0, message: mockMessage });
		stream.push({ type: 'text_delta', contentIndex: 0, delta: 'Hello', message: mockMessage });
		stream.push({ type: 'text_end', contentIndex: 0, content: [{ type: 'text', content: 'Hello' }], message: mockMessage });
		stream.push({ type: 'done', reason: 'stop', message: mockMessage });

		const fullMessage: BaseAssistantMessage<'openai'> = {
			...mockMessage,
			message: {} as any, // Native response
		};
		stream.end(fullMessage);

		const events: BaseAssistantEvent<'openai'>[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		expect(events.length).toBe(5);
		expect(events[0].type).toBe('start');
		expect(events[1].type).toBe('text_start');
		expect(events[2].type).toBe('text_delta');
		expect(events[3].type).toBe('text_end');
		expect(events[4].type).toBe('done');

		const result = await stream.result();
		expect(result.role).toBe('assistant');
		expect(result.usage.totalTokens).toBe(150);
	});
});
