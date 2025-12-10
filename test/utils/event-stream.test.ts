import { describe, it, expect } from 'vitest';
import { EventStream } from '../../src/utils/event-stream';

describe('EventStream', () => {
	describe('Basic functionality', () => {
		it('should push and iterate events', async () => {
			const stream = new EventStream<string, number>();

			// Push events
			stream.push('event1');
			stream.push('event2');
			stream.push('event3');
			stream.end(42);

			// Collect events
			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual(['event1', 'event2', 'event3']);
		});

		it('should handle result promise', async () => {
			const stream = new EventStream<string, number>();

			stream.push('event1');
			stream.end(42);

			const result = await stream.result();
			expect(result).toBe(42);
		});

		it('should handle result before end (waits for end)', async () => {
			const stream = new EventStream<string, number>();

			stream.push('event1');

			// Request result before end
			const resultPromise = stream.result();

			// End stream after a delay
			setTimeout(() => {
				stream.end(42);
			}, 10);

			const result = await resultPromise;
			expect(result).toBe(42);
		});
	});

	describe('Push multiple events before iteration', () => {
		it('should queue events when no consumer is ready', async () => {
			const stream = new EventStream<number, string>();

			// Push many events before iteration starts
			for (let i = 0; i < 100; i++) {
				stream.push(i);
			}
			stream.end('done');

			// Now iterate and collect
			const events: number[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toHaveLength(100);
			expect(events).toEqual(Array.from({ length: 100 }, (_, i) => i));
		});
	});

	describe('Iteration waits for events (waiter-based)', () => {
		it('should wait for events to arrive during iteration', async () => {
			const stream = new EventStream<string, void>();
			const events: string[] = [];

			// Start iteration in background
			const iterationPromise = (async () => {
				for await (const event of stream) {
					events.push(event);
				}
			})();

			// Push events with delays
			await new Promise(resolve => setTimeout(resolve, 10));
			stream.push('event1');

			await new Promise(resolve => setTimeout(resolve, 10));
			stream.push('event2');

			await new Promise(resolve => setTimeout(resolve, 10));
			stream.push('event3');

			await new Promise(resolve => setTimeout(resolve, 10));
			stream.end();

			// Wait for iteration to complete
			await iterationPromise;

			expect(events).toEqual(['event1', 'event2', 'event3']);
		});
	});

	describe('Multiple concurrent iterators', () => {
		it('should handle events distributed across multiple iterators', async () => {
			// Note: EventStream is a queue-based system where events are consumed
			// Multiple iterators will share/compete for events, not all receive all events
			const stream = new EventStream<number, void>();

			const events1: number[] = [];
			const events2: number[] = [];

			// Start two concurrent consumers
			const consumer1 = (async () => {
				for await (const event of stream) {
					events1.push(event);
				}
			})();

			const consumer2 = (async () => {
				for await (const event of stream) {
					events2.push(event);
				}
			})();

			// Push events
			stream.push(1);
			stream.push(2);
			stream.push(3);
			stream.end();

			await Promise.all([consumer1, consumer2]);

			// Events should be distributed across consumers
			const totalEvents = [...events1, ...events2];
			expect(totalEvents.sort()).toEqual([1, 2, 3]);
		});
	});

	describe('Iteration after stream ended', () => {
		it('should allow iteration after stream has ended', async () => {
			const stream = new EventStream<string, number>();

			stream.push('event1');
			stream.push('event2');
			stream.end(42);

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 10));

			// Now iterate (after stream has ended)
			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual(['event1', 'event2']);
		});
	});

	describe('Event queue behavior', () => {
		it('should maintain event order', async () => {
			const stream = new EventStream<number, void>();

			// Push events rapidly
			for (let i = 0; i < 1000; i++) {
				stream.push(i);
			}
			stream.end();

			// Collect and verify order
			const events: number[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual(Array.from({ length: 1000 }, (_, i) => i));
		});
	});

	describe('Type safety', () => {
		it('should enforce event type', async () => {
			interface CustomEvent {
				type: string;
				data: number;
			}

			const stream = new EventStream<CustomEvent, string>();

			stream.push({ type: 'test', data: 42 });
			stream.push({ type: 'another', data: 100 });
			stream.end('final result');

			const events: CustomEvent[] = [];
			for await (const event of stream) {
				events.push(event);
				expect(event).toHaveProperty('type');
				expect(event).toHaveProperty('data');
			}

			const result = await stream.result();
			expect(result).toBe('final result');
		});
	});

	describe('Edge cases', () => {
		it('should handle stream with no events', async () => {
			const stream = new EventStream<string, number>();
			stream.end(42);

			const events: string[] = [];
			for await (const event of stream) {
				events.push(event);
			}

			expect(events).toEqual([]);
			expect(await stream.result()).toBe(42);
		});

		it('should handle undefined result', async () => {
			const stream = new EventStream<string, undefined>();
			stream.push('event1');
			stream.end(undefined);

			const result = await stream.result();
			expect(result).toBeUndefined();
		});

		it('should handle null result', async () => {
			const stream = new EventStream<string, null>();
			stream.push('event1');
			stream.end(null);

			const result = await stream.result();
			expect(result).toBeNull();
		});

		it('should handle complex object results', async () => {
			interface Result {
				status: string;
				data: { items: number[] };
			}

			const stream = new EventStream<string, Result>();
			stream.push('event1');

			const expectedResult: Result = {
				status: 'success',
				data: { items: [1, 2, 3] }
			};
			stream.end(expectedResult);

			const result = await stream.result();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('Mixed push and iteration patterns', () => {
		it('should handle events pushed during iteration', async () => {
			const stream = new EventStream<number, void>();
			const events: number[] = [];
			let pushCount = 0;

			// Start iteration
			const iterationPromise = (async () => {
				for await (const event of stream) {
					events.push(event);

					// Push more events during iteration
					if (pushCount < 5) {
						pushCount++;
						setTimeout(() => stream.push(pushCount), 5);
					} else if (pushCount === 5) {
						pushCount++;
						setTimeout(() => stream.end(), 5);
					}
				}
			})();

			// Start the process
			stream.push(0);

			await iterationPromise;

			expect(events).toHaveLength(6); // 0, 1, 2, 3, 4, 5
		});
	});
});
