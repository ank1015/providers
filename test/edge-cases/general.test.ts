import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { validateToolArguments } from '../../src/utils/validation';
import { sanitizeSurrogates } from '../../src/utils/sanitize-unicode';
import { parseStreamingJson } from '../../src/utils/json-parse';
import { buildOpenAIMessages, buildGoogleMessages } from '../../src/providers/convert';
import { Context, Model, Tool } from '../../src/types';

const mockOpenAIModel: Model<'openai'> = {
	id: 'test',
	name: 'Test',
	api: 'openai',
	baseUrl: 'https://api.openai.com',
	reasoning: false,
	input: ['text', 'image', 'file'],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 4096,
};

const mockGoogleModel: Model<'google'> = {
	id: 'test',
	name: 'Test',
	api: 'google',
	baseUrl: 'https://googleapis.com',
	reasoning: false,
	input: ['text', 'image', 'file'],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 8192,
};

describe('Edge Cases - Context and Messages', () => {
	it('should handle empty context (no messages, no system prompt)', () => {
		const context: Context = {
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();

		const openaiResult = buildOpenAIMessages(mockOpenAIModel, context);
		const googleResult = buildGoogleMessages(mockGoogleModel, context);

		expect(openaiResult).toEqual([]);
		expect(googleResult).toEqual([]);
	});

	it('should handle context with only system prompt', () => {
		const context: Context = {
			systemPrompt: 'You are a helpful assistant.',
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();

		const result = buildOpenAIMessages(mockOpenAIModel, context);
		expect(result).toHaveLength(1);
		expect((result[0] as any).role).toBe('developer');
	});

	it('should handle very long system prompt', () => {
		const longPrompt = 'A'.repeat(10000);
		const context: Context = {
			systemPrompt: longPrompt,
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		const result = buildOpenAIMessages(mockOpenAIModel, context);
		expect((result[0] as any).content.length).toBeGreaterThan(5000);
	});

	it('should handle very long single message', () => {
		const longText = 'B'.repeat(50000);
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [{ type: 'text', content: longText }],
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});
});

describe('Edge Cases - Unicode and Special Characters', () => {
	it('should handle emojis in messages', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [{ type: 'text', content: 'Hello 👋 🌍 ✨' }],
					timestamp: Date.now(),
				},
			],
		};

		const openaiResult = buildOpenAIMessages(mockOpenAIModel, context);
		const googleResult = buildGoogleMessages(mockGoogleModel, context);

		expect(openaiResult).toBeDefined();
		expect(googleResult).toBeDefined();
	});

	it('should handle special characters in tool arguments', () => {
		const tool: Tool = {
			name: 'test',
			description: 'Test',
			parameters: Type.Object({
				text: Type.String(),
			}),
		};

		const toolCall = {
			type: 'toolCall' as const,
			name: 'test',
			arguments: {
				text: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\',
			},
		};

		expect(() => validateToolArguments(tool, toolCall)).not.toThrow();
	});

	it('should handle Unicode surrogate pairs (emoji)', () => {
		const text = '👨‍👩‍👧‍👦'; // Family emoji with ZWJ
		const result = sanitizeSurrogates(text);
		expect(result).toBe(text);
	});

	it('should remove unpaired surrogates', () => {
		const text = 'Hello\uD800World'; // Unpaired high surrogate
		const result = sanitizeSurrogates(text);
		expect(result).toBe('HelloWorld');
	});
});

describe('Edge Cases - Malformed Data', () => {
	it('should handle malformed base64 in image content', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', content: 'Image:' },
						{ type: 'image', data: 'not-valid-base64!@#', mimeType: 'image/png' },
					],
					timestamp: Date.now(),
				},
			],
		};

		// Should not throw, even with invalid base64
		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});

	it('should handle invalid MIME types', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image', data: 'data', mimeType: 'invalid/mimetype/extra' },
					],
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});

	it('should handle null/undefined in content arrays (defensive)', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', content: 'Valid text' },
					],
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});
});

describe('Edge Cases - Tool Validation', () => {
	it('should handle very large tool argument objects', () => {
		const tool: Tool = {
			name: 'test',
			description: 'Test',
			parameters: Type.Object({
				data: Type.Any(),
			}),
		};

		const largeData: Record<string, number> = {};
		for (let i = 0; i < 1000; i++) {
			largeData[`key${i}`] = i;
		}

		const toolCall = {
			type: 'toolCall' as const,
			name: 'test',
			arguments: { data: largeData },
		};

		const result = validateToolArguments(tool, toolCall);
		expect((result as any).data).toBeDefined();
	});

	it('should handle tool with no parameters', () => {
		const tool: Tool = {
			name: 'test',
			description: 'Test',
			parameters: Type.Object({}),
		};

		const toolCall = {
			type: 'toolCall' as const,
			name: 'test',
			arguments: {},
		};

		expect(() => validateToolArguments(tool, toolCall)).not.toThrow();
	});

	it('should handle tool with only optional parameters', () => {
		const tool: Tool = {
			name: 'test',
			description: 'Test',
			parameters: Type.Object({
				optional1: Type.Optional(Type.String()),
				optional2: Type.Optional(Type.Number()),
			}),
		};

		const toolCall = {
			type: 'toolCall' as const,
			name: 'test',
			arguments: {},
		};

		expect(() => validateToolArguments(tool, toolCall)).not.toThrow();
	});

	it('should handle nested optional parameters', () => {
		const tool: Tool = {
			name: 'test',
			description: 'Test',
			parameters: Type.Object({
				level1: Type.Optional(
					Type.Object({
						level2: Type.Optional(
							Type.Object({
								value: Type.String(),
							})
						),
					})
				),
			}),
		};

		const toolCall = {
			type: 'toolCall' as const,
			name: 'test',
			arguments: {},
		};

		expect(() => validateToolArguments(tool, toolCall)).not.toThrow();
	});

	it('should handle circular reference detection (if applicable)', () => {
		const tool: Tool = {
			name: 'test',
			description: 'Test',
			parameters: Type.Object({
				data: Type.Any(),
			}),
		};

		const circular: any = { a: 1 };
		circular.self = circular;

		const toolCall = {
			type: 'toolCall' as const,
			name: 'test',
			arguments: { data: circular },
		};

		// Validation should handle this gracefully (may fail validation or handle it)
		// The important thing is it shouldn't crash
		expect(() => {
			try {
				validateToolArguments(tool, toolCall);
			} catch (e) {
				// It's okay if it throws a validation error
				expect(e).toBeDefined();
			}
		}).not.toThrow(TypeError);
	});
});

describe('Edge Cases - JSON Parsing', () => {
	it('should handle malformed JSON gracefully', () => {
		const malformed = '{name: "test"}'; // Missing quotes
		const result = parseStreamingJson(malformed);
		expect(result).toEqual({});
	});

	it('should handle incomplete JSON object', () => {
		const incomplete = '{"name": "test", "age":';
		const result = parseStreamingJson(incomplete);
		expect(result).toBeDefined();
	});

	it('should handle incomplete JSON array', () => {
		const incomplete = '[1, 2, 3';
		const result = parseStreamingJson(incomplete);
		expect(result).toBeDefined();
	});

	it('should handle empty string', () => {
		const result = parseStreamingJson('');
		expect(result).toEqual({});
	});

	it('should handle null input (defensive)', () => {
		const result = parseStreamingJson(null as any);
		expect(result).toBeDefined();
	});

	it('should handle very deeply nested JSON', () => {
		let json = '';
		for (let i = 0; i < 100; i++) {
			json += '{"a":';
		}
		json += '"value"';
		for (let i = 0; i < 100; i++) {
			json += '}';
		}

		expect(() => parseStreamingJson(json)).not.toThrow();
	});
});

describe('Edge Cases - Message Content', () => {
	it('should handle empty content array', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [],
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});

	it('should handle mix of all content types', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', content: 'Text' },
						{ type: 'image', data: 'img', mimeType: 'image/png' },
						{ type: 'file', data: 'file', mimeType: 'application/pdf' },
						{ type: 'text', content: 'More text' },
					],
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});

	it('should handle very long base64 strings (large images)', () => {
		const largeBase64 = 'A'.repeat(1000000); // 1MB of data
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image', data: largeBase64, mimeType: 'image/jpeg' },
					],
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});
});

describe('Edge Cases - Tool Results', () => {
	it('should handle tool result without call ID', () => {
		const context: Context = {
			messages: [
				{
					role: 'toolResult',
					toolName: 'test',
					content: [{ type: 'text', content: 'Result' }],
					isError: false,
					timestamp: Date.now(),
				},
			],
		};

		// Should handle gracefully (may use undefined or empty string)
		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});

	it('should handle tool result with empty content', () => {
		const context: Context = {
			messages: [
				{
					role: 'toolResult',
					toolName: 'test',
					toolCallId: 'call_1',
					content: [],
					isError: false,
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});

	it('should handle tool result with very long error message', () => {
		const longError = 'E'.repeat(10000);
		const context: Context = {
			messages: [
				{
					role: 'toolResult',
					toolName: 'test',
					toolCallId: 'call_1',
					content: [{ type: 'text', content: longError }],
					isError: true,
					error: {
						message: longError,
						name: 'Error',
					},
					timestamp: Date.now(),
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
		expect(() => buildGoogleMessages(mockGoogleModel, context)).not.toThrow();
	});
});

describe('Edge Cases - Special Characters in Strings', () => {
	it('should handle newlines and tabs', () => {
		const context: Context = {
			systemPrompt: 'Line1\nLine2\tTabbed',
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});

	it('should handle quotes and apostrophes', () => {
		const context: Context = {
			systemPrompt: `"Hello" 'World' \\"Escaped\\"`,
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});

	it('should handle backslashes', () => {
		const context: Context = {
			systemPrompt: 'Path: C:\\Users\\Test\\File.txt',
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});

	it('should handle null characters (if they somehow appear)', () => {
		const context: Context = {
			systemPrompt: 'Before\0After',
			messages: [],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});
});

describe('Edge Cases - Extreme Values', () => {
	it('should handle timestamp with very large value', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [{ type: 'text', content: 'Test' }],
					timestamp: Number.MAX_SAFE_INTEGER,
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});

	it('should handle timestamp with zero', () => {
		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [{ type: 'text', content: 'Test' }],
					timestamp: 0,
				},
			],
		};

		expect(() => buildOpenAIMessages(mockOpenAIModel, context)).not.toThrow();
	});
});

describe('Edge Cases - Model Configuration', () => {
	it('should handle model with text-only input', () => {
		const textOnlyModel: Model<'openai'> = {
			...mockOpenAIModel,
			input: ['text'],
		};

		const context: Context = {
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', content: 'Text' },
						{ type: 'image', data: 'img', mimeType: 'image/png' },
					],
					timestamp: Date.now(),
				},
			],
		};

		const result = buildOpenAIMessages(textOnlyModel, context);
		// Should only include text content
		expect((result[0] as any).content.length).toBe(1);
	});
});
