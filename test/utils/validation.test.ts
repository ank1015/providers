import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { validateToolArguments } from '../../src/utils/validation';
import { Tool } from '../../src/types';

describe('validateToolArguments', () => {
	describe('Valid arguments', () => {
		it('should pass validation for valid arguments', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					name: Type.String(),
					age: Type.Number(),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { name: 'John', age: 30 },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ name: 'John', age: 30 });
		});

		it('should pass validation for nested objects', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					user: Type.Object({
						name: Type.String(),
						email: Type.String(),
					}),
					count: Type.Number(),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {
					user: { name: 'John', email: 'john@example.com' },
					count: 5,
				},
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({
				user: { name: 'John', email: 'john@example.com' },
				count: 5,
			});
		});

		it('should pass validation for arrays', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					items: Type.Array(Type.String()),
					numbers: Type.Array(Type.Number()),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {
					items: ['a', 'b', 'c'],
					numbers: [1, 2, 3],
				},
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({
				items: ['a', 'b', 'c'],
				numbers: [1, 2, 3],
			});
		});

		it('should pass validation for optional fields', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					required: Type.String(),
					optional: Type.Optional(Type.String()),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { required: 'value' },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ required: 'value' });
		});

		it('should pass validation with optional fields present', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					required: Type.String(),
					optional: Type.Optional(Type.String()),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { required: 'value', optional: 'optional-value' },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ required: 'value', optional: 'optional-value' });
		});
	});

	describe('Invalid arguments', () => {
		it('should throw error for missing required field', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					name: Type.String(),
					age: Type.Number(),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { name: 'John' }, // missing age
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw error for type mismatch (string vs number)', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					age: Type.Number(),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { age: 'thirty' }, // should be number
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw error for extra fields when additionalProperties is false', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object(
					{
						name: Type.String(),
					},
					{ additionalProperties: false }
				),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { name: 'John', extra: 'field' },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw error for invalid nested object', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					user: Type.Object({
						name: Type.String(),
						age: Type.Number(),
					}),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {
					user: { name: 'John' }, // missing age
				},
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw error for invalid array items', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					numbers: Type.Array(Type.Number()),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {
					numbers: [1, 2, 'three'], // should be all numbers
				},
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});
	});

	describe('Enum validation', () => {
		it('should pass validation for valid enum value', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					status: Type.Union([
						Type.Literal('active'),
						Type.Literal('inactive'),
						Type.Literal('pending'),
					]),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { status: 'active' },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ status: 'active' });
		});

		it('should throw error for invalid enum value', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					status: Type.Union([
						Type.Literal('active'),
						Type.Literal('inactive'),
						Type.Literal('pending'),
					]),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { status: 'invalid' },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});
	});

	describe('Number constraints', () => {
		it('should pass validation for number within range', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					age: Type.Number({ minimum: 0, maximum: 120 }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { age: 30 },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ age: 30 });
		});

		it('should throw error for number below minimum', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					age: Type.Number({ minimum: 0 }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { age: -5 },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw error for number above maximum', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					age: Type.Number({ maximum: 120 }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { age: 150 },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});
	});

	describe('String constraints', () => {
		it('should pass validation for string within length constraints', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					name: Type.String({ minLength: 2, maxLength: 50 }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { name: 'John' },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ name: 'John' });
		});

		it('should throw error for string below minLength', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					name: Type.String({ minLength: 5 }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { name: 'Joe' },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw error for string above maxLength', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					name: Type.String({ maxLength: 5 }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { name: 'Jonathan' },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should pass validation for string matching pattern', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					email: Type.String({ pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { email: 'john@example.com' },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ email: 'john@example.com' });
		});

		it('should throw error for string not matching pattern', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					email: Type.String({ pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' }),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { email: 'invalid-email' },
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});
	});

	describe('Complex schemas', () => {
		it('should validate complex nested schema', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					user: Type.Object({
						name: Type.String(),
						age: Type.Number({ minimum: 0 }),
						addresses: Type.Array(
							Type.Object({
								street: Type.String(),
								city: Type.String(),
								zipCode: Type.String({ pattern: '^[0-9]{5}$' }),
							})
						),
					}),
					metadata: Type.Optional(
						Type.Object({
							tags: Type.Array(Type.String()),
							priority: Type.Number({ minimum: 1, maximum: 5 }),
						})
					),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {
					user: {
						name: 'John',
						age: 30,
						addresses: [
							{ street: '123 Main St', city: 'New York', zipCode: '10001' },
							{ street: '456 Oak Ave', city: 'Boston', zipCode: '02101' },
						],
					},
					metadata: {
						tags: ['important', 'urgent'],
						priority: 3,
					},
				},
			};

			const result = validateToolArguments(tool, toolCall);
			expect((result as any).user.name).toBe('John');
			expect((result as any).user.addresses).toHaveLength(2);
			expect((result as any).metadata?.priority).toBe(3);
		});

		it('should throw error for invalid deeply nested field', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					user: Type.Object({
						addresses: Type.Array(
							Type.Object({
								zipCode: Type.String({ pattern: '^[0-9]{5}$' }),
							})
						),
					}),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {
					user: {
						addresses: [{ zipCode: 'invalid' }], // should be 5 digits
					},
				},
			};

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});
	});

	describe('Error message formatting', () => {
		it('should provide readable error message', () => {
			const tool: Tool = {
				name: 'calculator',
				description: 'Calculate something',
				parameters: Type.Object({
					expression: Type.String(),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'calculator',
				arguments: { expression: 123 }, // should be string
			};

			try {
				validateToolArguments(tool, toolCall);
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toContain('calculator');
			}
		});
	});

	describe('Edge cases', () => {
		it('should handle empty object schema', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: {},
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({});
		});

		it('should handle boolean fields', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					enabled: Type.Boolean(),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { enabled: true },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ enabled: true });
		});

		it('should handle null values when allowed', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
				parameters: Type.Object({
					value: Type.Union([Type.String(), Type.Null()]),
				}),
			};

			const toolCall = {
				type: 'toolCall' as const,
				name: 'test',
				arguments: { value: null },
			};

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ value: null });
		});

		it('should handle multiple levels of nested optional fields', () => {
			const tool: Tool = {
				name: 'test',
				description: 'Test tool',
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

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({});
		});
	});
});
