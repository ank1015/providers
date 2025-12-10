import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';

// We'll test this by importing the google provider and using its internal logic
// Since transformSchemaForGoogle is not exported, we'll test through the tool conversion
// For now, let's create a standalone copy to test
function transformSchemaForGoogle(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	// Handle arrays
	if (Array.isArray(schema)) {
		return schema.map(transformSchemaForGoogle);
	}

	const transformed: any = {};

	// Handle const keyword - convert to enum
	if ('const' in schema) {
		transformed.enum = [schema.const];
		// Copy over other properties except const
		for (const key in schema) {
			if (key !== 'const') {
				transformed[key] = schema[key];
			}
		}
		return transformed;
	}

	// Handle anyOf with const values - convert to enum
	if ('anyOf' in schema && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
		const allConst = schema.anyOf.every((item: any) => item && typeof item === 'object' && 'const' in item);
		if (allConst) {
			// Extract all const values into a single enum
			transformed.enum = schema.anyOf.map((item: any) => item.const);
			// Copy over other properties from the parent schema
			for (const key in schema) {
				if (key !== 'anyOf') {
					transformed[key] = schema[key];
				}
			}
			// Copy type and other properties from the first anyOf item if not already set
			if (schema.anyOf.length > 0) {
				const firstItem = schema.anyOf[0];
				for (const key in firstItem) {
					if (key !== 'const' && !(key in transformed)) {
						transformed[key] = firstItem[key];
					}
				}
			}
			return transformed;
		}
	}

	// Recursively process all properties
	for (const key in schema) {
		if (key === 'properties' && typeof schema.properties === 'object') {
			// Recursively transform each property
			transformed.properties = {};
			for (const propKey in schema.properties) {
				transformed.properties[propKey] = transformSchemaForGoogle(schema.properties[propKey]);
			}
		} else if (key === 'items' && schema.items) {
			// Recursively transform array items schema
			transformed.items = transformSchemaForGoogle(schema.items);
		} else if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
			// Recursively transform union/intersection schemas
			transformed[key] = Array.isArray(schema[key])
				? schema[key].map(transformSchemaForGoogle)
				: transformSchemaForGoogle(schema[key]);
		} else {
			// Copy other properties as-is
			transformed[key] = schema[key];
		}
	}

	return transformed;
}

describe('transformSchemaForGoogle', () => {
	describe('const to enum conversion', () => {
		it('should convert const to enum with single value', () => {
			const schema = {
				type: 'string',
				const: 'active',
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				type: 'string',
				enum: ['active'],
			});
			expect(result).not.toHaveProperty('const');
		});

		it('should convert const number to enum', () => {
			const schema = {
				type: 'number',
				const: 42,
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				type: 'number',
				enum: [42],
			});
		});

		it('should convert const boolean to enum', () => {
			const schema = {
				type: 'boolean',
				const: true,
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				type: 'boolean',
				enum: [true],
			});
		});

		it('should preserve other properties when converting const', () => {
			const schema = {
				type: 'string',
				const: 'value',
				description: 'A constant value',
				title: 'Constant Field',
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				type: 'string',
				enum: ['value'],
				description: 'A constant value',
				title: 'Constant Field',
			});
		});
	});

	describe('anyOf with const values to enum conversion', () => {
		it('should convert anyOf with const values to enum', () => {
			const schema = {
				anyOf: [
					{ const: 'active' },
					{ const: 'inactive' },
					{ const: 'pending' },
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				enum: ['active', 'inactive', 'pending'],
			});
		});

		it('should convert anyOf with const and type to enum with type', () => {
			const schema = {
				anyOf: [
					{ type: 'string', const: 'red' },
					{ type: 'string', const: 'green' },
					{ type: 'string', const: 'blue' },
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				type: 'string',
				enum: ['red', 'green', 'blue'],
			});
		});

		it('should preserve parent schema properties', () => {
			const schema = {
				description: 'Status field',
				anyOf: [
					{ const: 'active' },
					{ const: 'inactive' },
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				description: 'Status field',
				enum: ['active', 'inactive'],
			});
		});

		it('should not convert anyOf without all const values', () => {
			const schema = {
				anyOf: [
					{ const: 'active' },
					{ type: 'number' }, // Not a const
				],
			};

			const result = transformSchemaForGoogle(schema);

			// Should recursively transform but not convert to enum
			expect(result).toHaveProperty('anyOf');
			expect(result.anyOf).toHaveLength(2);
		});

		it('should handle anyOf with mixed types in const values', () => {
			const schema = {
				anyOf: [
					{ const: 'string_value' },
					{ const: 42 },
					{ const: true },
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				enum: ['string_value', 42, true],
			});
		});
	});

	describe('Nested object transformation', () => {
		it('should recursively transform nested object properties', () => {
			const schema = {
				type: 'object',
				properties: {
					status: {
						const: 'active',
					},
					priority: {
						anyOf: [
							{ const: 'high' },
							{ const: 'low' },
						],
					},
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.status).toEqual({
				enum: ['active'],
			});
			expect(result.properties.priority).toEqual({
				enum: ['high', 'low'],
			});
		});

		it('should handle deeply nested objects', () => {
			const schema = {
				type: 'object',
				properties: {
					user: {
						type: 'object',
						properties: {
							role: {
								const: 'admin',
							},
							permissions: {
								type: 'object',
								properties: {
									level: {
										anyOf: [
											{ const: 'read' },
											{ const: 'write' },
										],
									},
								},
							},
						},
					},
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.user.properties.role).toEqual({
				enum: ['admin'],
			});
			expect(result.properties.user.properties.permissions.properties.level).toEqual({
				enum: ['read', 'write'],
			});
		});

		it('should preserve non-const properties unchanged', () => {
			const schema = {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 100,
					},
					status: {
						const: 'active',
					},
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.name).toEqual({
				type: 'string',
				minLength: 1,
				maxLength: 100,
			});
			expect(result.properties.status).toEqual({
				enum: ['active'],
			});
		});
	});

	describe('Array items transformation', () => {
		it('should recursively transform array items schema', () => {
			const schema = {
				type: 'array',
				items: {
					const: 'option',
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				type: 'array',
				items: {
					enum: ['option'],
				},
			});
		});

		it('should handle array of objects with const fields', () => {
			const schema = {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						type: {
							const: 'item',
						},
						value: {
							type: 'string',
						},
					},
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.items.properties.type).toEqual({
				enum: ['item'],
			});
			expect(result.items.properties.value).toEqual({
				type: 'string',
			});
		});

		it('should handle array items with anyOf', () => {
			const schema = {
				type: 'array',
				items: {
					anyOf: [
						{ const: 'a' },
						{ const: 'b' },
					],
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.items).toEqual({
				enum: ['a', 'b'],
			});
		});
	});

	describe('Complex union transformations', () => {
		it('should recursively transform anyOf schemas', () => {
			const schema = {
				anyOf: [
					{
						type: 'object',
						properties: {
							mode: { const: 'auto' },
						},
					},
					{
						type: 'object',
						properties: {
							mode: { const: 'manual' },
						},
					},
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.anyOf[0].properties.mode).toEqual({ enum: ['auto'] });
			expect(result.anyOf[1].properties.mode).toEqual({ enum: ['manual'] });
		});

		it('should recursively transform oneOf schemas', () => {
			const schema = {
				oneOf: [
					{ const: 'option1' },
					{ const: 'option2' },
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.oneOf).toEqual([
				{ enum: ['option1'] },
				{ enum: ['option2'] },
			]);
		});

		it('should recursively transform allOf schemas', () => {
			const schema = {
				allOf: [
					{
						type: 'object',
						properties: {
							status: { const: 'active' },
						},
					},
				],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.allOf[0].properties.status).toEqual({ enum: ['active'] });
		});
	});

	describe('TypeBox schema transformation', () => {
		it('should transform TypeBox Literal to enum', () => {
			const schema = Type.Literal('active');

			const result = transformSchemaForGoogle(schema);

			expect(result).toMatchObject({
				enum: ['active'],
			});
		});

		it('should transform TypeBox Union with Literals', () => {
			const schema = Type.Union([
				Type.Literal('active'),
				Type.Literal('inactive'),
				Type.Literal('pending'),
			]);

			const result = transformSchemaForGoogle(schema);

			expect(result).toMatchObject({
				enum: ['active', 'inactive', 'pending'],
			});
		});

		it('should transform TypeBox Object with Literal properties', () => {
			const schema = Type.Object({
				status: Type.Literal('active'),
				type: Type.Literal('user'),
				name: Type.String(),
			});

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.status).toMatchObject({ enum: ['active'] });
			expect(result.properties.type).toMatchObject({ enum: ['user'] });
			expect(result.properties.name.type).toBe('string');
		});
	});

	describe('Edge cases', () => {
		it('should handle null input', () => {
			const result = transformSchemaForGoogle(null);
			expect(result).toBeNull();
		});

		it('should handle undefined input', () => {
			const result = transformSchemaForGoogle(undefined);
			expect(result).toBeUndefined();
		});

		it('should handle primitive values', () => {
			expect(transformSchemaForGoogle('string')).toBe('string');
			expect(transformSchemaForGoogle(42)).toBe(42);
			expect(transformSchemaForGoogle(true)).toBe(true);
		});

		it('should handle empty object', () => {
			const result = transformSchemaForGoogle({});
			expect(result).toEqual({});
		});

		it('should handle empty array', () => {
			const result = transformSchemaForGoogle([]);
			expect(result).toEqual([]);
		});

		it('should handle schema without const or anyOf', () => {
			const schema = {
				type: 'string',
				minLength: 1,
				maxLength: 100,
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual(schema);
		});

		it('should handle anyOf with empty array', () => {
			const schema = {
				anyOf: [],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toMatchObject({ anyOf: [] });
		});

		it('should handle const with null value', () => {
			const schema = {
				const: null,
			};

			const result = transformSchemaForGoogle(schema);

			expect(result).toEqual({
				enum: [null],
			});
		});
	});

	describe('Real-world tool schemas', () => {
		it('should transform calculator tool schema', () => {
			const schema = {
				type: 'object',
				properties: {
					expression: {
						type: 'string',
						description: 'Mathematical expression to evaluate',
					},
					format: {
						anyOf: [
							{ const: 'decimal' },
							{ const: 'fraction' },
							{ const: 'scientific' },
						],
						description: 'Output format',
					},
				},
				required: ['expression'],
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.expression.type).toBe('string');
			expect(result.properties.format).toEqual({
				enum: ['decimal', 'fraction', 'scientific'],
				description: 'Output format',
			});
			expect(result.required).toEqual(['expression']);
		});

		it('should transform search tool schema with filters', () => {
			const schema = {
				type: 'object',
				properties: {
					query: {
						type: 'string',
					},
					filters: {
						type: 'object',
						properties: {
							category: {
								anyOf: [
									{ const: 'tech' },
									{ const: 'science' },
									{ const: 'art' },
								],
							},
							sort: {
								const: 'relevance',
							},
						},
					},
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.filters.properties.category).toEqual({
				enum: ['tech', 'science', 'art'],
			});
			expect(result.properties.filters.properties.sort).toEqual({
				enum: ['relevance'],
			});
		});

		it('should transform complex nested tool schema', () => {
			const schema = {
				type: 'object',
				properties: {
					action: {
						anyOf: [
							{ const: 'create' },
							{ const: 'update' },
							{ const: 'delete' },
						],
					},
					data: {
						type: 'object',
						properties: {
							items: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										status: {
											const: 'pending',
										},
									},
								},
							},
						},
					},
				},
			};

			const result = transformSchemaForGoogle(schema);

			expect(result.properties.action).toEqual({
				enum: ['create', 'update', 'delete'],
			});
			expect(result.properties.data.properties.items.items.properties.status).toEqual({
				enum: ['pending'],
			});
		});
	});

	describe('Array schema handling', () => {
		it('should transform array of schemas', () => {
			const schemas = [
				{ const: 'a' },
				{ const: 'b' },
				{ type: 'string' },
			];

			const result = transformSchemaForGoogle(schemas);

			expect(result[0]).toEqual({ enum: ['a'] });
			expect(result[1]).toEqual({ enum: ['b'] });
			expect(result[2]).toEqual({ type: 'string' });
		});
	});
});
