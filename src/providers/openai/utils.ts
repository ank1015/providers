import OpenAI from "openai";
import { AssistantResponse, BaseAssistantMessage, Context, Model, StopReason, Tool, Usage } from "../../types.js"
import type { Response, Tool as OpenAITool, ResponseInput, ResponseInputMessageContentList, ResponseFunctionCallOutputItemList, ResponseInputItem, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses.js";
import { sanitizeSurrogates } from "../../utils/sanitize-unicode.js";
import { calculateCost } from "../../models.js";
import { OpenAIProviderOptions } from "./types.js";

export function createClient(model: Model<"openai">, apiKey?: string) {
    if (!apiKey) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error(
                "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it as an argument.",
            );
        }
        apiKey = process.env.OPENAI_API_KEY;
    }
    return new OpenAI({
        apiKey,
        baseURL: model.baseUrl,
        dangerouslyAllowBrowser: true,
        defaultHeaders: model.headers,
    });
}

export function getResponseAssistantResponse(response: Response): AssistantResponse {
    const assistantResponse: AssistantResponse = [];

    if (response.output) {
        for (const item of response.output) {
            if (item.type === 'reasoning' && item.summary) {
                // Convert reasoning to thinking content
                const thinkingText = item.summary.map(s => s.text).join('\n\n');
                assistantResponse.push({
                    type: 'thinking',
                    thinkingText: thinkingText
                });
            } else if (item.type === 'message' && item.content) {
                // Convert message to text content
                const textContent = item.content
                    .map(c => {
                        if (c.type === 'output_text') return c.text;
                        if (c.type === 'refusal') return c.refusal;
                        return '';
                    })
                    .join('');

                if (textContent) {
                    assistantResponse.push({
                        type: 'response',
                        content: [{
                            type: 'text',
                            content: textContent
                        }]
                    });
                }
            } else if (item.type === 'image_generation_call' && item.result) {
                assistantResponse.push({
                    type: 'response',
                    content: [{
                        type: 'image',
                        data: item.result,
                        mimeType: 'image/png'
                    }]
                })
            }
            else if (item.type === 'function_call') {
                // Convert function call to tool call
                assistantResponse.push({
                    type: 'toolCall',
                    toolCallId: item.call_id,
                    name: item.name,
                    arguments: JSON.parse(item.arguments || '{}')
                });
            }
        }
    }

    return assistantResponse
}

export function getResponseUsage(response: Response, model: Model<'openai'>): Usage {
    const cachedTokens = response.usage?.input_tokens_details?.cached_tokens || 0;
    const usage: Usage = {
        input: (response.usage?.input_tokens || 0) - cachedTokens,
        output: response.usage?.output_tokens || 0,
        cacheRead: cachedTokens,
        cacheWrite: 0,
        totalTokens: response.usage?.total_tokens || 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    };
    calculateCost(model, usage);
    return usage;
}

export function buildParams(model: Model<"openai">, context: Context, options: OpenAIProviderOptions) {
    const messages = buildOpenAIMessages(model, context);

    const { apiKey, signal, ...openaiOptions } = options
    const params: ResponseCreateParamsNonStreaming = {
        ...openaiOptions,
        stream: false
    }

    params.model = model.id;
    params.input = messages

    const tools: OpenAITool[] = []

    if (context.tools && model.tools.includes('function_calling')) {
        const convertedTools = convertTools(context.tools)
        for (const convertedTool of convertedTools) {
            tools.push(convertedTool)
        }
    }

    if (openaiOptions.tools) {
        for (const optionTool of openaiOptions.tools) {
            tools.push(optionTool)
        }
    }

    params.tools = tools;
    return params;
}

export function buildOpenAIMessages(model: Model<'openai'>, context: Context): ResponseInput {
    const openAIMessages: ResponseInput = [];
    if (context.systemPrompt) {
        openAIMessages.push({
            role: 'developer',
            content: sanitizeSurrogates(context.systemPrompt)
        })
    };

    for (const message of context.messages) {

        if (message.role === 'user') {
            const contents: ResponseInputMessageContentList = [];
            for (let p = 0; p < message.content.length; p++) {
                const content = message.content[p];
                if (content.type === 'text') {
                    contents.push({
                        type: 'input_text',
                        text: sanitizeSurrogates(content.content)
                    })
                }
                if (content.type === 'image' && model.input.includes("image")) {
                    contents.push({
                        type: 'input_image',
                        detail: 'auto',
                        image_url: `data:${content.mimeType};base64,${content.data}`
                    })
                }
                if (content.type === 'file' && model.input.includes("file")) {
                    contents.push({
                        type: 'input_file',
                        filename: content.filename,
                        file_data: `data:${content.mimeType};base64,${content.data}`
                    })
                }
            }
            openAIMessages.push({
                role: 'user',
                content: contents
            })
        }

        // normalize for tool results
        if (message.role === 'toolResult') {
            const toolOutputs: ResponseFunctionCallOutputItemList = []
            let hasText = false;
            let hasImg = false;
            let hasFile = false;
            for (let p = 0; p < message.content.length; p++) {
                const content = message.content[p];
                if (content.type === 'text') {
                    // Prefix error messages so LLM knows the tool failed
                    const textContent = message.isError
                        ? `[TOOL ERROR] ${content.content}`
                        : content.content;
                    toolOutputs.push({
                        type: 'input_text',
                        text: sanitizeSurrogates(textContent)
                    })
                    hasText = true;
                }
                if (content.type === 'image' && model.input.includes("image")) {
                    toolOutputs.push({
                        type: 'input_image',
                        detail: 'auto',
                        image_url: `data:${content.mimeType};base64,${content.data}`
                    })
                    hasImg = true
                }
                if (content.type === 'file' && model.input.includes("file")) {
                    toolOutputs.push({
                        type: 'input_file',
                        file_data: `data:${content.mimeType};base64,${content.data}`
                    })
                    hasFile = true
                }
            }
            if (!hasText && (hasImg || hasFile)) {
                toolOutputs.push({
                    type: 'input_text',
                    text: message.isError ? '[TOOL ERROR] (see attached)' : '(see attached)'
                })
            }
            const toolResultInput: ResponseInputItem.FunctionCallOutput = {
                call_id: message.toolCallId,
                output: toolOutputs,
                type: 'function_call_output',
            }
            openAIMessages.push(toolResultInput)
        }

        // normalize for Assistant message
        if (message.role === 'assistant') {
            if (message.model.api === 'openai') {
                const baseMessage = message as BaseAssistantMessage<'openai'>
                for (let p = 0; p < baseMessage.message.output.length; p++) {
                    const outputPart = baseMessage.message.output[p];
                    if (outputPart.type === 'function_call' || outputPart.type === 'message' || outputPart.type === 'reasoning') {
                        openAIMessages.push(outputPart);
                    }
                }
            }
            // TODO Implement other provider conversions
            else {
                throw new Error(
                    `Cannot convert ${message.model.api} assistant message to ${model.api} format. ` +
                    `Cross-provider conversion for ${message.model.api} → ${model.api} is not yet implemented.`
                );
            }
        }

    }

    return openAIMessages
}

export function convertTools(tools: readonly Tool[]): OpenAITool[] {
    return tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters, // TypeBox already generates JSON Schema
        strict: null,
    }));
}

export function mapStopReason(status: OpenAI.Responses.ResponseStatus | undefined): StopReason {
    if (!status) return "stop";
    switch (status) {
        case "completed":
            return "stop";
        case "incomplete":
            return "length";
        case "failed":
        case "cancelled":
            return "error";
        // These two are wonky ...
        case "in_progress":
        case "queued":
            return "stop";
        default: {
            const _exhaustive: never = status;
            throw new Error(`Unhandled stop reason: ${_exhaustive}`);
        }
    }
}

export function getMockOpenaiMessage(): Response {
    return {
        id: "resp_123",
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
        output: [],
        previous_response_id: null,
        temperature: 1,
        text: {},
        tool_choice: "auto",
        tools: [],
        top_p: 1,
        truncation: "disabled",
        usage: {
            input_tokens: 0,
            output_tokens: 0,
            output_tokens_details: {
                reasoning_tokens: 0
            },
            input_tokens_details: {
                cached_tokens: 0
            },
            total_tokens: 0
        },
        user: undefined,
        metadata: {}
    }
}