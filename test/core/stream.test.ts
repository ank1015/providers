import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stream } from '../../src/stream';
import { Model, Context } from '../../src/types';
import * as openaiProvider from '../../src/providers/openai';
import * as googleProvider from '../../src/providers/google';
import { ThinkingLevel } from '@google/genai';

// Mock the provider modules
vi.mock('../src/providers/openai');
vi.mock('../src/providers/google');

const mockOpenAIModel: Model<'openai'> = {
	id: 'test-openai',
	name: 'Test OpenAI',
	api: 'openai',
	baseUrl: 'https://api.openai.com',
	reasoning: false,
	input: ['text'],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 4096,
};

const mockGoogleModel: Model<'google'> = {
	id: 'test-google',
	name: 'Test Google',
	api: 'google',
	baseUrl: 'https://generativelanguage.googleapis.com',
	reasoning: false,
	input: ['text'],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 8192,
};

describe('stream', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Save original env
		originalEnv = { ...process.env };
		// Clear mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore original env
		process.env = originalEnv;
	});

	describe('Provider routing', () => {
		it('should route to OpenAI provider for openai api', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = {
				messages: [],
			};

			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			const result = stream(mockOpenAIModel, context);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				mockOpenAIModel,
				context,
				expect.objectContaining({ apiKey: 'test-key' })
			);
			expect(result).toBe(mockStream);
		});

		it('should route to Google provider for google api', () => {
			process.env.GEMINI_API_KEY = 'test-gemini-key';

			const context: Context = {
				messages: [],
			};

			const mockStream = {} as any;
			vi.spyOn(googleProvider, 'streamGoogle').mockReturnValue(mockStream);

			const result = stream(mockGoogleModel, context);

			expect(googleProvider.streamGoogle).toHaveBeenCalledWith(
				mockGoogleModel,
				context,
				expect.objectContaining({ apiKey: 'test-gemini-key' })
			);
			expect(result).toBe(mockStream);
		});
	});

	describe('API key handling', () => {
		it('should use API key from OPENAI_API_KEY environment variable', () => {
			process.env.OPENAI_API_KEY = 'env-openai-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			stream(mockOpenAIModel, context);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.objectContaining({ apiKey: 'env-openai-key' })
			);
		});

		it('should use API key from GEMINI_API_KEY environment variable', () => {
			process.env.GEMINI_API_KEY = 'env-gemini-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(googleProvider, 'streamGoogle').mockReturnValue(mockStream);

			stream(mockGoogleModel, context);

			expect(googleProvider.streamGoogle).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.objectContaining({ apiKey: 'env-gemini-key' })
			);
		});

		it('should use API key from options (overrides env)', () => {
			process.env.OPENAI_API_KEY = 'env-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			stream(mockOpenAIModel, context, { apiKey: 'options-key' });

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.objectContaining({ apiKey: 'options-key' })
			);
		});

		it('should throw error when API key is missing for OpenAI', () => {
			delete process.env.OPENAI_API_KEY;

			const context: Context = { messages: [] };

			expect(() => stream(mockOpenAIModel, context)).toThrow(
				/No API key for provider: openai/
			);
		});

		it('should throw error when API key is missing for Google', () => {
			delete process.env.GEMINI_API_KEY;

			const context: Context = { messages: [] };

			expect(() => stream(mockGoogleModel, context)).toThrow(
				/No API key for provider: google/
			);
		});
	});

	describe('Options pass-through', () => {
		it('should pass OpenAI options to provider', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			const options = {
				apiKey: 'custom-key',
				temperature: 0.7,
				maxOutputTokens: 2000,
				reasoning: {
					effort: 'medium' as const,
					summaryStyle: 'concise' as const,
				},
			};

			stream(mockOpenAIModel, context, options);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				mockOpenAIModel,
				context,
				expect.objectContaining({
					apiKey: 'custom-key',
					temperature: 0.7,
					maxOutputTokens: 2000,
					reasoning: {
						effort: 'medium',
						summaryStyle: 'concise',
					},
				})
			);
		});

		it('should pass Google options to provider', () => {
			process.env.GEMINI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(googleProvider, 'streamGoogle').mockReturnValue(mockStream);

			const options = {
				apiKey: 'custom-key',
				temperature: 0.8,
				maxOutputTokens: 4000,
				thinkingConfig: {
					thinkingLevel: ThinkingLevel.HIGH,
				},
			};

			stream(mockGoogleModel, context, options);

			expect(googleProvider.streamGoogle).toHaveBeenCalledWith(
				mockGoogleModel,
				context,
				expect.objectContaining({
					apiKey: 'custom-key',
					temperature: 0.8,
					maxOutputTokens: 4000,
					thinkingConfig: {
						thinkingLevel: "HIGH"
					},
				})
			);
		});

		it('should pass undefined options when none provided', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			stream(mockOpenAIModel, context);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				mockOpenAIModel,
				context,
				expect.objectContaining({ apiKey: 'test-key' })
			);
		});
	});

	describe('Context pass-through', () => {
		it('should pass context with messages to provider', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = {
				systemPrompt: 'You are helpful',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Hello' }],
						timestamp: Date.now(),
					},
				],
			};

			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			stream(mockOpenAIModel, context);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				expect.anything(),
				context,
				expect.anything()
			);
		});

		it('should pass context with tools to provider', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = {
				messages: [],
				tools: [
					{
						name: 'test_tool',
						description: 'A test tool',
						parameters: {} as any,
					},
				],
			};

			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			stream(mockOpenAIModel, context);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					tools: expect.arrayContaining([
						expect.objectContaining({ name: 'test_tool' }),
					]),
				}),
				expect.anything()
			);
		});
	});

	describe('Model pass-through', () => {
		it('should pass model to OpenAI provider', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			stream(mockOpenAIModel, context);

			expect(openaiProvider.streamOpenAI).toHaveBeenCalledWith(
				mockOpenAIModel,
				expect.anything(),
				expect.anything()
			);
		});

		it('should pass model to Google provider', () => {
			process.env.GEMINI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(googleProvider, 'streamGoogle').mockReturnValue(mockStream);

			stream(mockGoogleModel, context);

			expect(googleProvider.streamGoogle).toHaveBeenCalledWith(
				mockGoogleModel,
				expect.anything(),
				expect.anything()
			);
		});
	});

	describe('Return value', () => {
		it('should return AssistantMessageEventStream from OpenAI provider', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = { [Symbol.asyncIterator]: () => ({}) } as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			const result = stream(mockOpenAIModel, context);

			expect(result).toBe(mockStream);
			expect(result[Symbol.asyncIterator]).toBeDefined();
		});

		it('should return AssistantMessageEventStream from Google provider', () => {
			process.env.GEMINI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = { [Symbol.asyncIterator]: () => ({}) } as any;
			vi.spyOn(googleProvider, 'streamGoogle').mockReturnValue(mockStream);

			const result = stream(mockGoogleModel, context);

			expect(result).toBe(mockStream);
			expect(result[Symbol.asyncIterator]).toBeDefined();
		});
	});

	describe('Edge cases', () => {
		it('should handle empty context', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = { messages: [] };
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			expect(() => stream(mockOpenAIModel, context)).not.toThrow();
		});

		it('should handle context with only system prompt', () => {
			process.env.OPENAI_API_KEY = 'test-key';

			const context: Context = {
				systemPrompt: 'System instructions',
				messages: [],
			};
			const mockStream = {} as any;
			vi.spyOn(openaiProvider, 'streamOpenAI').mockReturnValue(mockStream);

			expect(() => stream(mockOpenAIModel, context)).not.toThrow();
		});

		it('should handle empty string API key from environment', () => {
			process.env.OPENAI_API_KEY = '';

			const context: Context = { messages: [] };

			expect(() => stream(mockOpenAIModel, context)).toThrow(
				/No API key for provider/
			);
		});

		it('should handle empty string API key from options', () => {
			const context: Context = { messages: [] };

			expect(() => stream(mockOpenAIModel, context, { apiKey: '' })).toThrow(
				/No API key for provider/
			);
		});
	});
});
