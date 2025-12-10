import { describe, it, expect } from 'vitest';
import { parseStreamingJson } from '../../src/utils/json-parse';

describe('parseStreamingJson', () => {
	describe('Complete valid JSON', () => {
		it('should parse complete valid object', () => {
			const json = '{"name": "John", "age": 30}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({ name: 'John', age: 30 });
		});

		it('should parse complete valid array', () => {
			const json = '[1, 2, 3, 4, 5]';
			const result = parseStreamingJson(json);

			expect(result).toEqual([1, 2, 3, 4, 5]);
		});

		it('should parse nested objects', () => {
			const json = '{"user": {"name": "John", "address": {"city": "NYC"}}}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				user: {
					name: 'John',
					address: {
						city: 'NYC',
					},
				},
			});
		});

		it('should parse complex nested structure', () => {
			const json = '{"items": [{"id": 1, "data": {"value": true}}, {"id": 2}]}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				items: [
					{ id: 1, data: { value: true } },
					{ id: 2 },
				],
			});
		});

		it('should parse JSON with special characters', () => {
			const json = '{"text": "Hello\\nWorld\\t!", "emoji": "😀"}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				text: 'Hello\nWorld\t!',
				emoji: '😀',
			});
		});

		it('should parse JSON with numbers', () => {
			const json = '{"int": 42, "float": 3.14, "negative": -10, "exp": 1e5}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				int: 42,
				float: 3.14,
				negative: -10,
				exp: 100000,
			});
		});

		it('should parse JSON with booleans and null', () => {
			const json = '{"isTrue": true, "isFalse": false, "empty": null}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				isTrue: true,
				isFalse: false,
				empty: null,
			});
		});
	});

	describe('Incomplete JSON (partial)', () => {
		it('should handle incomplete object (missing closing brace)', () => {
			const json = '{"name": "John", "age": 30';
			const result = parseStreamingJson(json);

			// partial-json library should handle this
			expect(result).toBeDefined();
			expect(typeof result).toBe('object');
		});

		it('should handle incomplete array (missing closing bracket)', () => {
			const json = '[1, 2, 3, 4';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
			expect(Array.isArray(result) || typeof result === 'object').toBe(true);
		});

		it('should handle incomplete string value', () => {
			const json = '{"name": "John';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});

		it('should handle partial nested object', () => {
			const json = '{"user": {"name": "John", "address": {';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
			expect(typeof result).toBe('object');
		});

		it('should handle partial array in object', () => {
			const json = '{"items": [1, 2';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});

		it('should handle incomplete key-value pair', () => {
			const json = '{"name": "John", "age":';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});

		it('should handle trailing comma', () => {
			const json = '{"name": "John", "age": 30,';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});
	});

	describe('Invalid JSON', () => {
		it('should return empty object for completely invalid JSON', () => {
			const json = 'this is not json at all';
			const result = parseStreamingJson(json);

			expect(result).toEqual({});
		});

		it('should return empty object for malformed JSON', () => {
			const json = '{name: John}'; // Missing quotes
			const result = parseStreamingJson(json);

			expect(result).toEqual({});
		});

		it('should return empty object for random characters', () => {
			const json = '!@#$%^&*()';
			const result = parseStreamingJson(json);

			expect(result).toEqual({});
		});
	});

	describe('Empty input', () => {
		it('should handle empty string', () => {
			const json = '';
			const result = parseStreamingJson(json);

			expect(result).toEqual({});
		});

		it('should handle whitespace only', () => {
			const json = '   \n\t  ';
			const result = parseStreamingJson(json);

			expect(result).toEqual({});
		});
	});

	describe('Tool argument streaming scenarios', () => {
		it('should handle streaming tool arguments (early stage)', () => {
			const json = '{"expressi';
			const result = parseStreamingJson(json);

			// Should not crash and return something
			expect(result).toBeDefined();
		});

		it('should handle streaming tool arguments (mid stage)', () => {
			const json = '{"expression": "2 + 2';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
			if (typeof result === 'object' && result !== null && 'expression' in result) {
				expect(typeof (result as any).expression).toBe('string');
			}
		});

		it('should handle streaming tool arguments (near complete)', () => {
			const json = '{"expression": "2 + 2", "format": "decimal"';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});

		it('should handle complex tool arguments partial', () => {
			const json = '{"query": "search term", "filters": {"category": "tech", "date":';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
			expect(typeof result).toBe('object');
		});

		it('should handle array argument partial', () => {
			const json = '{"ids": [1, 2, 3';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});
	});

	describe('Unicode handling', () => {
		it('should handle Unicode characters', () => {
			const json = '{"text": "Hello 世界", "emoji": "🎉"}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				text: 'Hello 世界',
				emoji: '🎉',
			});
		});

		it('should handle escaped Unicode', () => {
			const json = '{"text": "\\u0048\\u0065\\u006C\\u006C\\u006F"}'; // "Hello"
			const result = parseStreamingJson(json);

			expect(result).toEqual({ text: 'Hello' });
		});
	});

	describe('Escaped characters', () => {
		it('should handle escaped quotes', () => {
			const json = '{"text": "He said \\"Hello\\""}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({ text: 'He said "Hello"' });
		});

		it('should handle escaped backslashes', () => {
			const json = '{"path": "C:\\\\Users\\\\John"}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({ path: 'C:\\Users\\John' });
		});

		it('should handle multiple escape sequences', () => {
			const json = '{"text": "Line1\\nLine2\\tTabbed\\rReturn"}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				text: 'Line1\nLine2\tTabbed\rReturn',
			});
		});
	});

	describe('Large JSON', () => {
		it('should handle large object', () => {
			const largeObj: Record<string, number> = {};
			for (let i = 0; i < 1000; i++) {
				largeObj[`key${i}`] = i;
			}
			const json = JSON.stringify(largeObj);
			const result = parseStreamingJson(json);

			expect(result).toEqual(largeObj);
		});

		it('should handle large array', () => {
			const largeArray = Array.from({ length: 1000 }, (_, i) => i);
			const json = JSON.stringify(largeArray);
			const result = parseStreamingJson(json);

			expect(result).toEqual(largeArray);
		});
	});

	describe('Edge cases', () => {
		it('should handle single character', () => {
			const json = '{';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});

		it('should handle just opening bracket', () => {
			const json = '[';
			const result = parseStreamingJson(json);

			expect(result).toBeDefined();
		});

		it('should handle empty object', () => {
			const json = '{}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({});
		});

		it('should handle empty array', () => {
			const json = '[]';
			const result = parseStreamingJson(json);

			expect(result).toEqual([]);
		});

		it('should handle deeply nested structures', () => {
			const json = '{"a":{"b":{"c":{"d":{"e":"value"}}}}}';
			const result = parseStreamingJson(json);

			expect(result).toEqual({
				a: { b: { c: { d: { e: 'value' } } } },
			});
		});

		it('should handle mixed array elements', () => {
			const json = '[1, "two", true, null, {"key": "value"}]';
			const result = parseStreamingJson(json);

			expect(result).toEqual([1, 'two', true, null, { key: 'value' }]);
		});
	});

	describe('Fallback behavior', () => {
		it('should fallback to partial-json for incomplete JSON', () => {
			// Standard JSON.parse would fail, but parseStreamingJson should handle it
			const json = '{"key": "val';

			expect(() => JSON.parse(json)).toThrow();
			expect(() => parseStreamingJson(json)).not.toThrow();
		});

		it('should try standard JSON.parse first for complete JSON', () => {
			const json = '{"valid": "json"}';
			const result = parseStreamingJson(json);

			// Should work via standard JSON.parse (faster path)
			expect(result).toEqual({ valid: 'json' });
		});
	});
});
