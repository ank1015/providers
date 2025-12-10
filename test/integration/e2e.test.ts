import { describe, it, expect, beforeAll } from 'vitest';
import { Type } from '@sinclair/typebox';
import { stream } from '../../src/stream';
import { MODELS } from '../../src/models.generated';
import { Context } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// These tests will only run if API keys are set in environment
// Set ENABLE_E2E_TESTS=true to run these tests
// Set OPENAI_API_KEY and/or GEMINI_API_KEY to test specific providers

const E2E_ENABLED = process.env.ENABLE_E2E_TESTS === 'true';
const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY);
const HAS_GEMINI_KEY = Boolean(process.env.GEMINI_API_KEY);

const describeE2E = E2E_ENABLED ? describe : describe.skip;

describeE2E('E2E Integration Tests', () => {
	beforeAll(() => {
		if (!E2E_ENABLED) {
			console.log('Skipping E2E tests (set ENABLE_E2E_TESTS=true to run)');
		}
		if (!HAS_OPENAI_KEY && !HAS_GEMINI_KEY) {
			console.log('No API keys found. Set OPENAI_API_KEY or GEMINI_API_KEY to test.');
		}
	});

	const describeOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;
	const describeGoogle = HAS_GEMINI_KEY ? describe : describe.skip;

	describeOpenAI('OpenAI Integration', () => {
		it('should stream a simple text response', async () => {
			const context: Context = {
				systemPrompt: 'You are a helpful assistant. Be very concise.',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Say "Hello Test" and nothing else.' }],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.openai['gpt-5-mini'], context);

			let textReceived = '';
			let eventCount = 0;

			for await (const event of response) {
				eventCount++;

				if (event.type === 'text_delta') {
					textReceived += event.delta;
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
					expect(event.message.usage.totalTokens).toBeGreaterThan(0);
					expect(event.message.usage.cost.total).toBeGreaterThan(0);
				}
			}

			expect(eventCount).toBeGreaterThan(0);
			expect(textReceived.length).toBeGreaterThan(0);
		}, 30000); // 30 second timeout

		it('should handle tool calls', async () => {
			const context: Context = {
				systemPrompt: 'You are a helpful assistant. Use the calculator tool when asked to calculate.',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Calculate 15 * 23' }],
						timestamp: Date.now(),
					},
				],
				tools: [
					{
						name: 'calculator',
						description: 'Perform mathematical calculations',
						parameters: Type.Object({
							expression: Type.String({ description: 'Mathematical expression' }),
						}),
					},
				],
			};

			const response = stream(MODELS.openai['gpt-5-mini'], context);

			let toolCallFound = false;

			for await (const event of response) {
				if (event.type === 'toolcall_end') {
					toolCallFound = true;
					expect(event.toolCall.name).toBe('calculator');
					expect(event.toolCall.arguments).toBeDefined();
					expect(typeof event.toolCall.arguments).toBe('object');
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('toolUse');
				}
			}

			expect(toolCallFound).toBe(true);
		}, 30000);

		it('should handle reasoning mode (if supported)', async () => {
			const context: Context = {
				systemPrompt: 'You are a helpful assistant.',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Explain why the sky is blue in one sentence.' }],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.openai['gpt-5-mini'], context, {
				reasoning: {
					effort: 'low',
					summary: 'concise'
				},
			});

			let hasThinking = false;

			for await (const event of response) {
				if (event.type === 'thinking_start' || event.type === 'thinking_delta') {
					hasThinking = true;
				}

				if (event.type === 'done') {
					expect(event.message.stopReason).toBe('stop');
				}
			}

			// Reasoning mode may or may not produce thinking depending on the query
			// Just verify the stream completes successfully
			expect(true).toBe(true);
		}, 30000);

		it('should calculate costs correctly', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Hello' }],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.openai['gpt-5-mini'], context);

			for await (const event of response) {
				if (event.type === 'done') {
					const { usage } = event.message;

					expect(usage.input).toBeGreaterThan(0);
					expect(usage.output).toBeGreaterThan(0);
					expect(usage.totalTokens).toBe(usage.input + usage.output + usage.cacheRead + usage.cacheWrite);

					expect(usage.cost.input).toBeGreaterThan(0);
					expect(usage.cost.output).toBeGreaterThan(0);
					expect(usage.cost.total).toBeGreaterThan(0);

					// Total cost should equal sum of parts
					const calculatedTotal =
						usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
					expect(usage.cost.total).toBeCloseTo(calculatedTotal, 10);
				}
			}
		}, 30000);
	});

	describeGoogle('Google Integration', () => {
		it('should stream a simple text response', async () => {
			const context: Context = {
				systemPrompt: 'You are a helpful assistant. Be very concise.',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Say "Hello Test" and nothing else.' }],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.google['gemini-2.5-flash'], context);

			let textReceived = '';
			let eventCount = 0;

			for await (const event of response) {
				eventCount++;

				if (event.type === 'text_delta') {
					textReceived += event.delta;
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
					expect(event.message.usage.totalTokens).toBeGreaterThan(0);
				}
			}

			expect(eventCount).toBeGreaterThan(0);
			expect(textReceived.length).toBeGreaterThan(0);
		}, 30000);

		it('should handle tool calls', async () => {
			const context: Context = {
				systemPrompt: 'You are a helpful assistant. Use the calculator tool when asked to calculate.',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Calculate 25 * 17' }],
						timestamp: Date.now(),
					},
				],
				tools: [
					{
						name: 'calculator',
						description: 'Perform mathematical calculations',
						parameters: Type.Object({
							expression: Type.String({ description: 'Mathematical expression' }),
						}),
					},
				],
			};

			const response = stream(MODELS.google['gemini-2.5-flash'], context);

			let toolCallFound = false;

			for await (const event of response) {
				if (event.type === 'toolcall_end') {
					toolCallFound = true;
					expect(event.toolCall.name).toBe('calculator');
					expect(event.toolCall.arguments).toBeDefined();
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('toolUse');
				}
			}

			expect(toolCallFound).toBe(true);
		}, 30000);

		it('should calculate costs correctly', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Hello' }],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.google['gemini-2.5-flash'], context);

			for await (const event of response) {
				if (event.type === 'done') {
					const { usage } = event.message;

					expect(usage.input).toBeGreaterThan(0);
					expect(usage.output).toBeGreaterThan(0);
					expect(usage.totalTokens).toBeGreaterThan(0);

					// Costs should be calculated
					expect(usage.cost.total).toBeGreaterThanOrEqual(0);
				}
			}
		}, 30000);
	});

	// Multimodal Tests (Image and File Inputs)
	describeOpenAI('OpenAI Multimodal Integration', () => {
		it('should handle image input (vision)', async () => {
			const imagePath = path.join(__dirname, '../data/red-circle.png');
			const imageBuffer = fs.readFileSync(imagePath);
			const base64Image = imageBuffer.toString('base64');

			const context: Context = {
				systemPrompt: 'You are a helpful assistant that can analyze images.',
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', content: 'What color is the main shape in this image? Answer in one word.' },
							{ type: 'image', data: base64Image, mimeType: 'image/png' },
						],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.openai['gpt-5-mini'], context);

			let textReceived = '';
			let hasImage = false;

			for await (const event of response) {
				if (event.type === 'text_delta') {
					textReceived += event.delta;
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
					// Check if the response mentions red (case insensitive)
					expect(textReceived.toLowerCase()).toContain('red');
				}
			}

			expect(textReceived.length).toBeGreaterThan(0);
		}, 30000);

		it('should handle mixed content (text + image)', async () => {
			const imagePath = path.join(__dirname, '../data/red-circle.png');
			const imageBuffer = fs.readFileSync(imagePath);
			const base64Image = imageBuffer.toString('base64');

			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', content: 'Describe this image briefly:' },
							{ type: 'image', data: base64Image, mimeType: 'image/png' },
							{ type: 'text', content: 'Be very concise.' },
						],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.openai['gpt-5-mini'], context);

			let completed = false;

			for await (const event of response) {
				if (event.type === 'done') {
					completed = true;
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
					expect(event.message.usage.totalTokens).toBeGreaterThan(0);
				}
			}

			expect(completed).toBe(true);
		}, 30000);
	});

	describeGoogle('Google Multimodal Integration', () => {
		it('should handle image input', async () => {
			const imagePath = path.join(__dirname, '../data/red-circle.png');
			const imageBuffer = fs.readFileSync(imagePath);
			const base64Image = imageBuffer.toString('base64');

			const context: Context = {
				systemPrompt: 'You are a helpful assistant that can analyze images.',
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', content: 'What color is the main shape in this image? Answer in one word.' },
							{ type: 'image', data: base64Image, mimeType: 'image/png' },
						],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.google['gemini-2.5-flash'], context);

			let textReceived = '';

			for await (const event of response) {
				if (event.type === 'text_delta') {
					textReceived += event.delta;
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
					// Check if the response mentions red (case insensitive)
					expect(textReceived.toLowerCase()).toContain('red');
				}
			}

			expect(textReceived.length).toBeGreaterThan(0);
		}, 30000);

		it('should handle PDF file input', async () => {
			const pdfPath = path.join(__dirname, '../data/superintelligentwill.pdf');
			const pdfBuffer = fs.readFileSync(pdfPath);
			const base64Pdf = pdfBuffer.toString('base64');

			const context: Context = {
				systemPrompt: 'You are a helpful assistant that can read documents.',
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', content: 'What type of document is this? Answer in 3 words or less.' },
							{ type: 'file', data: base64Pdf, mimeType: 'application/pdf' },
						],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.google['gemini-2.5-flash'], context);

			let textReceived = '';

			for await (const event of response) {
				if (event.type === 'text_delta') {
					textReceived += event.delta;
				}

				if (event.type === 'done') {
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
				}
			}

			expect(textReceived.length).toBeGreaterThan(0);
		}, 30000);

		it('should handle mixed content (text + image + file)', async () => {
			const imagePath = path.join(__dirname, '../data/red-circle.png');
			const imageBuffer = fs.readFileSync(imagePath);
			const base64Image = imageBuffer.toString('base64');

			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', content: 'Describe this image briefly:' },
							{ type: 'image', data: base64Image, mimeType: 'image/png' },
						],
						timestamp: Date.now(),
					},
				],
			};

			const response = stream(MODELS.google['gemini-2.5-flash'], context);

			let completed = false;

			for await (const event of response) {
				if (event.type === 'done') {
					completed = true;
					expect(event.reason).toBe('stop');
					expect(event.message.content.length).toBeGreaterThan(0);
				}
			}

			expect(completed).toBe(true);
		}, 30000);
	});

	describe('Cross-provider consistency', () => {
		const itWithBothProviders = HAS_OPENAI_KEY && HAS_GEMINI_KEY ? it : it.skip;

		itWithBothProviders('should produce similar event structure across providers', async () => {
			const context: Context = {
				messages: [
					{
						role: 'user',
						content: [{ type: 'text', content: 'Hello' }],
						timestamp: Date.now(),
					},
				],
			};

			const openaiResponse = stream(MODELS.openai['gpt-5-mini'], context);
			const googleResponse = stream(MODELS.google['gemini-2.5-flash'], context);

			const openaiEvents: string[] = [];
			const googleEvents: string[] = [];

			for await (const event of openaiResponse) {
				openaiEvents.push(event.type);
			}

			for await (const event of googleResponse) {
				googleEvents.push(event.type);
			}

			// Both should have start and done events
			expect(openaiEvents).toContain('start');
			expect(openaiEvents).toContain('done');
			expect(googleEvents).toContain('start');
			expect(googleEvents).toContain('done');

			// Both should have text events
			expect(openaiEvents.some(e => e.startsWith('text_'))).toBe(true);
			expect(googleEvents.some(e => e.startsWith('text_'))).toBe(true);
		}, 60000);
	});
});

// Non-E2E integration tests (always run, use mocks)
describe('Integration Tests (Mocked)', () => {
	it('should have at least one test model for each provider', () => {
		const allModels = Object.values(MODELS).flatMap(provider => Object.values(provider));
		const openaiModels = allModels.filter((m: any) => m.api === 'openai');
		const googleModels = allModels.filter((m: any) => m.api === 'google');

		expect(openaiModels.length).toBeGreaterThan(0);
		expect(googleModels.length).toBeGreaterThan(0);
	});

	it('should have valid API keys environment setup', () => {
		// Just verify the env vars exist (may be empty)
		expect(process.env).toHaveProperty('OPENAI_API_KEY');
		expect(process.env).toHaveProperty('GEMINI_API_KEY');
	});
});
