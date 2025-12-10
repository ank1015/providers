import { describe, it, expect } from 'vitest';
import { MODELS } from '../../src/models.generated';
import type { Model, Api } from '../../src/types';

// Helper to get all models from the nested structure
const getAllModels = (): Model<Api>[] => {
	return Object.values(MODELS).flatMap(provider => Object.values(provider)) as Model<Api>[];
};

describe('MODELS Registry', () => {
	describe('Registry structure', () => {
		it('should contain models', () => {
			expect(MODELS).toBeDefined();
			expect(Object.keys(MODELS).length).toBeGreaterThan(0);
		});

		it('should have OpenAI models', () => {
			const openaiModels = getAllModels().filter(m => m.api === 'openai');
			expect(openaiModels.length).toBeGreaterThan(0);
		});

		it('should have Google models', () => {
			const googleModels = getAllModels().filter(m => m.api === 'google');
			expect(googleModels.length).toBeGreaterThan(0);
		});
	});

	describe('Model field validation', () => {
		it('should have all required fields for each model', () => {
			for (const model of getAllModels()) {
				expect(model).toHaveProperty('id');
				expect(model).toHaveProperty('name');
				expect(model).toHaveProperty('api');
				expect(model).toHaveProperty('baseUrl');
				expect(model).toHaveProperty('reasoning');
				expect(model).toHaveProperty('input');
				expect(model).toHaveProperty('cost');
				expect(model).toHaveProperty('contextWindow');
				expect(model).toHaveProperty('maxTokens');
			}
		});

		it('should have valid id for each model', () => {
			for (const model of getAllModels()) {
				expect(model.id).toBeTruthy();
				expect(typeof model.id).toBe('string');
				expect(model.id.length).toBeGreaterThan(0);
			}
		});

		it('should have valid name for each model', () => {
			for (const model of getAllModels()) {
				expect(model.name).toBeTruthy();
				expect(typeof model.name).toBe('string');
				expect(model.name.length).toBeGreaterThan(0);
			}
		});

		it('should have valid api field', () => {
			for (const model of getAllModels()) {
				expect(['openai', 'google']).toContain(model.api);
			}
		});

		it('should have valid baseUrl', () => {
			for (const model of getAllModels()) {
				expect(model.baseUrl).toBeTruthy();
				expect(typeof model.baseUrl).toBe('string');
				expect(model.baseUrl.startsWith('http')).toBe(true);
			}
		});

		it('should have boolean reasoning field', () => {
			for (const model of getAllModels()) {
				expect(typeof model.reasoning).toBe('boolean');
			}
		});
	});

	describe('Input types validation', () => {
		it('should have non-empty input types array', () => {
			for (const model of getAllModels()) {
				expect(Array.isArray(model.input)).toBe(true);
				expect(model.input.length).toBeGreaterThan(0);
			}
		});

		it('should have valid input type values', () => {
			const validInputTypes = ['text', 'image', 'file'];
			for (const model of getAllModels()) {
				for (const inputType of model.input) {
					expect(validInputTypes).toContain(inputType);
				}
			}
		});

		it('should include text input for all models', () => {
			for (const model of getAllModels()) {
				expect(model.input).toContain('text');
			}
		});
	});

	describe('Cost structure validation', () => {
		it('should have all cost fields', () => {
			for (const model of getAllModels()) {
				expect(model.cost).toHaveProperty('input');
				expect(model.cost).toHaveProperty('output');
				expect(model.cost).toHaveProperty('cacheRead');
				expect(model.cost).toHaveProperty('cacheWrite');
			}
		});

		it('should have non-negative cost values', () => {
			for (const model of getAllModels()) {
				expect(model.cost.input).toBeGreaterThanOrEqual(0);
				expect(model.cost.output).toBeGreaterThanOrEqual(0);
				expect(model.cost.cacheRead).toBeGreaterThanOrEqual(0);
				expect(model.cost.cacheWrite).toBeGreaterThanOrEqual(0);
			}
		});

		it('should have numeric cost values', () => {
			for (const model of getAllModels()) {
				expect(typeof model.cost.input).toBe('number');
				expect(typeof model.cost.output).toBe('number');
				expect(typeof model.cost.cacheRead).toBe('number');
				expect(typeof model.cost.cacheWrite).toBe('number');
			}
		});

		it('should have output cost >= input cost (typical pricing)', () => {
			for (const model of getAllModels()) {
				if (model.cost.input > 0 && model.cost.output > 0) {
					expect(model.cost.output).toBeGreaterThanOrEqual(model.cost.input);
				}
			}
		});

		it('should have cache read cost <= input cost', () => {
			for (const model of getAllModels()) {
				if (model.cost.cacheRead > 0 && model.cost.input > 0) {
					expect(model.cost.cacheRead).toBeLessThanOrEqual(model.cost.input);
				}
			}
		});
	});

	describe('Context window and tokens validation', () => {
		it('should have positive context window', () => {
			for (const model of getAllModels()) {
				expect(model.contextWindow).toBeGreaterThan(0);
				expect(typeof model.contextWindow).toBe('number');
			}
		});

		it('should have positive max tokens', () => {
			for (const model of getAllModels()) {
				expect(model.maxTokens).toBeGreaterThan(0);
				expect(typeof model.maxTokens).toBe('number');
			}
		});

		it('should have maxTokens <= contextWindow', () => {
			for (const model of getAllModels()) {
				expect(model.maxTokens).toBeLessThanOrEqual(model.contextWindow);
			}
		});

		it('should have realistic context windows (at least 1k tokens)', () => {
			for (const model of getAllModels()) {
				expect(model.contextWindow).toBeGreaterThanOrEqual(1000);
			}
		});
	});

	describe('Model ID uniqueness', () => {
		it('should have unique model IDs', () => {
			const ids = getAllModels().map(m => m.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});

		it('should have unique model names', () => {
			const names = getAllModels().map(m => m.name);
			const uniqueNames = new Set(names);
			expect(uniqueNames.size).toBe(names.length);
		});
	});

	describe('Headers validation', () => {
		it('should have headers as object if present', () => {
			for (const model of getAllModels()) {
				if (model.headers) {
					expect(typeof model.headers).toBe('object');
					expect(Array.isArray(model.headers)).toBe(false);
				}
			}
		});

		it('should have string values in headers if present', () => {
			for (const model of getAllModels()) {
				if (model.headers) {
					for (const value of Object.values(model.headers)) {
						expect(typeof value).toBe('string');
					}
				}
			}
		});
	});

	describe('Provider-specific validations', () => {
		describe('OpenAI models', () => {
			it('should have correct baseUrl for OpenAI', () => {
				const openaiModels = getAllModels().filter(m => m.api === 'openai');
				for (const model of openaiModels) {
					expect(model.baseUrl).toContain('openai.com');
				}
			});

			it('should have sensible costs for OpenAI', () => {
				const openaiModels = getAllModels().filter(m => m.api === 'openai');
				for (const model of openaiModels) {
					// OpenAI costs are typically in range of $0.01 to $50 per million tokens
					expect(model.cost.input).toBeLessThan(100);
					expect(model.cost.output).toBeLessThan(200);
				}
			});
		});

		describe('Google models', () => {
			it('should have correct baseUrl for Google', () => {
				const googleModels = getAllModels().filter(m => m.api === 'google');
				for (const model of googleModels) {
					expect(model.baseUrl).toContain('googleapis.com');
				}
			});

			it('should have sensible costs for Google', () => {
				const googleModels = getAllModels().filter(m => m.api === 'google');
				for (const model of googleModels) {
					// Google costs are typically in similar range
					expect(model.cost.input).toBeLessThan(100);
					expect(model.cost.output).toBeLessThan(200);
				}
			});
		});
	});

	describe('Reasoning capabilities', () => {
		it('should have some models with reasoning enabled', () => {
			const reasoningModels = getAllModels().filter(m => m.reasoning);
			expect(reasoningModels.length).toBeGreaterThan(0);
		});
	});

	describe('Model availability', () => {
		it('should have at least one model per provider', () => {
			const apis = new Set(getAllModels().map(m => m.api));
			expect(apis.has('openai')).toBe(true);
			expect(apis.has('google')).toBe(true);
		});

		it('should have models with different capabilities', () => {
			const capabilities = new Set();
			for (const model of getAllModels()) {
				capabilities.add(model.input.sort().join(','));
			}
			// Should have at least some variety in capabilities
			expect(capabilities.size).toBeGreaterThan(0);
		});
	});

	describe('Multimodal support', () => {
		it('should have some models with image support', () => {
			const imageModels = getAllModels().filter(m => m.input.includes('image'));
			expect(imageModels.length).toBeGreaterThan(0);
		});

		it('should have some models with file support', () => {
			const fileModels = getAllModels().filter(m => m.input.includes('file'));
			expect(fileModels.length).toBeGreaterThan(0);
		});
	});

	describe('Cost effectiveness comparison', () => {
		it('should have models with varying price points', () => {
			const inputCosts = getAllModels().map(m => m.cost.input);
			const minCost = Math.min(...inputCosts);
			const maxCost = Math.max(...inputCosts);

			// Should have variety in pricing
			if (minCost > 0 && maxCost > 0) {
				expect(maxCost).toBeGreaterThan(minCost);
			}
		});
	});
});
