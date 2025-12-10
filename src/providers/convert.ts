import { Context, Model, Tool } from "../types";
import { ResponseInput, ResponseInputItem, ResponseInputMessageContentList, ResponseInputImage, ResponseInputFile, ResponseInputText, ResponseFunctionCallOutputItemList } from "openai/resources/responses/responses.js";
import { sanitizeSurrogates } from "../utils/sanitize-unicode";
import { ContentListUnion, Part } from "@google/genai";

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
                if(messageContent.type === 'image'){
                    parts.push({
                        inlineData: {
                            mimeType: messageContent.mimeType,
                            data: messageContent.data
                        }
                    })
                }
                if(messageContent.type === 'file'){
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
                if(messageContent.type === 'image'){
                    parts.push({
                        inlineData: {
                            mimeType: messageContent.mimeType,
                            data: messageContent.data
                        }
                    })
                }
                if(messageContent.type === 'file'){
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