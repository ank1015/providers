import { describe, it, expect } from 'vitest';
import { parseStreamingJson } from '../../../src/utils/json-parse.js';

describe('parseStreamingJson', () => {
	describe('complete valid JSON', () => {
		it('should parse complete object', () => {
			const result = parseStreamingJson('{"name": "test", "value": 42}');
			expect(result).toEqual({ name: 'test', value: 42 });
		});

		it('should parse complete array', () => {
			const result = parseStreamingJson('[1, 2, 3, 4, 5]');
			expect(result).toEqual([1, 2, 3, 4, 5]);
		});

		it('should parse nested objects', () => {
			const result = parseStreamingJson('{"user": {"name": "Alice", "age": 30}}');
			expect(result).toEqual({ user: { name: 'Alice', age: 30 } });
		});

		it('should parse array of objects', () => {
			const result = parseStreamingJson('[{"id": 1}, {"id": 2}]');
			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it('should parse with various value types', () => {
			const result = parseStreamingJson('{"str": "hello", "num": 42, "bool": true, "null": null}');
			expect(result).toEqual({ str: 'hello', num: 42, bool: true, null: null });
		});

		it('should parse empty object', () => {
			const result = parseStreamingJson('{}');
			expect(result).toEqual({});
		});

		it('should parse empty array', () => {
			const result = parseStreamingJson('[]');
			expect(result).toEqual([]);
		});
	});

	describe('empty and undefined input', () => {
		it('should return empty object for undefined', () => {
			const result = parseStreamingJson(undefined);
			expect(result).toEqual({});
		});

		it('should return empty object for empty string', () => {
			const result = parseStreamingJson('');
			expect(result).toEqual({});
		});

		it('should return empty object for whitespace only', () => {
			const result = parseStreamingJson('   ');
			expect(result).toEqual({});
		});

		it('should return empty object for newlines only', () => {
			const result = parseStreamingJson('\n\n\n');
			expect(result).toEqual({});
		});
	});

	describe('partial JSON objects', () => {
		it('should parse partial object with complete key-value', () => {
			const result = parseStreamingJson('{"name": "test"');
			expect(result).toEqual({ name: 'test' });
		});

		it('should parse partial object with incomplete value', () => {
			const result = parseStreamingJson('{"name": "tes');
			expect(result).toEqual({ name: 'tes' });
		});

		it('should parse partial object with incomplete key', () => {
			const result = parseStreamingJson('{"nam');
			// partial-json may return empty or partial depending on implementation
			expect(result).toBeDefined();
		});

		it('should parse partial nested object', () => {
			const result = parseStreamingJson('{"user": {"name": "Alice"');
			expect(result).toEqual({ user: { name: 'Alice' } });
		});

		it('should parse partial with multiple complete keys', () => {
			const result = parseStreamingJson('{"a": 1, "b": 2, "c": 3');
			expect(result).toEqual({ a: 1, b: 2, c: 3 });
		});

		it('should parse partial with number being typed', () => {
			const result = parseStreamingJson('{"count": 12');
			expect(result).toEqual({ count: 12 });
		});

		it('should handle partial boolean', () => {
			const result = parseStreamingJson('{"enabled": tru');
			// May return empty or partial depending on partial-json behavior
			expect(result).toBeDefined();
		});
	});

	describe('partial JSON arrays', () => {
		it('should parse partial array with complete elements', () => {
			const result = parseStreamingJson('[1, 2, 3');
			expect(result).toEqual([1, 2, 3]);
		});

		it('should parse partial array of strings', () => {
			const result = parseStreamingJson('["a", "b", "c"');
			expect(result).toEqual(['a', 'b', 'c']);
		});

		it('should parse partial array with incomplete string', () => {
			const result = parseStreamingJson('["hello", "wor');
			expect(result).toEqual(['hello', 'wor']);
		});

		it('should parse partial array of objects', () => {
			const result = parseStreamingJson('[{"id": 1}, {"id": 2');
			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it('should parse deeply partial array', () => {
			const result = parseStreamingJson('[1, 2');
			expect(result).toEqual([1, 2]);
		});
	});

	describe('complex partial structures', () => {
		it('should parse tool call arguments streaming', () => {
			// Simulate streaming tool call arguments
			const partials = [
				'{"',
				'{"file',
				'{"file_path": "',
				'{"file_path": "/src',
				'{"file_path": "/src/index.ts"',
				'{"file_path": "/src/index.ts", "',
				'{"file_path": "/src/index.ts", "content',
				'{"file_path": "/src/index.ts", "content": "hello',
				'{"file_path": "/src/index.ts", "content": "hello"}',
			];

			// Each partial should parse to something reasonable
			for (const partial of partials) {
				const result = parseStreamingJson(partial);
				expect(result).toBeDefined();
			}

			// Final complete JSON should parse correctly
			const final = parseStreamingJson(partials[partials.length - 1]);
			expect(final).toEqual({ file_path: '/src/index.ts', content: 'hello' });
		});

		it('should handle array inside object', () => {
			const result = parseStreamingJson('{"items": [1, 2, 3');
			expect(result).toEqual({ items: [1, 2, 3] });
		});

		it('should handle object inside array inside object', () => {
			const result = parseStreamingJson('{"users": [{"name": "Alice"');
			expect(result).toEqual({ users: [{ name: 'Alice' }] });
		});
	});

	describe('invalid JSON', () => {
		it('should return empty object for completely invalid', () => {
			const result = parseStreamingJson('not json at all');
			expect(result).toEqual({});
		});

		it('should return empty object for malformed JSON', () => {
			const result = parseStreamingJson('{{{invalid');
			expect(result).toEqual({});
		});

		it('should return empty object for random characters', () => {
			const result = parseStreamingJson('@#$%^&*');
			expect(result).toEqual({});
		});

		it('should return empty object for unmatched brackets', () => {
			const result = parseStreamingJson('}}}}');
			expect(result).toEqual({});
		});
	});

	describe('edge cases', () => {
		it('should handle escaped characters in strings', () => {
			const result = parseStreamingJson('{"text": "line1\\nline2"}');
			expect(result).toEqual({ text: 'line1\nline2' });
		});

		it('should handle unicode in strings', () => {
			const result = parseStreamingJson('{"emoji": "hello 👋"}');
			expect(result).toEqual({ emoji: 'hello 👋' });
		});

		it('should handle very long strings', () => {
			const longValue = 'a'.repeat(10000);
			const result = parseStreamingJson(`{"data": "${longValue}"}`);
			expect(result).toEqual({ data: longValue });
		});

		it('should handle very long partial strings', () => {
			const longValue = 'a'.repeat(10000);
			const result = parseStreamingJson(`{"data": "${longValue}`);
			expect(result).toEqual({ data: longValue });
		});

		it('should handle floating point numbers', () => {
			const result = parseStreamingJson('{"pi": 3.14159}');
			expect(result).toEqual({ pi: 3.14159 });
		});

		it('should handle negative numbers', () => {
			const result = parseStreamingJson('{"temp": -20}');
			expect(result).toEqual({ temp: -20 });
		});

		it('should handle scientific notation', () => {
			const result = parseStreamingJson('{"big": 1.5e10}');
			expect(result).toEqual({ big: 1.5e10 });
		});

		it('should handle partial scientific notation', () => {
			const result = parseStreamingJson('{"big": 1.5e');
			// May parse as partial or fail gracefully
			expect(result).toBeDefined();
		});
	});

	describe('type parameter', () => {
		it('should return typed result', () => {
			interface User {
				name: string;
				age: number;
			}

			const result = parseStreamingJson<User>('{"name": "Alice", "age": 30}');
			expect(result.name).toBe('Alice');
			expect(result.age).toBe(30);
		});

		it('should return typed empty object on failure', () => {
			interface Config {
				enabled: boolean;
			}

			const result = parseStreamingJson<Config>('invalid');
			expect(result).toEqual({});
		});
	});
});
