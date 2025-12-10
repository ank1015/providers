import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Type } from '@sinclair/typebox';
import { agentLoop } from '../../src/agent/agent-loop';
import { AgentContext, AgentLoopConfig, AgentTool, AgentEvent } from '../../src/agent/types';
import { UserMessage, AssistantMessage, NativeOpenAIMessage, Model } from '../../src/types';
import * as streamModule from '../../src/stream';

// Mock the stream module
vi.mock('../../src/stream');

// Clear mocks before each test
beforeEach(() => {
	vi.clearAllMocks();
});

const mockModel: Model<'openai'> = {
	id: 'test-model',
	name: 'Test Model',
	api: 'openai',
	baseUrl: 'https://api.openai.com',
	reasoning: false,
	input: ['text'],
	cost: { input: 0.01, output: 0.03, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 4096,
};

// Helper to create mock stream
function createMockStream(events: any[], result: any) {
	const eventStream = {
		async *[Symbol.asyncIterator]() {
			for (const event of events) {
				yield event;
			}
		},
		result: async () => result,
	};
	return eventStream as any;
}

// Helper to create mock assistant message
function createMockAssistantMessage(
	content: AssistantMessage['content'],
	stopReason: AssistantMessage['stopReason'] = 'stop'
): AssistantMessage {
	return {
		role: 'assistant',
		content,
		api: 'openai',
		model: 'test-model',
		usage: {
			input: 10,
			output: 5,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 15,
			cost: {
				input: 0.0001,
				output: 0.00015,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0.00025,
			},
		},
		stopReason,
		timestamp: Date.now(),
	};
}

// Helper to create native message
function createNativeMessage(assistantMessage: AssistantMessage): NativeOpenAIMessage {
	return {
		role: 'assistant',
		_provider: 'openai',
		message: {
			output: [],
			id: 'resp_123',
			object: "response",
			created_at: 1740855869,
			output_text: '',
			status: "completed",
			incomplete_details: null,
			parallel_tool_calls: false,
			error: null,
			instructions: null,
			max_output_tokens: null,
			model: "gpt-4o-mini-2024-07-18",
			user: undefined,
			metadata: {},
			previous_response_id: null,
			temperature: 1,
			text: {},
			tool_choice: "auto",
			tools: [],
			top_p: 1,
			truncation: "disabled",
			usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: {cached_tokens: 0}, output_tokens_details: {reasoning_tokens: 0} },
		},
	};
}

describe('agentLoop - Basic Flow', () => {
	it('should handle single turn without tool calls', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello!' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Hello! How can I help you?' },
		]);

		const nativeMessage = createNativeMessage(assistantMessage);

		const mockStream = createMockStream(
			[
				{ type: 'start', partial: assistantMessage },
				{ type: 'text_start', contentIndex: 0, partial: assistantMessage },
				{ type: 'text_delta', contentIndex: 0, delta: 'Hello!', partial: assistantMessage },
				{ type: 'text_end', contentIndex: 0, content: 'Hello! How can I help you?', partial: assistantMessage },
				{ type: 'done', reason: 'stop', message: assistantMessage },
			],
			nativeMessage
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const messages = await eventStream.result();

		// Verify events
		expect(events).toContainEqual({ type: 'agent_start' });
		expect(events).toContainEqual({ type: 'turn_start' });
		expect(events).toContainEqual(expect.objectContaining({ type: 'message_start' }));
		expect(events).toContainEqual(expect.objectContaining({ type: 'message_end' }));
		expect(events).toContainEqual(expect.objectContaining({ type: 'turn_end' }));
		expect(events).toContainEqual(expect.objectContaining({ type: 'agent_end', status: 'completed' }));

		// Verify messages
		expect(messages).toHaveLength(2); // prompt + assistant response
		expect(messages[0]).toEqual(prompt);
		expect(messages[1]).toEqual(nativeMessage);
	});

	it('should add initial prompt to messages', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Test prompt' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Response' },
		]);

		const mockStream = createMockStream(
			[
				{ type: 'start', partial: assistantMessage },
				{ type: 'done', reason: 'stop', message: assistantMessage },
			],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const messages = await eventStream.result();

		expect(messages[0]).toEqual(prompt);
	});

	it('should emit agent start and end events', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Hi!' },
		]);

		const mockStream = createMockStream(
			[
				{ type: 'start', partial: assistantMessage },
				{ type: 'done', reason: 'stop', message: assistantMessage },
			],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		expect(events[0]).toEqual({ type: 'agent_start' });
		expect(events[events.length - 1]).toMatchObject({
			type: 'agent_end',
			status: 'completed',
		});
	});

	it('should emit turn start and end events', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Hi!' },
		]);

		const mockStream = createMockStream(
			[
				{ type: 'start', partial: assistantMessage },
				{ type: 'done', reason: 'stop', message: assistantMessage },
			],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const turnStarts = events.filter(e => e.type === 'turn_start');
		const turnEnds = events.filter(e => e.type === 'turn_end');

		expect(turnStarts).toHaveLength(1);
		expect(turnEnds).toHaveLength(1);
	});

	it('should preserve message order', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Response' },
		]);

		const mockStream = createMockStream(
			[
				{ type: 'start', partial: assistantMessage },
				{ type: 'done', reason: 'stop', message: assistantMessage },
			],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const messages = await eventStream.result();

		expect(messages[0].role).toBe('user');
		expect(messages[1].role).toBe('assistant');
	});
});

describe('agentLoop - Tool Execution', () => {
	it('should execute single tool call', async () => {
		const calculatorTool: AgentTool = {
			name: 'calculator',
			description: 'Perform calculations',
			label: 'Calculator',
			parameters: Type.Object({
				expression: Type.String(),
			}),
			async execute(toolCallId, params) {
				return {
					content: [{ type: 'text', content: `Result: ${eval((params as any).expression)}` }],
					details: { result: eval((params as any).expression) },
				};
			},
		};

		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Calculate 2 + 2' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [calculatorTool],
		};

		// First turn - assistant calls tool
		const assistantMessage1 = createMockAssistantMessage(
			[
				{
					type: 'toolCall',
					name: 'calculator',
					arguments: { expression: '2 + 2' },
					id: 'call_123',
				},
			],
			'toolUse'
		);

		// Second turn - assistant responds with result
		const assistantMessage2 = createMockAssistantMessage([
			{ type: 'text', text: 'The result is 4' },
		]);

		let callCount = 0;
		vi.spyOn(streamModule, 'stream').mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return createMockStream(
					[
						{ type: 'start', partial: assistantMessage1 },
						{ type: 'done', reason: 'toolUse', message: assistantMessage1 },
					],
					createNativeMessage(assistantMessage1)
				);
			} else {
				return createMockStream(
					[
						{ type: 'start', partial: assistantMessage2 },
						{ type: 'done', reason: 'stop', message: assistantMessage2 },
					],
					createNativeMessage(assistantMessage2)
				);
			}
		});

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const toolExecutionStarts = events.filter(e => e.type === 'tool_execution_start');
		const toolExecutionEnds = events.filter(e => e.type === 'tool_execution_end');

		expect(toolExecutionStarts).toHaveLength(1);
		expect(toolExecutionEnds).toHaveLength(1);
		expect(toolExecutionStarts[0]).toMatchObject({
			type: 'tool_execution_start',
			toolName: 'calculator',
			toolCallId: 'call_123',
		});
	});

	it('should add tool result to context', async () => {
		const tool: AgentTool = {
			name: 'test_tool',
			description: 'Test tool',
			label: 'Test',
			parameters: Type.Object({}),
			async execute() {
				return {
					content: [{ type: 'text', content: 'Tool result' }],
					details: {},
				};
			},
		};

		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Use the tool' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [tool],
		};

		const assistantMessage1 = createMockAssistantMessage(
			[{ type: 'toolCall', name: 'test_tool', arguments: {}, id: 'call_1' }],
			'toolUse'
		);

		const assistantMessage2 = createMockAssistantMessage([
			{ type: 'text', text: 'Done' },
		]);

		let callCount = 0;
		vi.spyOn(streamModule, 'stream').mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return createMockStream(
					[{ type: 'done', reason: 'toolUse', message: assistantMessage1 }],
					createNativeMessage(assistantMessage1)
				);
			} else {
				return createMockStream(
					[{ type: 'done', reason: 'stop', message: assistantMessage2 }],
					createNativeMessage(assistantMessage2)
				);
			}
		});

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const messages = await eventStream.result();

		// Should have: prompt, assistant1, tool result, assistant2
		expect(messages).toHaveLength(4);
		expect(messages[2].role).toBe('toolResult');
		expect((messages[2] as any).toolName).toBe('test_tool');
	});

	it('should handle tool not found error', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Use unknown tool' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [], // No tools defined
		};

		const assistantMessage1 = createMockAssistantMessage(
			[{ type: 'toolCall', name: 'unknown_tool', arguments: {}, id: 'call_1' }],
			'toolUse'
		);

		const assistantMessage2 = createMockAssistantMessage([
			{ type: 'text', text: 'Error handled' },
		]);

		let callCount = 0;
		vi.spyOn(streamModule, 'stream').mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return createMockStream(
					[{ type: 'done', reason: 'toolUse', message: assistantMessage1 }],
					createNativeMessage(assistantMessage1)
				);
			} else {
				return createMockStream(
					[{ type: 'done', reason: 'stop', message: assistantMessage2 }],
					createNativeMessage(assistantMessage2)
				);
			}
		});

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const toolExecutionEnd = events.find(e => e.type === 'tool_execution_end') as any;
		expect(toolExecutionEnd.isError).toBe(true);
		expect(toolExecutionEnd.result).toContain('not found');
	});

	it('should handle tool execution error', async () => {
		const failingTool: AgentTool = {
			name: 'failing_tool',
			description: 'A tool that fails',
			label: 'Failing',
			parameters: Type.Object({}),
			async execute() {
				throw new Error('Tool execution failed');
			},
		};

		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Use failing tool' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [failingTool],
		};

		const assistantMessage1 = createMockAssistantMessage(
			[{ type: 'toolCall', name: 'failing_tool', arguments: {}, id: 'call_1' }],
			'toolUse'
		);

		const assistantMessage2 = createMockAssistantMessage([
			{ type: 'text', text: 'Error handled' },
		]);

		let callCount = 0;
		vi.spyOn(streamModule, 'stream').mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return createMockStream(
					[{ type: 'done', reason: 'toolUse', message: assistantMessage1 }],
					createNativeMessage(assistantMessage1)
				);
			} else {
				return createMockStream(
					[{ type: 'done', reason: 'stop', message: assistantMessage2 }],
					createNativeMessage(assistantMessage2)
				);
			}
		});

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const toolExecutionEnd = events.find(e => e.type === 'tool_execution_end') as any;
		expect(toolExecutionEnd.isError).toBe(true);
		expect(toolExecutionEnd.result).toBe('Tool execution failed');
	});

	it('should create tool result with error details', async () => {
		const failingTool: AgentTool = {
			name: 'error_tool',
			description: 'Tool with error',
			label: 'Error',
			parameters: Type.Object({}),
			async execute() {
				const error = new Error('Custom error');
				error.name = 'CustomError';
				throw error;
			},
		};

		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Test' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [failingTool],
		};

		const assistantMessage1 = createMockAssistantMessage(
			[{ type: 'toolCall', name: 'error_tool', arguments: {}, id: 'call_1' }],
			'toolUse'
		);

		const assistantMessage2 = createMockAssistantMessage([
			{ type: 'text', text: 'Done' },
		]);

		let callCount = 0;
		vi.spyOn(streamModule, 'stream').mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return createMockStream(
					[{ type: 'done', reason: 'toolUse', message: assistantMessage1 }],
					createNativeMessage(assistantMessage1)
				);
			} else {
				return createMockStream(
					[{ type: 'done', reason: 'stop', message: assistantMessage2 }],
					createNativeMessage(assistantMessage2)
				);
			}
		});

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const messages = await eventStream.result();

		const toolResult = messages.find(m => m.role === 'toolResult') as any;
		expect(toolResult.isError).toBe(true);
		expect(toolResult.error).toMatchObject({
			message: 'Custom error',
			name: 'CustomError',
		});
		expect(toolResult.error.stack).toBeDefined();
	});
});

describe('agentLoop - Multi-turn Conversation', () => {
	it('should handle multiple tool-using turns', async () => {
		const tool: AgentTool = {
			name: 'count',
			description: 'Count',
			label: 'Count',
			parameters: Type.Object({}),
			async execute() {
				return {
					content: [{ type: 'text', content: 'counted' }],
					details: {},
				};
			},
		};

		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Count twice' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [tool],
		};

		const messages = [
			createMockAssistantMessage(
				[{ type: 'toolCall', name: 'count', arguments: {}, id: 'call_1' }],
				'toolUse'
			),
			createMockAssistantMessage(
				[{ type: 'toolCall', name: 'count', arguments: {}, id: 'call_2' }],
				'toolUse'
			),
			createMockAssistantMessage([{ type: 'text', text: 'Done counting twice' }]),
		];

		let callCount = 0;
		vi.spyOn(streamModule, 'stream').mockImplementation(() => {
			const msg = messages[callCount];
			callCount++;
			return createMockStream(
				[{ type: 'done', reason: msg.stopReason, message: msg }],
				createNativeMessage(msg)
			);
		});

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const result = await eventStream.result();

		// prompt + assistant1 + tool1 + assistant2 + tool2 + assistant3 = 6
		expect(result).toHaveLength(6);
		expect(streamModule.stream).toHaveBeenCalledTimes(3);
	});

	it('should accumulate context across turns', async () => {
		const tool: AgentTool = {
			name: 'test',
			description: 'Test',
			label: 'Test',
			parameters: Type.Object({}),
			async execute() {
				return {
					content: [{ type: 'text', content: 'result' }],
					details: {},
				};
			},
		};

		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Test' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
			tools: [tool],
		};

		const assistantMessage1 = createMockAssistantMessage(
			[{ type: 'toolCall', name: 'test', arguments: {}, id: 'call_1' }],
			'toolUse'
		);

		const assistantMessage2 = createMockAssistantMessage([
			{ type: 'text', text: 'Final response' },
		]);

		const streamSpy = vi.spyOn(streamModule, 'stream');

		// Use mockReturnValueOnce for sequential calls
		streamSpy
			.mockReturnValueOnce(
				createMockStream(
					[{ type: 'done', reason: 'toolUse', message: assistantMessage1 }],
					createNativeMessage(assistantMessage1)
				)
			)
			.mockReturnValueOnce(
				createMockStream(
					[{ type: 'done', reason: 'stop', message: assistantMessage2 }],
					createNativeMessage(assistantMessage2)
				)
			);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		await eventStream.result();

		// Verify the stream was called twice
		expect(streamSpy).toHaveBeenCalledTimes(2);

		// Verify first call had prompt only
		expect(streamSpy.mock.calls[0][1].messages).toHaveLength(1);

		// Verify second call had prompt + assistant1 + tool result
		expect(streamSpy.mock.calls[1][1].messages).toHaveLength(3);
	});
});

describe('agentLoop - Error Handling', () => {
	it('should handle abort signal during streaming', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Test' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([], 'aborted');

		const mockStream = createMockStream(
			[{ type: 'error', reason: 'aborted', error: assistantMessage }],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const abortController = new AbortController();
		const eventStream = agentLoop(prompt, context, config, abortController.signal);

		const events: AgentEvent[] = [];
		for await (const event of eventStream) {
			events.push(event);
		}

		expect(events).toContainEqual(
			expect.objectContaining({ type: 'agent_end', status: 'aborted' })
		);
	});

	it('should handle error stop reason', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Test' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([], 'error');
		assistantMessage.errorMessage = 'API Error';

		const mockStream = createMockStream(
			[{ type: 'error', reason: 'error', error: assistantMessage }],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		expect(events).toContainEqual(
			expect.objectContaining({ type: 'agent_end', status: 'error' })
		);
	});
});

describe('agentLoop - Message Events', () => {
	it('should emit message_start and message_end for prompt', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Hi' },
		]);

		const mockStream = createMockStream(
			[{ type: 'done', reason: 'stop', message: assistantMessage }],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const messageStarts = events.filter(e => e.type === 'message_start');
		const messageEnds = events.filter(e => e.type === 'message_end');

		expect(messageStarts.length).toBeGreaterThan(0);
		expect(messageEnds.length).toBeGreaterThan(0);
	});

	it('should emit message_update events during streaming', async () => {
		const prompt: UserMessage = {
			role: 'user',
			content: [{ type: 'text', content: 'Hello' }],
			timestamp: Date.now(),
		};

		const context: AgentContext = {
			messages: [],
		};

		const assistantMessage = createMockAssistantMessage([
			{ type: 'text', text: 'Response' },
		]);

		const mockStream = createMockStream(
			[
				{ type: 'start', partial: assistantMessage },
				{ type: 'text_start', contentIndex: 0, partial: assistantMessage },
				{ type: 'text_delta', contentIndex: 0, delta: 'R', partial: assistantMessage },
				{ type: 'text_delta', contentIndex: 0, delta: 'e', partial: assistantMessage },
				{ type: 'done', reason: 'stop', message: assistantMessage },
			],
			createNativeMessage(assistantMessage)
		);

		vi.spyOn(streamModule, 'stream').mockReturnValue(mockStream);

		const config: AgentLoopConfig<'openai'> = {
			model: mockModel,
			providerOptions: {},
		};

		const eventStream = agentLoop(prompt, context, config);
		const events: AgentEvent[] = [];

		for await (const event of eventStream) {
			events.push(event);
		}

		const messageUpdates = events.filter(e => e.type === 'message_update');
		expect(messageUpdates.length).toBeGreaterThan(0);
	});
});
