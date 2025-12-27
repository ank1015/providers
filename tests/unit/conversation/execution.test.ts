import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Conversation } from '../../../src/agent/conversation.js';
import { AgentRunner, AgentRunnerCallbacks } from '../../../src/agent/runner.js';
import { AgentLoopConfig, AgentEvent } from '../../../src/agent/types.js';
import { Message, UserMessage } from '../../../src/types.js';

// Mock Runner
class MockAgentRunner implements AgentRunner {
    run = vi.fn();
}

describe('Conversation Execution', () => {
    let conversation: Conversation;
    let mockRunner: MockAgentRunner;

    beforeEach(() => {
        mockRunner = new MockAgentRunner();
        // Reset mock behavior
        mockRunner.run.mockReset();
        mockRunner.run.mockResolvedValue([]);

        conversation = new Conversation({
            runner: mockRunner
        });
    });

    describe('prompt()', () => {
        it('should call runner.run with correct arguments', async () => {
            const input = 'Hello world';

            // Mock runner to return the messages it gets + response
            mockRunner.run.mockImplementation(async (cfg, msgs, emit, signal, cbs) => {
                return msgs;
            });

            await conversation.prompt(input);

            expect(mockRunner.run).toHaveBeenCalledTimes(1);
            const [cfg, msgs, emit, signal, cbs] = mockRunner.run.mock.calls[0];

            expect(cfg.provider).toBeDefined();
            expect(msgs.length).toBe(1);
            expect(msgs[0].role).toBe('user');
            expect((msgs[0].content[0] as any).content).toBe(input);
            expect(signal).toBeInstanceOf(AbortSignal);
        });

        it('should prevent concurrent prompts', async () => {
            // Make run take some time
            mockRunner.run.mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                return [];
            });

            const p1 = conversation.prompt('first');

            // Immediately try second prompt
            await expect(conversation.prompt('second')).rejects.toThrow(/Cannot start a new prompt/);

            await p1;
        });

        it('should update state.isStreaming during execution', async () => {
            let isStreamingDuringRun = false;
            mockRunner.run.mockImplementation(async () => {
                isStreamingDuringRun = conversation.state.isStreaming;
                return [];
            });

            await conversation.prompt('test');
            expect(isStreamingDuringRun).toBe(true);
            expect(conversation.state.isStreaming).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockRunner.run.mockRejectedValue(new Error('Runner failed'));

            await expect(conversation.prompt('test')).rejects.toThrow('Runner failed');

            expect(conversation.state.error).toBe('Runner failed');
            expect(conversation.state.isStreaming).toBe(false);
        });

        it('should propagate events from runner to subscribers', async () => {
            mockRunner.run.mockImplementation(async (cfg, msgs, emit, signal) => {
                emit({ type: 'turn_start' });
                return msgs;
            });

            const events: string[] = [];
            conversation.subscribe(e => events.push(e.type));

            await conversation.prompt('test');

            expect(events).toContain('turn_start');
            expect(events).toContain('agent_start'); // Emitted by conversation itself before runner
        });
    });

    describe('waitForIdle()', () => {
        it('should resolve immediately if idle', async () => {
            const start = Date.now();
            await conversation.waitForIdle();
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(10); // Should be near instant
        });

        it('should wait for running prompt to complete', async () => {
            let resolveRun: () => void;
            const runPromise = new Promise<Message[]>(resolve => {
                resolveRun = () => resolve([]);
            });

            mockRunner.run.mockReturnValue(runPromise);

            const promptPromise = conversation.prompt('test');

            let idleResolved = false;
            conversation.waitForIdle().then(() => { idleResolved = true; });

            await new Promise(r => setTimeout(r, 0));
            expect(idleResolved).toBe(false); // Should still be waiting

            resolveRun!();
            await promptPromise;
            await new Promise(r => setTimeout(r, 0));

            expect(idleResolved).toBe(true);
        });
    });

    describe('abort()', () => {
        it('should signal abort to runner', async () => {
            let receivedSignal: AbortSignal;

            mockRunner.run.mockImplementation(async (cfg, msgs, emit, signal) => {
                receivedSignal = signal;
                await new Promise(r => setTimeout(r, 50));
                return [];
            });

            const p = conversation.prompt('test');
            conversation.abort();

            await p;

            expect(receivedSignal!).toBeDefined();
            expect(receivedSignal!.aborted).toBe(true);
        });
    });

    describe('addCustomMessage()', () => {
        it('should emit events and append custom message', async () => {
            const events: AgentEvent[] = [];
            conversation.subscribe(e => events.push(e));

            const customContent = { type: 'ui-update', value: 1 };
            await conversation.addCustomMessage(customContent);

            expect(conversation.state.messages.length).toBe(1);
            const msg = conversation.state.messages[0];
            expect(msg.role).toBe('custom');
            expect((msg as any).content).toEqual(customContent);

            // Check events
            const startEvent = events.find(e => e.type === 'message_start' && e.messageType === 'custom');
            const updateEvent = events.find(e => e.type === 'message_update' && e.messageType === 'custom');
            const endEvent = events.find(e => e.type === 'message_end' && e.messageType === 'custom');

            expect(startEvent).toBeDefined();
            expect(updateEvent).toBeDefined();
            expect(endEvent).toBeDefined();
        });

        it('should wait for idle before adding', async () => {
            // Start a long running prompt
            mockRunner.run.mockImplementation(async () => {
                await new Promise(r => setTimeout(r, 50));
                return [];
            });

            const p = conversation.prompt('test');

            let added = false;
            const addPromise = conversation.addCustomMessage({}).then(() => { added = true; });

            expect(added).toBe(false);
            await p;
            await addPromise;
            expect(added).toBe(true);
        });
    });

    describe('continue()', () => {
        it('should throw if no messages', async () => {
            await expect(conversation.continue()).rejects.toThrow('No messages to continue from');
        });

        it('should throw if last message is not user/toolResult', async () => {
            const assistantMsg: Message = {
                role: 'assistant',
                id: '1',
                content: [],
                api: 'openai',
                model: {} as any,
                stopReason: 'stop',
                usage: {
                    input: 0, output: 0, totalTokens: 0, cacheRead: 0, cacheWrite: 0,
                    cost: { total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
                },
                timestamp: 0,
                duration: 0,
                message: {} as any
            };
            conversation.appendMessage(assistantMsg);

            // Mock transformer to return the message as is
            // Note: `continue` checks the TRANSFORMED messages. 
            // Default transformer acts as identity, BUT we need to ensure the check 
            // inside `_runAgentLoopContinue` sees the right roles.
            // The check is: lastMessage.role !== "user" && lastMessage.role !== "toolResult"

            // Wait, logic in conversation code:
            // const { llmMessages, cfg, signal } = await this._prepareRun();
            // const lastMessage = llmMessages[llmMessages.length - 1];

            await expect(conversation.continue()).rejects.toThrow(/Cannot continue from message role/);
        });

        it('should call runner with existing messages', async () => {
            const userMsg: Message = { role: 'user', id: '1', content: [{ type: 'text', content: 'hi' }] };
            conversation.appendMessage(userMsg);

            mockRunner.run.mockResolvedValue([]);

            await conversation.continue();

            expect(mockRunner.run).toHaveBeenCalledTimes(1);
            const [_, msgs] = mockRunner.run.mock.calls[0];
            expect(msgs.length).toBe(1);
            expect(msgs[0]).toEqual(userMsg);
        });
    });

    describe('Limits and Budget', () => {
        it('should throw immediately if cost limit exceeded before run', async () => {
            conversation.setCostLimit(1.0);
            // Manually set usage to exceed limit
            conversation.state.usage.totalCost = 1.5;

            await expect(conversation.prompt('test')).rejects.toThrow('Cost limit exceeded');
            expect(mockRunner.run).not.toHaveBeenCalled();
        });

        it('should NOT throw if context limit exceeded before run (check removed)', async () => {
            conversation.setContextLimit(100);
            conversation.state.usage.lastInputTokens = 200;

            mockRunner.run.mockResolvedValue([]);

            await conversation.prompt('test');
            expect(mockRunner.run).toHaveBeenCalled();
        });

        it('should pass budget to runner', async () => {
            conversation.setCostLimit(10.0);
            conversation.setContextLimit(5000);
            conversation.state.usage.totalCost = 2.5;

            mockRunner.run.mockResolvedValue([]);

            await conversation.prompt('test');

            const [cfg] = mockRunner.run.mock.calls[0];
            expect(cfg.budget).toBeDefined();
            expect(cfg.budget?.costLimit).toBe(10.0);
            expect(cfg.budget?.contextLimit).toBe(5000);
            expect(cfg.budget?.currentCost).toBe(2.5);
        });
    });

    describe('Transformer', () => {
        it('should transform messages before sending to runner', async () => {
            const transformer = vi.fn().mockImplementation((msgs) => {
                return msgs.map((m: any) => ({ ...m, extra: 'transformed' }));
            });

            conversation = new Conversation({
                runner: mockRunner,
                messageTransformer: transformer
            });

            // Add a message to history which WILL be transformed
            conversation.appendMessage({ role: 'user', id: 'old', content: [] });

            await conversation.prompt('test');

            expect(transformer).toHaveBeenCalled();
            const [_, msgs] = mockRunner.run.mock.calls[0];

            // msgs[0] is the historical message, which should be transformed
            expect((msgs[0] as any).extra).toBe('transformed');

            // msgs[1] is the new prompt, which is NOT transformed in the current implementation
            expect(msgs.length).toBe(2);
        });
    });

    describe('Queue Mode', () => {
        it('should provide one queued message at a time if mode is "one-at-a-time"', async () => {
            // Setup
            conversation.setQueueMode('one-at-a-time');
            const q1: Message = { role: 'user', id: 'q1', content: [] };
            const q2: Message = { role: 'user', id: 'q2', content: [] };
            await conversation.queueMessage(q1);
            await conversation.queueMessage(q2);

            // Trigger prompt
            await conversation.prompt('start');

            // Check what runner received in config.getQueuedMessages
            const [config] = mockRunner.run.mock.calls[0];
            const queued = await config.getQueuedMessages();

            expect(queued.length).toBe(1);
            expect(queued[0].original).toBe(q1);

            // Check remaining queue via second call (simulating next turn)
            const queued2 = await config.getQueuedMessages();
            expect(queued2[0].original).toBe(q2);
        });

        it('should provide all queued messages if mode is "all"', async () => {
            conversation.setQueueMode('all');
            const q1: Message = { role: 'user', id: 'q1', content: [] };
            const q2: Message = { role: 'user', id: 'q2', content: [] };
            await conversation.queueMessage(q1);
            await conversation.queueMessage(q2);

            await conversation.prompt('start');

            const [config] = mockRunner.run.mock.calls[0];
            const queued = await config.getQueuedMessages();

            expect(queued.length).toBe(2);
            expect(queued[0].original).toBe(q1);
            expect(queued[1].original).toBe(q2);
        });
    });
});
