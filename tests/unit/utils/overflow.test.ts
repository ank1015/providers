import { describe, it, expect } from 'vitest';
import { isContextOverflow, getOverflowPatterns } from '../../../src/utils/overflow.js';
import type { BaseAssistantMessage, Api, Model, Usage } from '../../../src/types.js';

// Helper to create a mock assistant message
function createMessage(
	stopReason: 'stop' | 'error' | 'length' | 'toolUse' | 'aborted',
	errorMessage?: string,
	usage?: Partial<Usage>
): BaseAssistantMessage<Api> {
	const defaultUsage: Usage = {
		input: 1000,
		output: 100,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 1100,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};

	return {
		role: 'assistant',
		message: {} as any,
		api: 'openai',
		id: 'test-id',
		model: { id: 'gpt-4', api: 'openai' } as Model<'openai'>,
		timestamp: Date.now(),
		duration: 100,
		stopReason,
		errorMessage,
		content: [],
		usage: { ...defaultUsage, ...usage },
	};
}

describe('isContextOverflow', () => {
	describe('Anthropic error patterns', () => {
		it('should detect "prompt is too long" pattern', () => {
			const message = createMessage('error', 'prompt is too long: 213462 tokens > 200000 maximum');
			expect(isContextOverflow(message)).toBe(true);
		});

		it('should detect case insensitive', () => {
			const message = createMessage('error', 'PROMPT IS TOO LONG: 213462 tokens > 200000 maximum');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('OpenAI error patterns', () => {
		it('should detect "exceeds the context window" pattern', () => {
			const message = createMessage('error', 'Your input exceeds the context window of this model');
			expect(isContextOverflow(message)).toBe(true);
		});

		it('should detect context window pattern in longer message', () => {
			const message = createMessage('error', 'Error: The request exceeds the context window. Please reduce input size.');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('Google error patterns', () => {
		it('should detect "input token count exceeds the maximum" pattern', () => {
			const message = createMessage('error', 'The input token count (1196265) exceeds the maximum number of tokens allowed (1048575)');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('xAI error patterns', () => {
		it('should detect "maximum prompt length" pattern', () => {
			const message = createMessage('error', "This model's maximum prompt length is 131072 but the request contains 537812 tokens");
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('Groq error patterns', () => {
		it('should detect "reduce the length of the messages" pattern', () => {
			const message = createMessage('error', 'Please reduce the length of the messages or completion');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('OpenRouter error patterns', () => {
		it('should detect "maximum context length is X tokens" pattern', () => {
			const message = createMessage('error', "This endpoint's maximum context length is 8192 tokens. However, you requested about 15000 tokens");
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('llama.cpp error patterns', () => {
		it('should detect "exceeds the available context size" pattern', () => {
			const message = createMessage('error', 'the request exceeds the available context size, try increasing it');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('LM Studio error patterns', () => {
		it('should detect "greater than the context length" pattern', () => {
			const message = createMessage('error', 'tokens to keep from the initial prompt is greater than the context length');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('Generic fallback patterns', () => {
		it('should detect "context length exceeded" pattern', () => {
			const message = createMessage('error', 'context length exceeded');
			expect(isContextOverflow(message)).toBe(true);
		});

		it('should detect "too many tokens" pattern', () => {
			const message = createMessage('error', 'Request has too many tokens');
			expect(isContextOverflow(message)).toBe(true);
		});

		it('should detect "token limit exceeded" pattern', () => {
			const message = createMessage('error', 'token limit exceeded for this model');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('Status code patterns (Cerebras, Mistral)', () => {
		it('should detect "400 status code (no body)" pattern', () => {
			const message = createMessage('error', '400 status code (no body)');
			expect(isContextOverflow(message)).toBe(true);
		});

		it('should detect "413 status code (no body)" pattern', () => {
			const message = createMessage('error', '413 status code (no body)');
			expect(isContextOverflow(message)).toBe(true);
		});

		it('should detect "400 (no body)" pattern', () => {
			const message = createMessage('error', '400 (no body)');
			expect(isContextOverflow(message)).toBe(true);
		});
	});

	describe('Non-overflow errors', () => {
		it('should return false for rate limit errors', () => {
			const message = createMessage('error', 'Rate limit exceeded. Please try again later.');
			expect(isContextOverflow(message)).toBe(false);
		});

		it('should return false for authentication errors', () => {
			const message = createMessage('error', 'Invalid API key provided');
			expect(isContextOverflow(message)).toBe(false);
		});

		it('should return false for network errors', () => {
			const message = createMessage('error', 'Connection timeout');
			expect(isContextOverflow(message)).toBe(false);
		});

		it('should return false for generic server errors', () => {
			const message = createMessage('error', 'Internal server error');
			expect(isContextOverflow(message)).toBe(false);
		});

		it('should return false when stopReason is not error', () => {
			const message = createMessage('stop', 'prompt is too long'); // This would match, but stopReason is 'stop'
			expect(isContextOverflow(message)).toBe(false);
		});

		it('should return false when no error message', () => {
			const message = createMessage('error', undefined);
			expect(isContextOverflow(message)).toBe(false);
		});
	});

	describe('Silent overflow detection (z.ai style)', () => {
		it('should detect silent overflow when usage.input exceeds contextWindow', () => {
			const message = createMessage('stop', undefined, { input: 150000, cacheRead: 0 });
			expect(isContextOverflow(message, 100000)).toBe(true);
		});

		it('should detect silent overflow including cacheRead tokens', () => {
			const message = createMessage('stop', undefined, { input: 80000, cacheRead: 30000 });
			// Total: 80000 + 30000 = 110000 > 100000
			expect(isContextOverflow(message, 100000)).toBe(true);
		});

		it('should not detect overflow when under contextWindow', () => {
			const message = createMessage('stop', undefined, { input: 50000, cacheRead: 10000 });
			// Total: 50000 + 10000 = 60000 < 100000
			expect(isContextOverflow(message, 100000)).toBe(false);
		});

		it('should not check silent overflow when stopReason is error', () => {
			const message = createMessage('error', 'Some other error', { input: 150000 });
			expect(isContextOverflow(message, 100000)).toBe(false);
		});

		it('should not check silent overflow when contextWindow not provided', () => {
			const message = createMessage('stop', undefined, { input: 150000 });
			expect(isContextOverflow(message)).toBe(false);
		});

		it('should handle edge case at exact context window limit', () => {
			const message = createMessage('stop', undefined, { input: 100000, cacheRead: 0 });
			expect(isContextOverflow(message, 100000)).toBe(false);
		});

		it('should detect overflow at one token over limit', () => {
			const message = createMessage('stop', undefined, { input: 100001, cacheRead: 0 });
			expect(isContextOverflow(message, 100000)).toBe(true);
		});
	});
});

describe('getOverflowPatterns', () => {
	it('should return an array of RegExp patterns', () => {
		const patterns = getOverflowPatterns();
		expect(Array.isArray(patterns)).toBe(true);
		expect(patterns.length).toBeGreaterThan(0);
		patterns.forEach(pattern => {
			expect(pattern).toBeInstanceOf(RegExp);
		});
	});

	it('should return a copy (not the original array)', () => {
		const patterns1 = getOverflowPatterns();
		const patterns2 = getOverflowPatterns();
		expect(patterns1).not.toBe(patterns2);
	});

	it('should contain all documented provider patterns', () => {
		const patterns = getOverflowPatterns();
		const patternStrings = patterns.map(p => p.source);

		// Check for key patterns (not exhaustive, but covers main providers)
		expect(patternStrings.some(p => p.includes('prompt is too long'))).toBe(true);
		expect(patternStrings.some(p => p.includes('context window'))).toBe(true);
		expect(patternStrings.some(p => p.includes('token count'))).toBe(true);
		expect(patternStrings.some(p => p.includes('maximum prompt length'))).toBe(true);
	});
});
