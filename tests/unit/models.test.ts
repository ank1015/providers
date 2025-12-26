import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getProviders, getModel, getModels, calculateCost, getAvailableModels } from '../../src/models.js';
import type { Model, Usage } from '../../src/types.js';

describe('models', () => {
	describe('getProviders', () => {
		it('should return array of known APIs', () => {
			const providers = getProviders();
			expect(Array.isArray(providers)).toBe(true);
			expect(providers.length).toBeGreaterThan(0);
		});

		it('should include openai and google', () => {
			const providers = getProviders();
			expect(providers).toContain('openai');
			expect(providers).toContain('google');
		});

		it('should return exactly 3 providers', () => {
			const providers = getProviders();
			expect(providers.length).toBe(3);
		});

		it('should return a new array each time (not a reference)', () => {
			const providers1 = getProviders();
			const providers2 = getProviders();
			expect(providers1).not.toBe(providers2);
			expect(providers1).toEqual(providers2);
		});
	});

	describe('getModel', () => {
		describe('openai models', () => {
			it('should get gpt-5.2 model', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gpt-5.2');
				expect(model?.api).toBe('openai');
				expect(model?.name).toBe('GPT-5.2');
			});

			it('should get gpt-5.2-pro model', () => {
				const model = getModel('openai', 'gpt-5.2-pro');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gpt-5.2-pro');
				expect(model?.api).toBe('openai');
			});

			it('should get gpt-5.1-codex-max model', () => {
				const model = getModel('openai', 'gpt-5.1-codex-max');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gpt-5.1-codex-max');
			});

			it('should get gpt-5-mini model', () => {
				const model = getModel('openai', 'gpt-5-mini');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gpt-5-mini');
			});

			it('should get gpt-5-nano model', () => {
				const model = getModel('openai', 'gpt-5-nano');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gpt-5-nano');
			});

			it('should get gpt-5 model', () => {
				const model = getModel('openai', 'gpt-5');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gpt-5');
			});

			it('should return undefined for unknown openai model', () => {
				const model = getModel('openai', 'gpt-99' as any);
				expect(model).toBeUndefined();
			});
		});

		describe('google models', () => {
			it('should get gemini-3-pro-preview model', () => {
				const model = getModel('google', 'gemini-3-pro-preview');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gemini-3-pro-preview');
				expect(model?.api).toBe('google');
				expect(model?.name).toBe('Gemini 3 Pro Preview');
			});

			it('should get gemini-3-flash-preview model', () => {
				const model = getModel('google', 'gemini-3-flash-preview');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gemini-3-flash-preview');
			});

			it('should get gemini-3-pro-image-preview model', () => {
				const model = getModel('google', 'gemini-3-pro-image-preview');
				expect(model).toBeDefined();
				expect(model?.id).toBe('gemini-3-pro-image-preview');
			});

			it('should return undefined for unknown google model', () => {
				const model = getModel('google', 'gemini-99' as any);
				expect(model).toBeUndefined();
			});
		});

		describe('model properties', () => {
			it('should have all required properties', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(model).toBeDefined();
				expect(model!).toHaveProperty('id');
				expect(model!).toHaveProperty('name');
				expect(model!).toHaveProperty('api');
				expect(model!).toHaveProperty('baseUrl');
				expect(model!).toHaveProperty('reasoning');
				expect(model!).toHaveProperty('input');
				expect(model!).toHaveProperty('cost');
				expect(model!).toHaveProperty('contextWindow');
				expect(model!).toHaveProperty('maxTokens');
				expect(model!).toHaveProperty('tools');
			});

			it('should have correct cost structure', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(model?.cost).toBeDefined();
				expect(model?.cost).toHaveProperty('input');
				expect(model?.cost).toHaveProperty('output');
				expect(model?.cost).toHaveProperty('cacheRead');
				expect(model?.cost).toHaveProperty('cacheWrite');
			});

			it('should have numeric cost values', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(typeof model?.cost.input).toBe('number');
				expect(typeof model?.cost.output).toBe('number');
				expect(typeof model?.cost.cacheRead).toBe('number');
				expect(typeof model?.cost.cacheWrite).toBe('number');
			});

			it('should have correct baseUrl for openai', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(model?.baseUrl).toBe('https://api.openai.com/v1');
			});

			it('should have correct baseUrl for google', () => {
				const model = getModel('google', 'gemini-3-pro-preview');
				expect(model?.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
			});

			it('should have input types array', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(Array.isArray(model?.input)).toBe(true);
				expect(model?.input).toContain('text');
			});

			it('should have tools array', () => {
				const model = getModel('openai', 'gpt-5.2');
				expect(Array.isArray(model?.tools)).toBe(true);
			});
		});

		describe('reasoning capability', () => {
			it('should mark all OpenAI models as reasoning models', () => {
				const model1 = getModel('openai', 'gpt-5.2');
				const model2 = getModel('openai', 'gpt-5-mini');
				expect(model1?.reasoning).toBe(true);
				expect(model2?.reasoning).toBe(true);
			});

			it('should mark all Google models as reasoning models', () => {
				const model1 = getModel('google', 'gemini-3-pro-preview');
				const model2 = getModel('google', 'gemini-3-flash-preview');
				expect(model1?.reasoning).toBe(true);
				expect(model2?.reasoning).toBe(true);
			});
		});
	});

	describe('getModels', () => {
		it('should return all openai models', () => {
			const models = getModels('openai');
			expect(Array.isArray(models)).toBe(true);
			expect(models.length).toBe(6);
			expect(models.every(m => m.api === 'openai')).toBe(true);
		});

		it('should return all google models', () => {
			const models = getModels('google');
			expect(Array.isArray(models)).toBe(true);
			expect(models.length).toBe(3);
			expect(models.every(m => m.api === 'google')).toBe(true);
		});

		it('should return empty array for unknown api', () => {
			const models = getModels('unknown' as any);
			expect(models).toEqual([]);
		});

		it('should return models with all required properties', () => {
			const models = getModels('openai');
			models.forEach(model => {
				expect(model).toHaveProperty('id');
				expect(model).toHaveProperty('name');
				expect(model).toHaveProperty('api');
				expect(model).toHaveProperty('cost');
			});
		});

		it('should include specific openai model IDs', () => {
			const models = getModels('openai');
			const ids = models.map(m => m.id);
			expect(ids).toContain('gpt-5.2');
			expect(ids).toContain('gpt-5.2-pro');
			expect(ids).toContain('gpt-5-mini');
			expect(ids).toContain('gpt-5-nano');
		});

		it('should include specific google model IDs', () => {
			const models = getModels('google');
			const ids = models.map(m => m.id);
			expect(ids).toContain('gemini-3-pro-preview');
			expect(ids).toContain('gemini-3-flash-preview');
			expect(ids).toContain('gemini-3-pro-image-preview');
		});
	});

	describe('calculateCost', () => {
		let model: Model<'openai'>;
		let usage: Usage;

		beforeEach(() => {
			model = {
				id: 'test-model',
				name: 'Test Model',
				api: 'openai',
				baseUrl: 'https://test.com',
				reasoning: true,
				input: ['text'],
				cost: {
					input: 5,      // $5 per million tokens
					output: 15,    // $15 per million tokens
					cacheRead: 0.5, // $0.50 per million tokens
					cacheWrite: 1,  // $1 per million tokens
				},
				contextWindow: 128000,
				maxTokens: 4096,
				tools: [],
			};

			usage = {
				input: 1000,
				output: 500,
				cacheRead: 100,
				cacheWrite: 50,
				totalTokens: 1650,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			};
		});

		it('should calculate input cost correctly', () => {
			const result = calculateCost(model, usage);
			// 1000 tokens * $5 / 1,000,000 = $0.005
			expect(result.input).toBeCloseTo(0.005, 10);
		});

		it('should calculate output cost correctly', () => {
			const result = calculateCost(model, usage);
			// 500 tokens * $15 / 1,000,000 = $0.0075
			expect(result.output).toBeCloseTo(0.0075, 10);
		});

		it('should calculate cache read cost correctly', () => {
			const result = calculateCost(model, usage);
			// 100 tokens * $0.50 / 1,000,000 = $0.00005
			expect(result.cacheRead).toBeCloseTo(0.00005, 10);
		});

		it('should calculate cache write cost correctly', () => {
			const result = calculateCost(model, usage);
			// 50 tokens * $1 / 1,000,000 = $0.00005
			expect(result.cacheWrite).toBeCloseTo(0.00005, 10);
		});

		it('should calculate total cost correctly', () => {
			const result = calculateCost(model, usage);
			const expected = 0.005 + 0.0075 + 0.00005 + 0.00005;
			expect(result.total).toBeCloseTo(expected, 10);
		});

		it('should mutate the usage object cost property', () => {
			calculateCost(model, usage);
			expect(usage.cost.input).toBeGreaterThan(0);
			expect(usage.cost.total).toBeGreaterThan(0);
		});

		it('should handle zero tokens', () => {
			usage.input = 0;
			usage.output = 0;
			usage.cacheRead = 0;
			usage.cacheWrite = 0;

			const result = calculateCost(model, usage);
			expect(result.input).toBe(0);
			expect(result.output).toBe(0);
			expect(result.cacheRead).toBe(0);
			expect(result.cacheWrite).toBe(0);
			expect(result.total).toBe(0);
		});

		it('should handle large token counts', () => {
			usage.input = 1000000; // 1 million tokens
			usage.output = 500000; // 500k tokens

			const result = calculateCost(model, usage);
			// 1M tokens * $5 / 1M = $5
			expect(result.input).toBeCloseTo(5, 10);
			// 500k tokens * $15 / 1M = $7.5
			expect(result.output).toBeCloseTo(7.5, 10);
		});

		it('should work with actual model from registry', () => {
			const gpt5 = getModel('openai', 'gpt-5.2');
			expect(gpt5).toBeDefined();

			const testUsage: Usage = {
				input: 10000,
				output: 5000,
				cacheRead: 1000,
				cacheWrite: 0,
				totalTokens: 16000,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			};

			const result = calculateCost(gpt5!, testUsage);
			expect(result.total).toBeGreaterThan(0);
			expect(result.input).toBeGreaterThan(0);
			expect(result.output).toBeGreaterThan(0);
		});

		it('should handle fractional tokens', () => {
			usage.input = 1500;
			usage.output = 750;

			const result = calculateCost(model, usage);
			expect(result.input).toBeCloseTo(0.0075, 10);
			expect(result.output).toBeCloseTo(0.01125, 10);
		});
	});

	describe('getAvailableModels', () => {
		// Store original env vars
		const originalEnv = { ...process.env };

		afterEach(() => {
			// Restore original env vars
			process.env = { ...originalEnv };
		});

		it('should return empty array when no API keys set', () => {
			delete process.env.OPENAI_API_KEY;
			delete process.env.GEMINI_API_KEY;
			delete process.env.DEEPSEEK_API_KEY;

			const models = getAvailableModels();
			expect(models).toEqual([]);
		});

		it('should return only openai models when only OPENAI_API_KEY is set', () => {
			process.env.OPENAI_API_KEY = 'test-key';
			delete process.env.GEMINI_API_KEY;
			delete process.env.DEEPSEEK_API_KEY;

			const models = getAvailableModels();
			expect(models.length).toBeGreaterThan(0);
			expect(models.every(m => m.api === 'openai')).toBe(true);
			expect(models.some(m => m.api === 'google')).toBe(false);
		});

		it('should return only google models when only GEMINI_API_KEY is set', () => {
			delete process.env.OPENAI_API_KEY;
			delete process.env.DEEPSEEK_API_KEY;
			process.env.GEMINI_API_KEY = 'test-key';

			const models = getAvailableModels();
			expect(models.length).toBeGreaterThan(0);
			expect(models.every(m => m.api === 'google')).toBe(true);
			expect(models.some(m => m.api === 'openai')).toBe(false);
		});

		it('should return both openai and google models when both keys are set', () => {
			process.env.OPENAI_API_KEY = 'openai-key';
			process.env.GEMINI_API_KEY = 'gemini-key';

			const models = getAvailableModels();
			expect(models.length).toBeGreaterThan(0);
			expect(models.some(m => m.api === 'openai')).toBe(true);
			expect(models.some(m => m.api === 'google')).toBe(true);
		});

		it('should return 6 openai models when OPENAI_API_KEY is set', () => {
			process.env.OPENAI_API_KEY = 'test-key';
			delete process.env.GEMINI_API_KEY;

			const models = getAvailableModels();
			const openaiModels = models.filter(m => m.api === 'openai');
			expect(openaiModels.length).toBe(6);
		});

		it('should return 3 google models when GEMINI_API_KEY is set', () => {
			delete process.env.OPENAI_API_KEY;
			process.env.GEMINI_API_KEY = 'test-key';

			const models = getAvailableModels();
			const googleModels = models.filter(m => m.api === 'google');
			expect(googleModels.length).toBe(3);
		});

		it('should return 9 total models when both keys are set', () => {
			process.env.OPENAI_API_KEY = 'openai-key';
			process.env.GEMINI_API_KEY = 'gemini-key';

			const models = getAvailableModels();
			expect(models.length).toBe(10); // 6 OpenAI + 3 Google
		});

		it('should return models with valid properties', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const models = getAvailableModels();
			models.forEach(model => {
				expect(model).toHaveProperty('id');
				expect(model).toHaveProperty('api');
				expect(model).toHaveProperty('cost');
			});
		});
	});
});
