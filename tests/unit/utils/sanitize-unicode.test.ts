import { describe, it, expect } from 'vitest';
import { sanitizeSurrogates } from '../../../src/utils/sanitize-unicode.js';

describe('sanitizeSurrogates', () => {
	describe('preserves valid content', () => {
		it('should preserve normal ASCII text', () => {
			const text = 'Hello, World!';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve empty string', () => {
			expect(sanitizeSurrogates('')).toBe('');
		});

		it('should preserve text with newlines and special characters', () => {
			const text = 'Line 1\nLine 2\tTabbed\r\nWindows';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve valid emoji (properly paired surrogates)', () => {
			const text = 'Hello 🙈 World';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve multiple valid emoji', () => {
			const text = '🎉🎊🎁🎂';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve emoji with skin tone modifiers', () => {
			const text = '👋🏽 Hello';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve complex emoji sequences (ZWJ)', () => {
			// Family emoji with ZWJ sequences
			const text = '👨‍👩‍👧‍👦';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve flag emoji', () => {
			const text = '🇺🇸 🇬🇧 🇯🇵';
			expect(sanitizeSurrogates(text)).toBe(text);
		});

		it('should preserve Unicode characters outside BMP', () => {
			// Mathematical symbols, ancient scripts, etc.
			const text = '𝕳𝖊𝖑𝖑𝖔'; // Mathematical fraktur
			expect(sanitizeSurrogates(text)).toBe(text);
		});
	});

	describe('removes unpaired surrogates', () => {
		it('should remove unpaired high surrogate', () => {
			// High surrogate (0xD83D) without matching low surrogate
			const unpaired = String.fromCharCode(0xD83D);
			const text = `Text ${unpaired} here`;
			expect(sanitizeSurrogates(text)).toBe('Text  here');
		});

		it('should remove unpaired low surrogate', () => {
			// Low surrogate (0xDC00) without preceding high surrogate
			const unpaired = String.fromCharCode(0xDC00);
			const text = `Text ${unpaired} here`;
			expect(sanitizeSurrogates(text)).toBe('Text  here');
		});

		it('should remove multiple unpaired high surrogates', () => {
			const high1 = String.fromCharCode(0xD800);
			const high2 = String.fromCharCode(0xDBFF);
			const text = `A${high1}B${high2}C`;
			expect(sanitizeSurrogates(text)).toBe('ABC');
		});

		it('should remove multiple unpaired low surrogates', () => {
			const low1 = String.fromCharCode(0xDC00);
			const low2 = String.fromCharCode(0xDFFF);
			const text = `A${low1}B${low2}C`;
			expect(sanitizeSurrogates(text)).toBe('ABC');
		});

		it('should remove high surrogate at end of string', () => {
			const high = String.fromCharCode(0xD83D);
			const text = `Text${high}`;
			expect(sanitizeSurrogates(text)).toBe('Text');
		});

		it('should remove low surrogate at start of string', () => {
			const low = String.fromCharCode(0xDE00);
			const text = `${low}Text`;
			expect(sanitizeSurrogates(text)).toBe('Text');
		});

		it('should remove reversed surrogate pair (low then high)', () => {
			// Wrong order: low surrogate followed by high surrogate
			const low = String.fromCharCode(0xDC00);
			const high = String.fromCharCode(0xD800);
			const text = `A${low}${high}B`;
			// Both should be removed as they're unpaired
			expect(sanitizeSurrogates(text)).toBe('AB');
		});
	});

	describe('handles mixed valid and invalid', () => {
		it('should preserve valid emoji while removing unpaired surrogates', () => {
			const unpaired = String.fromCharCode(0xD83D);
			const text = `🎉 Party ${unpaired} time 🎊`;
			expect(sanitizeSurrogates(text)).toBe('🎉 Party  time 🎊');
		});

		it('should handle unpaired surrogate between valid emoji', () => {
			const unpaired = String.fromCharCode(0xDC00);
			const text = `🔥${unpaired}🚀`;
			expect(sanitizeSurrogates(text)).toBe('🔥🚀');
		});

		it('should handle valid emoji followed by unpaired high surrogate', () => {
			const high = String.fromCharCode(0xD83D);
			const text = `🙈${high}`;
			expect(sanitizeSurrogates(text)).toBe('🙈');
		});

		it('should handle unpaired low surrogate followed by valid emoji', () => {
			const low = String.fromCharCode(0xDE00);
			const text = `${low}🙈`;
			expect(sanitizeSurrogates(text)).toBe('🙈');
		});
	});

	describe('edge cases', () => {
		it('should handle string with only unpaired surrogates', () => {
			const high = String.fromCharCode(0xD800);
			const low = String.fromCharCode(0xDC00);
			// Note: placing them adjacent would form a valid pair
			// So we separate them with other surrogates
			const text = `${high}${high}${low}`;
			// First two highs are unpaired (first high pairs with nothing, second high pairs with low)
			// Wait, let me think about this...
			// Actually: high1 + high2 + low = high1 is unpaired, high2+low form valid pair
			expect(sanitizeSurrogates(text)).toBe(String.fromCharCode(0xD800, 0xDC00));
		});

		it('should handle consecutive unpaired surrogates of same type', () => {
			const high1 = String.fromCharCode(0xD800);
			const high2 = String.fromCharCode(0xD801);
			const text = `${high1}${high2}`;
			// Both are high surrogates with no following low surrogate
			expect(sanitizeSurrogates(text)).toBe('');
		});

		it('should handle very long string with scattered unpaired surrogates', () => {
			const unpaired = String.fromCharCode(0xD83D);
			const longText = 'a'.repeat(1000) + unpaired + 'b'.repeat(1000) + unpaired + 'c'.repeat(1000);
			const expected = 'a'.repeat(1000) + 'b'.repeat(1000) + 'c'.repeat(1000);
			expect(sanitizeSurrogates(longText)).toBe(expected);
		});

		it('should handle string that is just an unpaired high surrogate', () => {
			const text = String.fromCharCode(0xD83D);
			expect(sanitizeSurrogates(text)).toBe('');
		});

		it('should handle string that is just an unpaired low surrogate', () => {
			const text = String.fromCharCode(0xDE00);
			expect(sanitizeSurrogates(text)).toBe('');
		});
	});
});
