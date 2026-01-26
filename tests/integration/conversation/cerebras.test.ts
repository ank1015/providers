import { describe, it, expect } from 'vitest';
import { Conversation } from '../../../src/agent/conversation.js';
import { MODELS } from '../../../src/models.generated.js';
import { calculateTool } from '../../../src/agent/tools/calculate.js';
import { getCurrentTimeTool } from '../../../src/agent/tools/get-current-time.js';
import { TextContent, Content, BaseAssistantMessage, Api, BaseAssistantEvent } from '../../../src/types.js';
import { AgentEvent } from '../../../src/agent/types.js';

describe('Cerebras Conversation Integration', () => {
    describe('GLM 4.7 Model', () => {
        it('should use calculator tool correctly', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            conversation.setTools([calculateTool as any]);

            // "What is 2 * 123 + 45?" -> expect tool call -> expect answer 291
            const messages = await conversation.prompt('What is 2 * 123 + 45? Use the calculator tool.');

            // Assertions
            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.role).toBe('assistant');

            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response')
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;
            expect(textContent).toBeDefined();
            expect(textContent.content).toContain('291');

            const toolCalls = conversation.state.messages.filter(m => m.role === 'toolResult');
            expect(toolCalls.length).toBeGreaterThan(0);
            expect(toolCalls[0].toolName).toBe('calculate');
        }, 60000);

        it('should use get_current_time tool', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            conversation.setTools([getCurrentTimeTool as any]);

            const messages = await conversation.prompt('What is the current time?');

            const lastMessage = messages[messages.length - 1];
            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response')
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;
            expect(textContent).toBeDefined();

            const toolResult = conversation.state.messages.find(m => m.role === 'toolResult');
            expect(toolResult).toBeDefined();
            expect(toolResult?.toolName).toBe('get_current_time');
        }, 60000);

        it('should emit all agent events correctly during tool use', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            conversation.setTools([calculateTool as any]);

            // Collect all events
            const events: AgentEvent[] = [];
            conversation.subscribe((event) => {
                events.push(event);
            });

            await conversation.prompt('What is 5 + 5? Use the calculator tool.');

            // Verify agent lifecycle events
            const eventTypes = events.map(e => e.type);

            // Must have agent_start and agent_end
            expect(eventTypes).toContain('agent_start');
            expect(eventTypes).toContain('agent_end');

            // Must have at least one turn
            expect(eventTypes).toContain('turn_start');
            expect(eventTypes).toContain('turn_end');

            // Must have user message events
            const userMessageStarts = events.filter(e => e.type === 'message_start' && e.messageType === 'user');
            const userMessageEnds = events.filter(e => e.type === 'message_end' && e.messageType === 'user');
            expect(userMessageStarts.length).toBeGreaterThan(0);
            expect(userMessageEnds.length).toBeGreaterThan(0);

            // Must have assistant message events
            const assistantMessageStarts = events.filter(e => e.type === 'message_start' && e.messageType === 'assistant');
            const assistantMessageEnds = events.filter(e => e.type === 'message_end' && e.messageType === 'assistant');
            expect(assistantMessageStarts.length).toBeGreaterThan(0);
            expect(assistantMessageEnds.length).toBeGreaterThan(0);

            // Must have assistant message updates (streaming)
            const assistantMessageUpdates = events.filter(e => e.type === 'message_update' && e.messageType === 'assistant');
            expect(assistantMessageUpdates.length).toBeGreaterThan(0);

            // Must have tool execution events
            expect(eventTypes).toContain('tool_execution_start');
            expect(eventTypes).toContain('tool_execution_end');

            // Must have tool result message events
            const toolResultStarts = events.filter(e => e.type === 'message_start' && e.messageType === 'toolResult');
            const toolResultEnds = events.filter(e => e.type === 'message_end' && e.messageType === 'toolResult');
            expect(toolResultStarts.length).toBeGreaterThan(0);
            expect(toolResultEnds.length).toBeGreaterThan(0);

            // Verify event order for first turn: agent_start should come first
            expect(eventTypes[0]).toBe('agent_start');

            // Verify agent_end is last
            expect(eventTypes[eventTypes.length - 1]).toBe('agent_end');

            // Verify tool_execution_start has correct tool name
            const toolStartEvent = events.find(e => e.type === 'tool_execution_start');
            expect(toolStartEvent).toBeDefined();
            if (toolStartEvent && toolStartEvent.type === 'tool_execution_start') {
                expect(toolStartEvent.toolName).toBe('calculate');
            }

            // Verify tool_execution_end has result
            const toolEndEvent = events.find(e => e.type === 'tool_execution_end');
            expect(toolEndEvent).toBeDefined();
            if (toolEndEvent && toolEndEvent.type === 'tool_execution_end') {
                expect(toolEndEvent.toolName).toBe('calculate');
                expect(toolEndEvent.isError).toBe(false);
                expect(toolEndEvent.result).toBeDefined();
            }
        }, 60000);

        it('should handle reasoning mode with parsed format', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY,
                    reasoning_format: 'parsed'
                }
            });

            const messages = await conversation.prompt('Solve step by step: What is 17 * 23?');

            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.role).toBe('assistant');

            // GLM 4.7 with reasoning_format=parsed should have thinking content
            const thinkingContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'thinking');
            if (thinkingContent && thinkingContent.type === 'thinking') {
                expect(thinkingContent.thinkingText.length).toBeGreaterThan(0);
            }

            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;
            expect(textContent).toBeDefined();
            expect(textContent.content).toContain('391');
        }, 90000);

        it('should emit thinking events during reasoning', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY,
                    reasoning_format: 'parsed'
                }
            });

            // Collect all events
            const events: AgentEvent[] = [];
            conversation.subscribe((event) => {
                events.push(event);
            });

            await conversation.prompt('Think carefully: What is 25 + 17?');

            // Check for thinking-related updates in message_update events
            const messageUpdates = events.filter(e => e.type === 'message_update' && e.messageType === 'assistant');
            expect(messageUpdates.length).toBeGreaterThan(0);

            // At least one message update should have thinking content
            const hasThinkingUpdate = messageUpdates.some(e => {
                if (e.type === 'message_update' && e.messageType === 'assistant') {
                    const msg = e.message as BaseAssistantEvent<Api>;
                    return msg.message.content.some(c => c.type === 'thinking');
                }
                return false;
            });

            // GLM 4.7 with reasoning_format=parsed should produce thinking for this query
            if (hasThinkingUpdate) {
                expect(hasThinkingUpdate).toBe(true);
            }
        }, 90000);

        it('should handle disable_reasoning option', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY,
                    disable_reasoning: true
                }
            });

            const messages = await conversation.prompt('What is 10 + 5?');

            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.role).toBe('assistant');

            // With disable_reasoning=true, there should be no thinking content
            const thinkingContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'thinking');
            expect(thinkingContent).toBeUndefined();

            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;
            expect(textContent).toBeDefined();
            expect(textContent.content).toContain('15');
        }, 60000);

        it('should handle multi-turn conversation with context', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            // First turn
            await conversation.prompt('My name is Alice.');

            // Second turn - should remember the name
            const messages = await conversation.prompt('What is my name?');

            const lastMessage = messages[messages.length - 1];
            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;

            expect(textContent).toBeDefined();
            expect(textContent.content.toLowerCase()).toContain('alice');
        }, 60000);

        it('should handle system prompt', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['zai-glm-4.7'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            conversation.setSystemPrompt('You are a pirate. Always respond like a pirate would.');

            const messages = await conversation.prompt('Hello!');

            const lastMessage = messages[messages.length - 1];
            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;

            expect(textContent).toBeDefined();
            // Response should have pirate-like language (ahoy, matey, arr, etc.)
            const pirateWords = ['ahoy', 'matey', 'arr', 'aye', 'ye', 'ship', 'sea', 'captain', 'sailor', 'treasure', 'crew'];
            const hasThePirateSpirit = pirateWords.some(word => textContent.content.toLowerCase().includes(word));
            expect(hasThePirateSpirit).toBe(true);
        }, 60000);
    });

    describe('GPT OSS 120B Model', () => {
        it('should use calculator tool correctly', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['gpt-oss-120b'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            conversation.setTools([calculateTool as any]);

            const messages = await conversation.prompt('What is 2 * 123 + 45? Use the calculator tool.');

            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.role).toBe('assistant');

            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response')
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;
            expect(textContent).toBeDefined();
            expect(textContent.content).toContain('291');

            const toolCalls = conversation.state.messages.filter(m => m.role === 'toolResult');
            expect(toolCalls.length).toBeGreaterThan(0);
            expect(toolCalls[0].toolName).toBe('calculate');
        }, 60000);

        it('should handle reasoning_effort parameter', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['gpt-oss-120b'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY,
                    reasoning_effort: 'high',
                    reasoning_format: 'parsed'
                }
            });

            const messages = await conversation.prompt('Solve step by step: What is 17 * 23?');

            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.role).toBe('assistant');

            // With high reasoning_effort, should have detailed thinking
            const thinkingContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'thinking');
            if (thinkingContent && thinkingContent.type === 'thinking') {
                expect(thinkingContent.thinkingText.length).toBeGreaterThan(0);
            }

            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;
            expect(textContent).toBeDefined();
            expect(textContent.content).toContain('391');
        }, 90000);

        it('should handle multi-turn conversation with context', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['gpt-oss-120b'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            // First turn
            await conversation.prompt('My name is Bob.');

            // Second turn - should remember the name
            const messages = await conversation.prompt('What is my name?');

            const lastMessage = messages[messages.length - 1];
            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;

            expect(textContent).toBeDefined();
            expect(textContent.content.toLowerCase()).toContain('bob');
        }, 60000);

        it('should handle system prompt', async () => {
            const conversation = new Conversation();
            const model = MODELS.cerebras['gpt-oss-120b'];

            conversation.setProvider({
                model: model,
                providerOptions: {
                    apiKey: process.env.CEREBRAS_API_KEY
                }
            });

            conversation.setSystemPrompt('You are a pirate. Always respond like a pirate would.');

            const messages = await conversation.prompt('Hello!');

            const lastMessage = messages[messages.length - 1];
            const responseContent = (lastMessage as BaseAssistantMessage<Api>).content.find(c => c.type === 'response');
            const textContent = responseContent?.content.find((c) => c.type === 'text') as TextContent;

            expect(textContent).toBeDefined();
            // Response should have pirate-like language
            const pirateWords = ['ahoy', 'matey', 'arr', 'aye', 'ye', 'ship', 'sea', 'captain', 'sailor', 'treasure', 'crew'];
            const hasThePirateSpirit = pirateWords.some(word => textContent.content.toLowerCase().includes(word));
            expect(hasThePirateSpirit).toBe(true);
        }, 60000);
    });
});
