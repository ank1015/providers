import { Context, Model, Tool, AssistantMessage, NativeOpenAIMessage, NativeGoogleMessage, NativeAssistantMessage, AssistantTextContent, AssistantThinkingContent, AssistantToolCall, StopReason, Usage, Api } from "../types";
import { ResponseInput, ResponseInputItem, ResponseInputMessageContentList, ResponseInputImage, ResponseInputFile, ResponseInputText, ResponseFunctionCallOutputItemList, Response } from "openai/resources/responses/responses.js";
import { sanitizeSurrogates } from "../utils/sanitize-unicode";
import { ContentListUnion, Part, GenerateContentResponse, FinishReason } from "@google/genai";
import { calculateCost } from "../models";

export function buildOpenAIMessages(model: Model<'openai'> ,context: Context): ResponseInput {

    const openAIMessages: ResponseInput = [];
    if(context.systemPrompt){
        openAIMessages.push({
            role: 'developer',
            content: sanitizeSurrogates(context.systemPrompt)
        })
    };

    for(let i=0; i<context.messages.length; i++){
        const message = context.messages[i];
        // normalize for user message
        if(message.role === 'user'){
            const contents: ResponseInputMessageContentList = [];
            for (let p=0; p< message.content.length; p++){
                const content = message.content[p];
                if(content.type === 'text'){
                    contents.push({
                        type: 'input_text',
                        text: content.content
                    })
                }
                if(content.type === 'image' && model.input.includes("image")){
                    contents.push({
                        type: 'input_image',
                        detail: 'auto',
                        image_url: `data:${content.mimeType};base64,${content.data}`
                    })
                }
                if(content.type === 'file'  && model.input.includes("file")){
                    contents.push({
                        type: 'input_file',
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
        if(message.role === 'toolResult'){
            const toolOutputs: ResponseFunctionCallOutputItemList = []
            let hasText = false;
            let hasImg = false;
            let hasFile = false;
            for (let p=0; p< message.content.length; p++){
                const content = message.content[p];
                if(content.type === 'text'){
                    toolOutputs.push({
                        type: 'input_text',
                        text: content.content
                    })
                    hasText = true;
                }
                if(content.type === 'image'  && model.input.includes("image")){
                    toolOutputs.push({
                        type: 'input_image',
                        detail: 'auto',
                        image_url: `data:${content.mimeType};base64,${content.data}`
                    })
                    hasImg = true
                }
                if(content.type === 'file'  && model.input.includes("file")){
                    toolOutputs.push({
                        type: 'input_file',
                        file_data: `data:${content.mimeType};base64,${content.data}`
                    })
                    hasFile = true
                }
            }
            if(!hasText && (hasImg || hasFile)){
                toolOutputs.push({
                    type: 'input_text',
                    text: '(see attached)'
                })
            }
            const toolResultInput: ResponseInputItem.FunctionCallOutput = {
                call_id: message.toolCallId!,
                output: toolOutputs,
                type: 'function_call_output',
            }
            openAIMessages.push(toolResultInput)
        }

        // normalize for Assistant message
        if(message.role === 'assistant'){
            if(message._provider === 'openai'){
                for(let p=0; p<message.message.output.length; p++){
                    const outputPart = message.message.output[p];
                    if(outputPart.type === 'function_call' || outputPart.type === 'message' || outputPart.type === 'reasoning' ){
                        openAIMessages.push(outputPart);
                    }
                }
            }
            // TODO Implement other provider conversions
            else{
                throw new Error(
                    `Cannot convert ${message._provider} assistant message to ${model.api} format. ` +
                    `Cross-provider conversion for ${message._provider} → ${model.api} is not yet implemented.`
                );
            }
        }
    
    }

    return openAIMessages;
}


export function buildGoogleMessages(model: Model<'google'> ,context: Context): ContentListUnion {
    const contents: ContentListUnion = []

    for (let i=0; i< context.messages.length; i++){
        const message = context.messages[i];

        if(message.role === 'user'){
            const parts: Part[] = [];
            for(let p=0; p<message.content.length; p++){
                const messageContent = message.content[p];
                if(messageContent.type === 'text'){
                    parts.push({
                        text: messageContent.content
                    })
                }
                if(messageContent.type === 'image' && model.input.includes("image")){
                    parts.push({
                        inlineData: {
                            mimeType: messageContent.mimeType,
                            data: messageContent.data
                        }
                    })
                }
                if(messageContent.type === 'file' && model.input.includes("file")){
                    parts.push({
                        inlineData: {
                            mimeType: messageContent.mimeType,
                            data: messageContent.data
                        }
                    })
                }
            }
            contents.push({
                role: 'user',
                parts
            })
        }

        if(message.role === 'toolResult'){
            const parts : Part[] = [];
            let textRes = '(see attached:)';
            for(let p=0; p<message.content.length; p++){
                const messageContent = message.content[p];
                if(messageContent.type === 'text'){
                    textRes = messageContent.content
                }
                if(messageContent.type === 'image' && model.input.includes("image")){
                    parts.push({
                        inlineData: {
                            mimeType: messageContent.mimeType,
                            data: messageContent.data
                        }
                    })
                }
                if(messageContent.type === 'file' && model.input.includes("file")){
                    parts.push({
                        inlineData: {
                            mimeType: messageContent.mimeType,
                            data: messageContent.data
                        }
                    })
                }
            }
            contents.push({
                role: 'user',
                parts: [
                    {
                        functionResponse: {
                            id: message.toolCallId,
                            name: message.toolName,
                            parts,
                            response: {
                                result: textRes,
                                isError: message.isError
                            }
                        }
                    }
                ]
            })
        }

        if(message.role === 'assistant'){
            if(message._provider === 'google'){
                if(message.message.candidates){
                    for(let p=0; p< message.message.candidates?.length; p++){
                        const candidate = message.message.candidates[p];
                        if(candidate.content){
                            contents.push(candidate.content)
                        }
                    }
                }
            }
            // TODO Implement other provider conversions
            else{
                throw new Error(
                    `Cannot convert ${message._provider} assistant message to ${model.api} format. ` +
                    `Cross-provider conversion for ${message._provider} → ${model.api} is not yet implemented.`
                );
            }
        }

    }
    return contents;
}

/**
 * Converts an OpenAI native response message to the standardized AssistantMessage format
 * @param nativeMessage - The native OpenAI message with _provider and response data
 * @param model - The model configuration for cost calculation
 * @returns AssistantMessage - Standardized assistant message
 */
export function convertOpenAINativeToAssistantMessage(
    nativeMessage: NativeOpenAIMessage,
    model: Model<'openai'>
): AssistantMessage {
    const response = nativeMessage.message;
    const content: (AssistantTextContent | AssistantThinkingContent | AssistantToolCall)[] = [];

    // Process output items
    if (response.output) {
        for (const item of response.output) {
            if (item.type === 'reasoning' && item.summary) {
                // Convert reasoning to thinking content
                const thinkingText = item.summary.map(s => s.text).join('\n\n');
                content.push({
                    type: 'thinking',
                    thinking: thinkingText
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
                    content.push({
                        type: 'text',
                        text: textContent
                    });
                }
            } else if (item.type === 'function_call') {
                // Convert function call to tool call
                content.push({
                    type: 'toolCall',
                    id: item.call_id,
                    name: item.name,
                    arguments: JSON.parse(item.arguments || '{}')
                });
            }
        }
    }

    // Extract usage information
    const cachedTokens = response.usage?.input_tokens_details?.cached_tokens || 0;
    const usage: Usage = {
        input: (response.usage?.input_tokens || 0) - cachedTokens,
        output: response.usage?.output_tokens || 0,
        cacheRead: cachedTokens,
        cacheWrite: 0,
        totalTokens: response.usage?.total_tokens || 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    };

    // Calculate costs
    calculateCost(model, usage);

    // Map stop reason
    let stopReason: StopReason = 'stop';
    if (response.status === 'completed') {
        stopReason = 'stop';
    } else if (response.status === 'incomplete') {
        stopReason = 'length';
    } else if (response.status === 'failed' || response.status === 'cancelled') {
        stopReason = 'error';
    }

    // Check if there are tool calls
    if (content.some(c => c.type === 'toolCall') && stopReason === 'stop') {
        stopReason = 'toolUse';
    }

    const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content,
        api: 'openai' as Api,
        model: response.model || model.id,
        usage,
        stopReason,
        timestamp: Date.now()
    };

    // Add error message if status is failed
    if (response.error) {
        assistantMessage.errorMessage = response.error.message || 'Unknown error';
    }

    return assistantMessage;
}

/**
 * Converts a Google native response message to the standardized AssistantMessage format
 * @param nativeMessage - The native Google message with _provider and response data
 * @param model - The model configuration for cost calculation
 * @returns AssistantMessage - Standardized assistant message
 */
export function convertGoogleNativeToAssistantMessage(
    nativeMessage: NativeGoogleMessage,
    model: Model<'google'>
): AssistantMessage {
    const response = nativeMessage.message;
    const content: (AssistantTextContent | AssistantThinkingContent | AssistantToolCall)[] = [];

    let finishReason: FinishReason | undefined;

    // Process candidates
    if (response.candidates) {
        for (const candidate of response.candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    // Handle text parts (thinking or regular text)
                    if (part.text !== undefined) {
                        const isThinking = part.thought === true;

                        if (isThinking) {
                            content.push({
                                type: 'thinking',
                                thinking: part.text
                            });
                        } else {
                            content.push({
                                type: 'text',
                                text: part.text
                            });
                        }
                    }

                    // Handle function calls
                    if (part.functionCall) {
                        const toolCallId = part.functionCall.id ||
                            `${part.functionCall.name}_${Date.now()}_${Math.random()}`;

                        content.push({
                            type: 'toolCall',
                            id: toolCallId,
                            name: part.functionCall.name || '',
                            arguments: part.functionCall.args as Record<string, any> || {}
                        });
                    }
                }
            }

            // Capture finish reason from first candidate
            if (candidate.finishReason && !finishReason) {
                finishReason = candidate.finishReason;
            }
        }
    }

    // Extract usage information
    const usage: Usage = {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: (response.usageMetadata?.candidatesTokenCount || 0) +
                (response.usageMetadata?.thoughtsTokenCount || 0),
        cacheRead: response.usageMetadata?.cachedContentTokenCount || 0,
        cacheWrite: 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    };

    // Calculate costs
    calculateCost(model, usage);

    // Map stop reason
    let stopReason: StopReason = 'stop';
    if (finishReason) {
        stopReason = mapGoogleFinishReason(finishReason);
    }

    // Check if there are tool calls
    if (content.some(c => c.type === 'toolCall')) {
        stopReason = 'toolUse';
    }

    const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content,
        api: 'google-generative-ai' as Api,
        model: model.id,
        usage,
        stopReason,
        timestamp: Date.now()
    };

    return assistantMessage;
}

/**
 * Helper function to map Google FinishReason to StopReason
 */
function mapGoogleFinishReason(reason: FinishReason): StopReason {
    switch (reason) {
        case FinishReason.STOP:
            return 'stop';
        case FinishReason.MAX_TOKENS:
            return 'length';
        case FinishReason.BLOCKLIST:
        case FinishReason.PROHIBITED_CONTENT:
        case FinishReason.SPII:
        case FinishReason.SAFETY:
        case FinishReason.IMAGE_SAFETY:
        case FinishReason.IMAGE_PROHIBITED_CONTENT:
        case FinishReason.RECITATION:
        case FinishReason.FINISH_REASON_UNSPECIFIED:
        case FinishReason.OTHER:
        case FinishReason.LANGUAGE:
        case FinishReason.MALFORMED_FUNCTION_CALL:
        case FinishReason.UNEXPECTED_TOOL_CALL:
        case FinishReason.NO_IMAGE:
            return 'error';
        default:
            return 'error';
    }
}

/**
 * Converts a native provider message to the standardized AssistantMessage format
 * Automatically detects the provider from the _provider tag and calls the appropriate converter
 * @param nativeMessage - The native message from any provider
 * @param model - The model configuration for cost calculation
 * @returns AssistantMessage - Standardized assistant message
 */
export function convertNativeToAssistantMessage(
    nativeMessage: NativeAssistantMessage,
    model: Model<any>
): AssistantMessage {
    if (nativeMessage._provider === 'openai') {
        return convertOpenAINativeToAssistantMessage(nativeMessage, model as Model<'openai'>);
    } else if (nativeMessage._provider === 'google') {
        return convertGoogleNativeToAssistantMessage(nativeMessage, model as Model<'google'>);
    } else {
        throw new Error(`Unknown provider: ${(nativeMessage as any)._provider}`);
    }
}