import { Api, AssistantResponse, AssistantToolCall, BaseAssistantMessage, Message, OptionsForApi, ToolResultMessage } from "../types.js";
import { AgentEvent, AgentLoopConfig, AgentTool, AgentToolResult, QueuedMessage } from "./types.js";
import { getMockMessage, LLMClient } from "../llm.js";
import { generateUUID } from "../utils/uuid.js";
import { validateToolArguments } from "../utils/validation.js";
import { buildToolResultMessage } from "./utils.js";

/**
 * AgentRunner interface - handles the execution logic of the agent loop.
 * Stateless executor that can be tested independently from Conversation state management.
 */
export interface AgentRunner {
    run(
        config: AgentLoopConfig,
        initialMessages: Message[],
        emit: (event: AgentEvent) => void,
        signal: AbortSignal,
        callbacks: AgentRunnerCallbacks
    ): Promise<Message[]>;
}

/**
 * Callbacks for AgentRunner to interact with Conversation state.
 * This decouples AgentRunner from direct state mutation.
 */
export interface AgentRunnerCallbacks {
    appendMessage: (message: Message) => void;
    appendMessages: (messages: Message[]) => void;
    addPendingToolCall: (toolCallId: string) => void;
    removePendingToolCall: (toolCallId: string) => void;
}

export interface AgentRunnerOptions {
    streamAssistantMessage?: boolean;
}

/**
 * Default implementation of AgentRunner.
 * Handles the main agent loop: calling LLM, processing responses, executing tools.
 */
export class DefaultAgentRunner implements AgentRunner {
    private streamAssistantMessage: boolean;

    constructor(
        private client: LLMClient,
        options: AgentRunnerOptions = {}
    ) {
        this.streamAssistantMessage = options.streamAssistantMessage ?? true;
    }

    async run(
        config: AgentLoopConfig,
        initialMessages: Message[],
        emit: (event: AgentEvent) => void,
        signal: AbortSignal,
        callbacks: AgentRunnerCallbacks
    ): Promise<Message[]> {
        const newMessages: Message[] = [];
        const updatedMessages = [...initialMessages];
        const providerOptions = { ...config.provider.providerOptions, signal };

        let hasMoreToolCalls = true;
        let firstTurn = true;
        let queuedMessages: QueuedMessage<any>[] = (await config.getQueuedMessages()) || [];

        // Track accumulated cost within this run execution if budget is provided
        let currentRunCost = 0;

        while (hasMoreToolCalls || queuedMessages.length > 0) {
            if (!firstTurn) {
                emit({ type: 'turn_start' });
            } else {
                firstTurn = false;
            }

            // Process queued messages first (inject before next assistant response)
            if (queuedMessages.length > 0) {
                for (const { llm } of queuedMessages) {
                    if (llm) {
                        emit({ type: 'message_start', messageId: llm.id, messageType: llm.role, message: llm });
                        emit({ type: 'message_end', messageId: llm.id, messageType: llm.role, message: llm });
                        updatedMessages.push(llm);
                        newMessages.push(llm);
                        callbacks.appendMessage(llm);
                    }
                }
                queuedMessages = [];
            }

            const assistantMessage = await this.callAssistant(
                config,
                updatedMessages,
                providerOptions,
                signal,
                emit
            );
            newMessages.push(assistantMessage);
            callbacks.appendMessage(assistantMessage);
            updatedMessages.push(assistantMessage);

            // Check budget limits
            if (config.budget) {
                currentRunCost += assistantMessage.usage.cost.total;
                const totalCost = config.budget.currentCost + currentRunCost;
                const isCostLimitExceeded = config.budget.costLimit && totalCost >= config.budget.costLimit;
                const isContextLimitExceeded = config.budget.contextLimit && assistantMessage.usage.input >= config.budget.contextLimit;

                if (isCostLimitExceeded || isContextLimitExceeded) {
                    const toolCalls = assistantMessage.content.filter((c) => c.type === "toolCall");
                    const hasMoreActions = toolCalls.length > 0 || queuedMessages.length > 0;

                    if (hasMoreActions) {
                         if (isCostLimitExceeded) {
                             throw new Error(`Cost limit exceeded: ${totalCost} >= ${config.budget.costLimit}`);
                         }
                         if (isContextLimitExceeded) {
                             throw new Error(`Context limit exceeded: ${assistantMessage.usage.input} >= ${config.budget.contextLimit}`);
                         }
                    }
                }
            }

            const stopReason = assistantMessage.stopReason;
            if (stopReason === 'aborted' || stopReason === 'error') {
                emit({ type: "turn_end" });
                emit({ type: "agent_end", agentMessages: newMessages });
                return newMessages;
            }

            const assistantMessageContent = assistantMessage.content;

            // Check for tool calls
            const toolCalls = assistantMessageContent.filter((c) => c.type === "toolCall");
            hasMoreToolCalls = toolCalls.length > 0;

            if (hasMoreToolCalls) {
                const toolResults = await this.executeToolCalls(
                    config.tools,
                    assistantMessageContent,
                    signal,
                    emit,
                    callbacks
                );
                updatedMessages.push(...toolResults);
                newMessages.push(...toolResults);
                callbacks.appendMessages(toolResults);
            }

            emit({ type: 'turn_end' });

            // Get queued messages after turn completes
            queuedMessages = (await config.getQueuedMessages()) || [];
        }

        emit({ type: 'agent_end', agentMessages: newMessages });
        return newMessages;
    }

    async callAssistant<TApi extends Api>(
        config: AgentLoopConfig,
        messages: Message[],
        providerOptions: OptionsForApi<TApi>,
        signal: AbortSignal,
        emit: (event: AgentEvent) => void
    ): Promise<BaseAssistantMessage<TApi>> {
        const assistantMessageId = generateUUID();
        const initialMessage = getMockMessage(config.provider.model);
        emit({ type: 'message_start', messageId: assistantMessageId, messageType: 'assistant', message: initialMessage });

        if (this.streamAssistantMessage) {
            const assistantStream = this.client.stream(
                config.provider.model,
                {
                    messages,
                    systemPrompt: config.systemPrompt,
                    tools: config.tools
                },
                providerOptions,
                assistantMessageId
            );

            for await (const ev of assistantStream) {
                emit({ type: 'message_update', messageId: assistantMessageId, messageType: 'assistant', message: ev });
            }

            const assistantMessage = await assistantStream.result();

            emit({ type: 'message_end', messageId: assistantMessageId, messageType: 'assistant', message: assistantMessage });
            return assistantMessage as BaseAssistantMessage<TApi>;
        } else {
            const assistantMessage = await this.client.complete(
                config.provider.model,
                {
                    messages,
                    systemPrompt: config.systemPrompt,
                    tools: config.tools
                },
                providerOptions,
                assistantMessageId
            );
            emit({ type: 'message_end', messageId: assistantMessageId, messageType: 'assistant', message: assistantMessage });
            return assistantMessage as BaseAssistantMessage<TApi>;
        }
    }

    async executeToolCalls(
        tools: AgentTool[],
        assistantMessageContent: AssistantResponse,
        signal: AbortSignal,
        emit: (event: AgentEvent) => void,
        callbacks: AgentRunnerCallbacks
    ): Promise<ToolResultMessage[]> {
        const toolCalls = assistantMessageContent.filter((c) => c.type === "toolCall");
        const results: ToolResultMessage[] = [];

        for (const toolCall of toolCalls) {
            if (signal.aborted) break;

            const tool = tools.find((t) => t.name === toolCall.name);

            // Track pending and emit start
            callbacks.addPendingToolCall(toolCall.toolCallId);
            emit({
                type: 'tool_execution_start',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.name,
                args: toolCall.arguments
            });

            // Execute the tool
            const { result, isError, errorDetails } = await this.executeSingleTool(
                tool,
                toolCall,
                signal,
                (partialResult) => emit({
                    type: 'tool_execution_update',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.name,
                    args: toolCall.arguments,
                    partialResult
                })
            );

            // Cleanup and emit end
            callbacks.removePendingToolCall(toolCall.toolCallId);
            emit({
                type: 'tool_execution_end',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.name,
                result,
                isError
            });

            // Build and emit message
            const toolResultMessage = buildToolResultMessage(toolCall, result, isError, errorDetails);
            results.push(toolResultMessage);

            emit({ type: 'message_start', messageId: toolResultMessage.id, messageType: 'toolResult', message: toolResultMessage });
            emit({ type: 'message_end', messageId: toolResultMessage.id, messageType: 'toolResult', message: toolResultMessage });
        }

        return results;
    }

    private async executeSingleTool(
        tool: AgentTool | undefined,
        toolCall: AssistantToolCall,
        signal: AbortSignal,
        onUpdate: (partialResult: AgentToolResult<any>) => void
    ): Promise<{ result: AgentToolResult<unknown>; isError: boolean; errorDetails?: ToolResultMessage['error'] }> {

        if (!tool) {
            return {
                result: {
                    content: [{ type: 'text', content: `Tool ${toolCall.name} not found` }],
                    details: {}
                },
                isError: true,
                errorDetails: {
                    message: `Tool ${toolCall.name} not found`,
                    name: 'ToolNotFoundError'
                }
            };
        }

        try {
            const validatedArgs = validateToolArguments(tool, toolCall);
            const result = await tool.execute(toolCall.toolCallId, validatedArgs, signal, onUpdate);
            return { result, isError: false };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                result: {
                    content: [{ type: 'text', content: message }],
                    details: {}
                },
                isError: true,
                errorDetails: e instanceof Error
                    ? { message: e.message, name: e.name, stack: e.stack }
                    : undefined
            };
        }
    }
}
