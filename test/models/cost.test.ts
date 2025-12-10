import { describe, it, expect } from 'vitest';
import { calculateCost } from '../../src/models';
import { Model, Usage } from '../../src/types';

const mockModel: Model<'openai'> = {
	id: 'test-model',
	name: 'Test Model',
	api: 'openai',
	baseUrl: 'https://api.openai.com',
	reasoning: false,
	input: ['text'],
	cost: {
		input: 0.15,        // $0.15 per million tokens
		output: 0.60,       // $0.60 per million tokens
		cacheRead: 0.015,   // $0.015 per million tokens
		cacheWrite: 0.30,   // $0.30 per million tokens
	},
	contextWindow: 128000,
	maxTokens: 4096,
};

describe('calculateCost', () => {
	describe('Basic calculations', () => {
		it('should calculate input token cost', () => {
			const usage: Usage = {
				input: 1000,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 1000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// 1000 tokens * ($0.15 / 1,000,000) = $0.00015
			expect(usage.cost.input).toBeCloseTo(0.00015, 10);
			expect(usage.cost.total).toBeCloseTo(0.00015, 10);
		});

		it('should calculate output token cost', () => {
			const usage: Usage = {
				input: 0,
				output: 500,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 500,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// 500 tokens * ($0.60 / 1,000,000) = $0.0003
			expect(usage.cost.output).toBeCloseTo(0.0003, 10);
			expect(usage.cost.total).toBeCloseTo(0.0003, 10);
		});

		it('should calculate cache read token cost', () => {
			const usage: Usage = {
				input: 0,
				output: 0,
				cacheRead: 10000,
				cacheWrite: 0,
				totalTokens: 10000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// 10000 tokens * ($0.015 / 1,000,000) = $0.00015
			expect(usage.cost.cacheRead).toBeCloseTo(0.00015, 10);
			expect(usage.cost.total).toBeCloseTo(0.00015, 10);
		});

		it('should calculate cache write token cost', () => {
			const usage: Usage = {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 5000,
				totalTokens: 5000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// 5000 tokens * ($0.30 / 1,000,000) = $0.0015
			expect(usage.cost.cacheWrite).toBeCloseTo(0.0015, 10);
			expect(usage.cost.total).toBeCloseTo(0.0015, 10);
		});
	});

	describe('Combined calculations', () => {
		it('should calculate total cost for all token types', () => {
			const usage: Usage = {
				input: 1000,
				output: 500,
				cacheRead: 2000,
				cacheWrite: 1000,
				totalTokens: 4500,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Input: 1000 * 0.15 / 1M = 0.00015
			// Output: 500 * 0.60 / 1M = 0.0003
			// Cache Read: 2000 * 0.015 / 1M = 0.00003
			// Cache Write: 1000 * 0.30 / 1M = 0.0003
			// Total: 0.00015 + 0.0003 + 0.00003 + 0.0003 = 0.00078
			expect(usage.cost.input).toBeCloseTo(0.00015, 10);
			expect(usage.cost.output).toBeCloseTo(0.0003, 10);
			expect(usage.cost.cacheRead).toBeCloseTo(0.00003, 10);
			expect(usage.cost.cacheWrite).toBeCloseTo(0.0003, 10);
			expect(usage.cost.total).toBeCloseTo(0.00078, 10);
		});

		it('should calculate cost for typical conversation', () => {
			const usage: Usage = {
				input: 5000,
				output: 2000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 7000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			expect(usage.cost.total).toBeCloseTo(0.00195, 10);
		});

		it('should calculate cost with caching enabled', () => {
			const usage: Usage = {
				input: 1000,
				output: 500,
				cacheRead: 10000,  // Most context from cache
				cacheWrite: 1000,  // New context cached
				totalTokens: 12500,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Cache read rate per token should be cheaper than input rate per token
			const cacheReadPerToken = usage.cost.cacheRead / usage.cacheRead;
			const inputPerToken = usage.cost.input / usage.input;
			expect(cacheReadPerToken).toBeLessThan(inputPerToken);

			// Total should be much cheaper than if all 12500 were input tokens
			const allInputCost = (12500 * mockModel.cost.input) / 1000000;
			expect(usage.cost.total).toBeLessThan(allInputCost);
		});
	});

	describe('Zero token cases', () => {
		it('should return zero cost for zero tokens', () => {
			const usage: Usage = {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			expect(usage.cost.input).toBe(0);
			expect(usage.cost.output).toBe(0);
			expect(usage.cost.cacheRead).toBe(0);
			expect(usage.cost.cacheWrite).toBe(0);
			expect(usage.cost.total).toBe(0);
		});

		it('should handle zero cost model', () => {
			const freeModel: Model<'openai'> = {
				...mockModel,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
				},
			};

			const usage: Usage = {
				input: 10000,
				output: 5000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 15000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(freeModel, usage);

			expect(usage.cost.total).toBe(0);
		});
	});

	describe('High token counts', () => {
		it('should accurately calculate cost for large token counts', () => {
			const usage: Usage = {
				input: 100000,   // 100k tokens
				output: 50000,   // 50k tokens
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 150000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Input: 100000 * 0.15 / 1M = 0.015
			// Output: 50000 * 0.60 / 1M = 0.03
			// Total: 0.045
			expect(usage.cost.input).toBeCloseTo(0.015, 10);
			expect(usage.cost.output).toBeCloseTo(0.03, 10);
			expect(usage.cost.total).toBeCloseTo(0.045, 10);
		});

		it('should handle million+ token counts', () => {
			const usage: Usage = {
				input: 2000000,  // 2 million tokens
				output: 1000000, // 1 million tokens
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 3000000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Input: 2M * 0.15 / 1M = 0.30
			// Output: 1M * 0.60 / 1M = 0.60
			// Total: 0.90
			expect(usage.cost.input).toBeCloseTo(0.30, 10);
			expect(usage.cost.output).toBeCloseTo(0.60, 10);
			expect(usage.cost.total).toBeCloseTo(0.90, 10);
		});
	});

	describe('Different model pricing', () => {
		it('should calculate cost for expensive model', () => {
			const expensiveModel: Model<'openai'> = {
				...mockModel,
				cost: {
					input: 5.00,   // $5 per million
					output: 15.00, // $15 per million
					cacheRead: 0.50,
					cacheWrite: 2.50,
				},
			};

			const usage: Usage = {
				input: 1000,
				output: 1000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(expensiveModel, usage);

			// Input: 1000 * 5 / 1M = 0.005
			// Output: 1000 * 15 / 1M = 0.015
			// Total: 0.02
			expect(usage.cost.total).toBeCloseTo(0.02, 10);
		});

		it('should calculate cost for cheap model', () => {
			const cheapModel: Model<'openai'> = {
				...mockModel,
				cost: {
					input: 0.01,   // $0.01 per million
					output: 0.03,  // $0.03 per million
					cacheRead: 0.001,
					cacheWrite: 0.005,
				},
			};

			const usage: Usage = {
				input: 10000,
				output: 10000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 20000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(cheapModel, usage);

			// Input: 10000 * 0.01 / 1M = 0.0001
			// Output: 10000 * 0.03 / 1M = 0.0003
			// Total: 0.0004
			expect(usage.cost.total).toBeCloseTo(0.0004, 10);
		});
	});

	describe('Floating point precision', () => {
		it('should maintain precision for very small costs', () => {
			const usage: Usage = {
				input: 1,  // Single token
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Should have meaningful non-zero values
			expect(usage.cost.input).toBeGreaterThan(0);
			expect(usage.cost.output).toBeGreaterThan(0);
			expect(usage.cost.total).toBeGreaterThan(0);
		});

		it('should handle fractional tokens (if they exist)', () => {
			const usage: Usage = {
				input: 1.5,
				output: 2.7,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 4.2,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			expect(usage.cost.total).toBeGreaterThan(0);
			expect(Number.isFinite(usage.cost.total)).toBe(true);
		});
	});

	describe('Per-million token rate conversion', () => {
		it('should correctly convert per-million rates to actual costs', () => {
			const usage: Usage = {
				input: 1000000,  // Exactly 1 million tokens
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 1000000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Should equal the per-million rate
			expect(usage.cost.input).toBeCloseTo(mockModel.cost.input, 10);
		});

		it('should calculate half-million tokens correctly', () => {
			const usage: Usage = {
				input: 500000,  // Half million tokens
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 500000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			calculateCost(mockModel, usage);

			// Should be half the per-million rate
			expect(usage.cost.input).toBeCloseTo(mockModel.cost.input / 2, 10);
		});
	});

	describe('Cost mutation', () => {
		it('should mutate the usage object in place', () => {
			const usage: Usage = {
				input: 1000,
				output: 500,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 1500,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};

			const originalUsage = usage;
			calculateCost(mockModel, usage);

			// Should mutate the same object
			expect(usage).toBe(originalUsage);
			expect(usage.cost.total).toBeGreaterThan(0);
		});
	});
});
