import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { validateToolArguments, validateToolCall } from '../../../src/utils/validation.js';
import type { Tool, AssistantToolCall } from '../../../src/types.js';

// Helper to create a tool definition
function createTool<T>(name: string, parameters: T): Tool {
	return {
		name,
		description: `Test tool: ${name}`,
		parameters: parameters as any,
	};
}

// Helper to create a tool call
function createToolCall(name: string, args: Record<string, any>): AssistantToolCall {
	return {
		type: 'toolCall',
		name,
		arguments: args,
		toolCallId: `call_${Date.now()}`,
	};
}

describe('validateToolArguments', () => {
	describe('valid arguments', () => {
		it('should pass through valid string argument', () => {
			const tool = createTool('greet', Type.Object({
				name: Type.String(),
			}));
			const toolCall = createToolCall('greet', { name: 'Alice' });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ name: 'Alice' });
		});

		it('should pass through valid number argument', () => {
			const tool = createTool('calculate', Type.Object({
				value: Type.Number(),
			}));
			const toolCall = createToolCall('calculate', { value: 42 });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ value: 42 });
		});

		it('should pass through valid boolean argument', () => {
			const tool = createTool('toggle', Type.Object({
				enabled: Type.Boolean(),
			}));
			const toolCall = createToolCall('toggle', { enabled: true });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ enabled: true });
		});

		it('should pass through valid array argument', () => {
			const tool = createTool('sum', Type.Object({
				numbers: Type.Array(Type.Number()),
			}));
			const toolCall = createToolCall('sum', { numbers: [1, 2, 3] });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ numbers: [1, 2, 3] });
		});

		it('should pass through valid nested object', () => {
			const tool = createTool('createUser', Type.Object({
				user: Type.Object({
					name: Type.String(),
					age: Type.Number(),
				}),
			}));
			const toolCall = createToolCall('createUser', {
				user: { name: 'Bob', age: 30 },
			});

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ user: { name: 'Bob', age: 30 } });
		});

		it('should pass through valid optional argument when provided', () => {
			const tool = createTool('greet', Type.Object({
				name: Type.String(),
				greeting: Type.Optional(Type.String()),
			}));
			const toolCall = createToolCall('greet', { name: 'Alice', greeting: 'Hello' });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ name: 'Alice', greeting: 'Hello' });
		});

		it('should pass through valid arguments when optional is missing', () => {
			const tool = createTool('greet', Type.Object({
				name: Type.String(),
				greeting: Type.Optional(Type.String()),
			}));
			const toolCall = createToolCall('greet', { name: 'Alice' });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ name: 'Alice' });
		});

		it('should pass through valid enum value', () => {
			const tool = createTool('setStatus', Type.Object({
				status: Type.Union([
					Type.Literal('active'),
					Type.Literal('inactive'),
					Type.Literal('pending'),
				]),
			}));
			const toolCall = createToolCall('setStatus', { status: 'active' });

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({ status: 'active' });
		});

		it('should pass through empty object when no properties required', () => {
			const tool = createTool('ping', Type.Object({}));
			const toolCall = createToolCall('ping', {});

			const result = validateToolArguments(tool, toolCall);
			expect(result).toEqual({});
		});
	});

	describe('invalid arguments', () => {
		it('should throw on missing required field', () => {
			const tool = createTool('greet', Type.Object({
				name: Type.String(),
			}));
			const toolCall = createToolCall('greet', {});

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw on wrong type (string instead of number)', () => {
			const tool = createTool('calculate', Type.Object({
				value: Type.Number(),
			}));
			const toolCall = createToolCall('calculate', { value: 'not a number' });

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw on wrong type (number instead of string)', () => {
			const tool = createTool('greet', Type.Object({
				name: Type.String(),
			}));
			const toolCall = createToolCall('greet', { name: 123 });

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw on wrong type (string instead of boolean)', () => {
			const tool = createTool('toggle', Type.Object({
				enabled: Type.Boolean(),
			}));
			const toolCall = createToolCall('toggle', { enabled: 'true' });

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw on invalid array item type', () => {
			const tool = createTool('sum', Type.Object({
				numbers: Type.Array(Type.Number()),
			}));
			const toolCall = createToolCall('sum', { numbers: [1, 'two', 3] });

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw on invalid nested object', () => {
			const tool = createTool('createUser', Type.Object({
				user: Type.Object({
					name: Type.String(),
					age: Type.Number(),
				}),
			}));
			const toolCall = createToolCall('createUser', {
				user: { name: 'Bob', age: 'thirty' },
			});

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should throw on invalid enum value', () => {
			const tool = createTool('setStatus', Type.Object({
				status: Type.Union([
					Type.Literal('active'),
					Type.Literal('inactive'),
				]),
			}));
			const toolCall = createToolCall('setStatus', { status: 'unknown' });

			expect(() => validateToolArguments(tool, toolCall)).toThrow();
		});

		it('should include tool name in error message', () => {
			const tool = createTool('myTool', Type.Object({
				required: Type.String(),
			}));
			const toolCall = createToolCall('myTool', {});

			expect(() => validateToolArguments(tool, toolCall)).toThrow(/myTool/);
		});

		it('should include received arguments in error message', () => {
			const tool = createTool('myTool', Type.Object({
				value: Type.Number(),
			}));
			const toolCall = createToolCall('myTool', { value: 'wrong' });

			expect(() => validateToolArguments(tool, toolCall)).toThrow(/wrong/);
		});
	});

	describe('complex schemas', () => {
		it('should validate deeply nested structures', () => {
			const tool = createTool('complex', Type.Object({
				level1: Type.Object({
					level2: Type.Object({
						level3: Type.Object({
							value: Type.String(),
						}),
					}),
				}),
			}));
			const validCall = createToolCall('complex', {
				level1: { level2: { level3: { value: 'deep' } } },
			});
			const invalidCall = createToolCall('complex', {
				level1: { level2: { level3: { value: 123 } } },
			});

			expect(validateToolArguments(tool, validCall)).toEqual({
				level1: { level2: { level3: { value: 'deep' } } },
			});
			expect(() => validateToolArguments(tool, invalidCall)).toThrow();
		});

		it('should validate array of objects', () => {
			const tool = createTool('createUsers', Type.Object({
				users: Type.Array(Type.Object({
					name: Type.String(),
					email: Type.String(),
				})),
			}));
			const validCall = createToolCall('createUsers', {
				users: [
					{ name: 'Alice', email: 'alice@example.com' },
					{ name: 'Bob', email: 'bob@example.com' },
				],
			});

			expect(validateToolArguments(tool, validCall)).toEqual({
				users: [
					{ name: 'Alice', email: 'alice@example.com' },
					{ name: 'Bob', email: 'bob@example.com' },
				],
			});
		});

		it('should validate with minLength constraint', () => {
			const tool = createTool('search', Type.Object({
				query: Type.String({ minLength: 3 }),
			}));
			const validCall = createToolCall('search', { query: 'test' });
			const invalidCall = createToolCall('search', { query: 'ab' });

			expect(validateToolArguments(tool, validCall)).toEqual({ query: 'test' });
			expect(() => validateToolArguments(tool, invalidCall)).toThrow();
		});

		it('should validate with minimum/maximum constraints', () => {
			const tool = createTool('setAge', Type.Object({
				age: Type.Number({ minimum: 0, maximum: 150 }),
			}));
			const validCall = createToolCall('setAge', { age: 25 });
			const tooLow = createToolCall('setAge', { age: -1 });
			const tooHigh = createToolCall('setAge', { age: 200 });

			expect(validateToolArguments(tool, validCall)).toEqual({ age: 25 });
			expect(() => validateToolArguments(tool, tooLow)).toThrow();
			expect(() => validateToolArguments(tool, tooHigh)).toThrow();
		});
	});
});

describe('validateToolCall', () => {
	const tools: Tool[] = [
		createTool('greet', Type.Object({ name: Type.String() })),
		createTool('calculate', Type.Object({ a: Type.Number(), b: Type.Number() })),
	];

	it('should find tool by name and validate', () => {
		const toolCall = createToolCall('greet', { name: 'Alice' });
		const result = validateToolCall(tools, toolCall);
		expect(result).toEqual({ name: 'Alice' });
	});

	it('should throw if tool not found', () => {
		const toolCall = createToolCall('unknown', { some: 'args' });
		expect(() => validateToolCall(tools, toolCall)).toThrow(/Tool "unknown" not found/);
	});

	it('should validate arguments for found tool', () => {
		const toolCall = createToolCall('calculate', { a: 1, b: 2 });
		const result = validateToolCall(tools, toolCall);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should throw on invalid arguments for found tool', () => {
		const toolCall = createToolCall('calculate', { a: 'one', b: 2 });
		expect(() => validateToolCall(tools, toolCall)).toThrow();
	});
});
