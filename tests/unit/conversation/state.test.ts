import { describe, it, expect, beforeEach } from 'vitest';
import { Conversation } from '../../../src/agent/conversation.js';
import { getModel } from '../../../src/models.js';
import { Message, UserMessage, TextContent } from '../../../src/types.js';

describe('Conversation State Management', () => {
    let conversation: Conversation;

    beforeEach(() => {
        conversation = new Conversation();
    });

    describe('Constructor', () => {
        it('should initialize with default state', () => {
            const state = conversation.state;
            expect(state.messages).toEqual([]);
            expect(state.tools).toEqual([]);
            expect(state.isStreaming).toBe(false);
            expect(state.pendingToolCalls.size).toBe(0);
            expect(state.error).toBeUndefined();
            expect(state.provider).toBeDefined();
            expect(state.provider.model.id).toBe('gemini-3-flash-preview');
        });

        it('should accept initial state', () => {
            const initialMessages: Message[] = [
                { role: 'user', id: '1', content: [{ type: 'text', content: 'hello' }] }
            ];
            const customConv = new Conversation({
                initialState: {
                    messages: initialMessages,
                    systemPrompt: 'You are a test agent'
                }
            });

            expect(customConv.state.messages).toEqual(initialMessages);
            expect(customConv.state.messages).not.toBe(initialMessages); // Should be a copy
            expect(customConv.state.systemPrompt).toBe('You are a test agent');
        });
    });

    describe('State Mutators', () => {
        it('should set system prompt', () => {
            conversation.setSystemPrompt('New system prompt');
            expect(conversation.state.systemPrompt).toBe('New system prompt');
        });

        it('should set provider', () => {
            const newModel = getModel('openai', 'gpt-5.2');
            const newProvider = { model: newModel!, providerOptions: { apiKey: 'test' } };
            conversation.setProvider(newProvider);
            expect(conversation.state.provider).toBe(newProvider);
        });

        it('should set tools', () => {
            const tools: any[] = [{ name: 'testTool', description: 'desc', parameters: {} }];
            conversation.setTools(tools);
            expect(conversation.state.tools).toBe(tools);
        });

        it('should set and get queue mode', () => {
            expect(conversation.getQueueMode()).toBe('one-at-a-time'); // Default
            conversation.setQueueMode('all');
            expect(conversation.getQueueMode()).toBe('all');
        });
    });

    describe('Message Management', () => {
        const msg1: Message = { role: 'user', id: '1', content: [{ type: 'text', content: '1' }] };
        const msg2: Message = { role: 'assistant', id: '2', content: [], api: 'openai', model: {} as any, stopReason: 'stop', usage: {} as any, timestamp: 0, duration: 0, message: {} as any };

        it('should append message', () => {
            conversation.appendMessage(msg1);
            expect(conversation.state.messages).toEqual([msg1]);
        });

        it('should append multiple messages', () => {
            conversation.appendMessages([msg1, msg2]);
            expect(conversation.state.messages).toEqual([msg1, msg2]);
        });

        it('should replace messages', () => {
            conversation.appendMessage(msg1);
            conversation.replaceMessages([msg2]);
            expect(conversation.state.messages).toEqual([msg2]);
        });

        it('should clear messages', () => {
            conversation.appendMessage(msg1);
            conversation.clearMessages();
            expect(conversation.state.messages).toEqual([]);
        });

        it('should remove message by id', () => {
            conversation.appendMessages([msg1, msg2]);
            const removed = conversation.removeMessage('1');
            expect(removed).toBe(true);
            expect(conversation.state.messages).toEqual([msg2]);
        });

        it('should return false when removing non-existent message', () => {
            const removed = conversation.removeMessage('999');
            expect(removed).toBe(false);
        });

        it('should update message', () => {
            conversation.appendMessage(msg1);
            const updater = (m: Message) => {
                const updatedMessage: UserMessage = m as UserMessage;
                ((updatedMessage).content[0] as TextContent).content = 'updated'
                return updatedMessage;
            }
            const updated = conversation.updateMessage('1', updater);

            expect(updated).toBe(true);
            const content = ((conversation.state.messages[0] as UserMessage).content[0] as TextContent).content;
            expect(content).toBe('updated');
        });

        it('should return false when updating non-existent message', () => {
            const updated = conversation.updateMessage('999', (m) => m);
            expect(updated).toBe(false);
        });
    });

    describe('Message Queue', () => {
        it('should queue messages with transformation', async () => {
            const msg: Message = { role: 'user', id: 'q1', content: [] };
            await conversation.queueMessage(msg);

            // We can't access messageQueue directly easily as it is private, 
            // but we can infer it works if no error thrown.
            // To properly test, we might need to rely on the execution test or check via specific scenario.
            // However, verify clearMessageQueue clears it.

            // Since messageQueue is private, we can use a small hack or rely on behaviors.
            // Let's rely on behavior: internal queue length is difficult to check without `any` cast.
            expect((conversation as any).messageQueue.length).toBe(1);
            expect((conversation as any).messageQueue[0].original).toBe(msg);
        });

        it('should clear message queue', async () => {
            const msg: Message = { role: 'user', id: 'q1', content: [] };
            await conversation.queueMessage(msg);
            conversation.clearMessageQueue();
            expect((conversation as any).messageQueue.length).toBe(0);
        });
    });

    describe('Reset', () => {
        it('should reset all state', () => {
            conversation.appendMessage({ role: 'user', id: '1', content: [] });
            (conversation.state.pendingToolCalls as Set<string>).add('tool1');
            conversation.state.error = 'some error';

            conversation.reset();

            expect(conversation.state.messages).toEqual([]);
            expect(conversation.state.pendingToolCalls.size).toBe(0);
            expect(conversation.state.error).toBeUndefined();
            expect(conversation.state.isStreaming).toBe(false);
        });
    });
});
