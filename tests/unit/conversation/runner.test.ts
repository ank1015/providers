import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultAgentRunner, AgentRunnerCallbacks } from '../../../src/agent/runner.js';
import { LLMClient } from '../../../src/llm.js';
import { AgentLoopConfig } from '../../../src/agent/types.js';
import { Message, AssistantResponse } from '../../../src/types.js';
import { generateUUID } from '../../../src/utils/uuid.js';

// Mock LLM Client
class MockLLMClient implements LLMClient {
    complete = vi.fn();
    stream = vi.fn();
}

describe('DefaultAgentRunner Limits', () => {
    let runner: DefaultAgentRunner;
    let mockClient: MockLLMClient;
    let callbacks: AgentRunnerCallbacks;
    let emit: any;

    const mockProvider = {
        model: { api: 'openai', id: 'gpt-4', tools: [] } as any,
        providerOptions: {}
    };

    beforeEach(() => {
        mockClient = new MockLLMClient();
        runner = new DefaultAgentRunner(mockClient, { streamAssistantMessage: false });
        callbacks = {
            appendMessage: vi.fn(),
            appendMessages: vi.fn(),
            addPendingToolCall: vi.fn(),
            removePendingToolCall: vi.fn()
        };
        emit = vi.fn();
    });

    const createConfig = (budget?: AgentLoopConfig['budget']): AgentLoopConfig => ({
        systemPrompt: 'sys',
        tools: [],
        provider: mockProvider,
        budget,
        getQueuedMessages: async () => []
    });

    const createAssistantMessage = (cost: number, inputTokens: number, toolCalls: boolean = false) => ({
        role: 'assistant',
        id: generateUUID(),
        content: toolCalls 
            ? [{ type: 'toolCall', name: 'tool1', arguments: {}, toolCallId: '1' }] as any 
            : [{ type: 'response', content: [{ type: 'text', content: 'hello' }] }] as any,
        stopReason: 'stop',
        usage: {
            cost: { total: cost },
            input: inputTokens
        }
    } as any);

    it('should throw if cost limit exceeded AND has more actions (tool calls)', async () => {
        const config = createConfig({
            costLimit: 1.0,
            currentCost: 0.8
        });

        // First call returns message that tips over budget (0.8 + 0.3 = 1.1) AND calls a tool
        mockClient.complete.mockResolvedValueOnce(createAssistantMessage(0.3, 100, true));

        // Setup tool execution to fail or just verify runner stops before executing tools?
        // The check happens AFTER callAssistant.
        
        // We need to provide a tool definition so it doesn't fail on "Tool not found" before the limit check? 
        // Actually limit check is before tool execution loop.
        
        await expect(runner.run(config, [], emit, new AbortController().signal, callbacks))
            .rejects.toThrow('Cost limit exceeded');
            
        expect(mockClient.complete).toHaveBeenCalledTimes(1);
    });

    it('should NOT throw if cost limit exceeded but NO more actions (final response)', async () => {
        const config = createConfig({
            costLimit: 1.0,
            currentCost: 0.8
        });

        // Returns message that tips over budget (1.1) but NO tools
        mockClient.complete.mockResolvedValueOnce(createAssistantMessage(0.3, 100, false));

        const msgs = await runner.run(config, [], emit, new AbortController().signal, callbacks);
        
        expect(msgs.length).toBe(1);
        expect(mockClient.complete).toHaveBeenCalledTimes(1);
        // Should complete successfully
    });

    it('should throw if context limit exceeded AND has more actions', async () => {
        const config = createConfig({
            contextLimit: 1000,
            currentCost: 0
        });

        // Message input tokens 1200 > 1000, has tools
        mockClient.complete.mockResolvedValueOnce(createAssistantMessage(0.1, 1200, true));

        await expect(runner.run(config, [], emit, new AbortController().signal, callbacks))
            .rejects.toThrow('Context limit exceeded');
    });

    it('should accumulate cost correctly during loop', async () => {
        const config = createConfig({
            costLimit: 1.0,
            currentCost: 0
        });

        // 1. First turn: cost 0.4 (total 0.4). Tool call.
        mockClient.complete.mockResolvedValueOnce(createAssistantMessage(0.4, 100, true));
        
        // Mock tool execution (we need to pass a tool in config)
        config.tools = [{ 
            name: 'tool1', 
            description: '', 
            parameters: {}, 
            execute: async () => ({ content: [], details: {} }) 
        } as any];

        // 2. Second turn: cost 0.4 (total 0.8). Tool call.
        mockClient.complete.mockResolvedValueOnce(createAssistantMessage(0.4, 100, true));

        // 3. Third turn: cost 0.3 (total 1.1). Tool call -> SHOULD THROW
        mockClient.complete.mockResolvedValueOnce(createAssistantMessage(0.3, 100, true));

        await expect(runner.run(config, [], emit, new AbortController().signal, callbacks))
            .rejects.toThrow('Cost limit exceeded');

        expect(mockClient.complete).toHaveBeenCalledTimes(3);
    });
});
