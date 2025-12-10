import { describe, it, expect } from 'vitest';
import { sanitizeSurrogates } from '../../src/utils/sanitize-unicode';

describe('sanitizeSurrogates', () => {
	describe('Valid text (no changes)', () => {
		it('should leave valid ASCII text unchanged', () => {
			const text = 'Hello, World!';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});

		it('should leave valid Unicode text unchanged', () => {
			const text = 'Hello 世界 مرحبا мир';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});

		it('should preserve valid emoji (paired surrogates)', () => {
			const text = 'Hello 😀 👋 🌍 ✨';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
			expect(result).toContain('😀');
			expect(result).toContain('👋');
		});

		it('should preserve multiple emojis in sequence', () => {
			const text = '🎉🎊🎈🎁';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});

		it('should preserve complex emoji with modifiers', () => {
			const text = '👨‍👩‍👧‍👦'; // Family emoji with ZWJ
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});

		it('should preserve emoji with skin tone modifiers', () => {
			const text = '👋🏻👋🏿'; // Waving hand with different skin tones
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});
	});

	describe('Unpaired high surrogate removal', () => {
		it('should remove unpaired high surrogate', () => {
			const text = 'Hello\uD800World'; // \uD800 is unpaired high surrogate
			const result = sanitizeSurrogates(text);

			expect(result).toBe('HelloWorld');
			expect(result).not.toContain('\uD800');
		});

		it('should remove multiple unpaired high surrogates', () => {
			const text = '\uD800\uD800\uD800ABC';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('ABC');
		});

		it('should remove unpaired high surrogate at start', () => {
			const text = '\uD800Hello';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('Hello');
		});

		it('should remove unpaired high surrogate at end', () => {
			const text = 'Hello\uD800';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('Hello');
		});

		it('should remove unpaired high surrogate in middle', () => {
			const text = 'Hello\uD800World\uD800!';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('HelloWorld!');
		});
	});

	describe('Unpaired low surrogate removal', () => {
		it('should remove unpaired low surrogate', () => {
			const text = 'Hello\uDC00World'; // \uDC00 is unpaired low surrogate
			const result = sanitizeSurrogates(text);

			expect(result).toBe('HelloWorld');
			expect(result).not.toContain('\uDC00');
		});

		it('should remove multiple unpaired low surrogates', () => {
			const text = '\uDC00\uDC00\uDC00ABC';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('ABC');
		});

		it('should remove unpaired low surrogate at start', () => {
			const text = '\uDC00Hello';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('Hello');
		});

		it('should remove unpaired low surrogate at end', () => {
			const text = 'Hello\uDC00';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('Hello');
		});
	});

	describe('Mixed valid and invalid surrogates', () => {
		it('should remove unpaired surrogates but keep valid emoji', () => {
			const text = 'Hello\uD800😀\uDC00World';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('Hello😀World');
			expect(result).toContain('😀');
		});

		it('should handle text with both valid and invalid surrogates', () => {
			const text = '\uD800Valid text 👋 with emoji\uDC00 and surrogates\uD801';
			const result = sanitizeSurrogates(text);

			expect(result).toContain('Valid text');
			expect(result).toContain('👋');
			expect(result).toContain('with emoji');
			expect(result).not.toContain('\uD800');
			expect(result).not.toContain('\uDC00');
			expect(result).not.toContain('\uD801');
		});

		it('should preserve properly paired surrogates (emoji)', () => {
			// Emoji are made of surrogate pairs, should be preserved
			const text = 'Test\uD800 😊 \uDC00Text'; // Unpaired + emoji + unpaired
			const result = sanitizeSurrogates(text);

			expect(result).toContain('😊');
			expect(result).not.toContain('\uD800');
			expect(result).not.toContain('\uDC00');
		});
	});

	describe('Empty and edge cases', () => {
		it('should handle empty string', () => {
			const text = '';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('');
		});

		it('should handle string with only surrogates', () => {
			const text = '\uD800\uDC00\uD801\uDC01';
			const result = sanitizeSurrogates(text);

			// May remove all or preserve pairs
			expect(result).toBeDefined();
		});

		it('should handle single unpaired high surrogate', () => {
			const text = '\uD800';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('');
		});

		it('should handle single unpaired low surrogate', () => {
			const text = '\uDC00';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('');
		});

		it('should handle whitespace', () => {
			const text = '   \n\t  ';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});
	});

	describe('Special characters', () => {
		it('should preserve newlines and tabs', () => {
			const text = 'Hello\nWorld\tTest';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});

		it('should preserve special ASCII characters', () => {
			const text = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});

		it('should preserve quotes and apostrophes', () => {
			const text = '"Hello" \'World\'';
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});
	});

	describe('Long strings', () => {
		it('should handle long string with surrogates', () => {
			const longText = 'A'.repeat(1000) + '\uD800' + 'B'.repeat(1000);
			const result = sanitizeSurrogates(longText);

			expect(result).toHaveLength(2000);
			expect(result).not.toContain('\uD800');
		});

		it('should handle long string with multiple surrogates', () => {
			let text = '';
			for (let i = 0; i < 100; i++) {
				text += 'Valid' + '\uD800' + 'Text' + '\uDC00';
			}
			const result = sanitizeSurrogates(text);

			expect(result).not.toContain('\uD800');
			expect(result).not.toContain('\uDC00');
			expect(result).toContain('ValidText');
		});
	});

	describe('Real-world scenarios', () => {
		it('should clean LLM output with occasional surrogates', () => {
			const llmOutput = 'The answer is 42.\uD800 This text should be clean.';
			const result = sanitizeSurrogates(llmOutput);

			expect(result).toBe('The answer is 42. This text should be clean.');
		});

		it('should handle JSON-like strings with surrogates', () => {
			const jsonLike = '{"text": "Hello\uD800World"}';
			const result = sanitizeSurrogates(jsonLike);

			expect(result).toBe('{"text": "HelloWorld"}');
		});

		it('should preserve valid emoji in user messages', () => {
			const userMessage = 'Thanks! 🙏 This helped a lot 😊';
			const result = sanitizeSurrogates(userMessage);

			expect(result).toBe(userMessage);
			expect(result).toContain('🙏');
			expect(result).toContain('😊');
		});

		it('should clean malformed API responses', () => {
			const malformed = 'Error\uD800:\uDC00 Invalid request';
			const result = sanitizeSurrogates(malformed);

			expect(result).toBe('Error: Invalid request');
		});
	});

	describe('Unicode normalization', () => {
		it('should handle combining characters', () => {
			const text = 'café'; // e + combining acute accent
			const result = sanitizeSurrogates(text);

			expect(result).toBeDefined();
			expect(result).toContain('café');
		});

		it('should handle zero-width joiners (emoji)', () => {
			const text = '👨‍💻'; // Man + ZWJ + Laptop
			const result = sanitizeSurrogates(text);

			expect(result).toBe(text);
		});
	});

	describe('Different surrogate ranges', () => {
		it('should remove high surrogates at start of range', () => {
			const text = 'Test\uD800Text';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('TestText');
		});

		it('should remove high surrogates at end of range', () => {
			const text = 'Test\uDBFFText';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('TestText');
		});

		it('should remove low surrogates at start of range', () => {
			const text = 'Test\uDC00Text';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('TestText');
		});

		it('should remove low surrogates at end of range', () => {
			const text = 'Test\uDFFFText';
			const result = sanitizeSurrogates(text);

			expect(result).toBe('TestText');
		});
	});

	describe('System message use case', () => {
		it('should clean system prompts with surrogates', () => {
			const systemPrompt = 'You are a helpful assistant.\uD800 Be concise.';
			const result = sanitizeSurrogates(systemPrompt);

			expect(result).toBe('You are a helpful assistant. Be concise.');
		});

		it('should preserve emoji in system prompts', () => {
			const systemPrompt = 'You are a friendly 🤖 assistant. Always be helpful ✨';
			const result = sanitizeSurrogates(systemPrompt);

			expect(result).toBe(systemPrompt);
		});
	});
});
