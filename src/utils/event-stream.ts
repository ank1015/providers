import { NativeAssistantMessage, AssistantMessageEvent } from "../types";

// Generic event stream class for async iteration
export class EventStream<T, R = T> implements AsyncIterable<T> {
	private queue: T[] = [];
	private waiting: ((value: IteratorResult<T>) => void)[] = [];
	private done = false;
	private finalResultPromise: Promise<R>;
	private resolveFinalResult!: (result: R) => void;

	constructor() {
		this.finalResultPromise = new Promise((resolve) => {
			this.resolveFinalResult = resolve;
		});
	}

	push(event: T): void {
		if (this.done) return;

		// Deliver to waiting consumer or queue it
		const waiter = this.waiting.shift();
		if (waiter) {
			waiter({ value: event, done: false });
		} else {
			this.queue.push(event);
		}
	}

	end(result: R): void {
		this.done = true;
		// Always resolve the final result to prevent deadlock
		this.resolveFinalResult(result);
		// Notify all waiting consumers that we're done
		while (this.waiting.length > 0) {
			const waiter = this.waiting.shift()!;
			// When done is true, value type is the return type (void for async generators)
			waiter({ done: true, value: undefined! });
		}
	}

	async *[Symbol.asyncIterator](): AsyncIterator<T> {
		while (true) {
			if (this.queue.length > 0) {
				yield this.queue.shift()!;
			} else if (this.done) {
				return;
			} else {
				const result = await new Promise<IteratorResult<T>>((resolve) => this.waiting.push(resolve));
				if (result.done) return;
				yield result.value;
			}
		}
	}

	result(): Promise<R> {
		return this.finalResultPromise;
	}
}

export class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, NativeAssistantMessage> {}