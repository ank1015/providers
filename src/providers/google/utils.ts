import { Model, AssistantResponse, StopReason, Usage, Context, BaseAssistantMessage, Tool } from "../../types.js";
import { GenerateContentConfig, GenerateContentResponse, GoogleGenAI, FinishReason, GenerateContentParameters, ToolListUnion, ContentListUnion, Part } from "@google/genai";
import { calculateCost } from "../../models.js";
import { GoogleProviderOptions } from "./types.js";
import { sanitizeSurrogates } from "../../utils/sanitize-unicode.js";
import type { TSchema } from "@sinclair/typebox";


export function createClient(model: Model<"google">, apiKey?: string): GoogleGenAI {
	if (!apiKey) {
		if (!process.env.GEMINI_API_KEY) {
			throw new Error(
				"Gemini API key is required. Set GEMINI_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.GEMINI_API_KEY;
	}
	return new GoogleGenAI({
		apiKey,
		httpOptions: model.headers ? { headers: model.headers } : undefined,
	});
}

export function getResponseAssistantResponse(response: GenerateContentResponse): AssistantResponse{
    const assistantResponse: AssistantResponse = [];

    // Process candidates
    if (response.candidates) {
        for (const candidate of response.candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    // Handle text parts (thinking or regular text)
                    if (part.text !== undefined) {
                        const isThinking = part.thought === true;

                        if (isThinking) {
                            assistantResponse.push({
                                type: 'thinking',
                                thinkingText: part.text
                            });
                        } else {
                            assistantResponse.push({
                                type: 'response',
                                content: [{type: 'text', content: part.text}]
                            });
                        }
                    }

                    if(part.inlineData){
                        const imageData = part.inlineData.data;
                        if(imageData){
                            assistantResponse.push({
                                type: 'response',
                                content: [{
                                    type: 'image',
                                    data: imageData,
                                    mimeType: part.inlineData.mimeType || 'image/png'
                                }]
                            })
                        }
                    }

                    // Handle function calls
                    if (part.functionCall) {
                        const toolCallId = part.functionCall.id ||
                            `${part.functionCall.name}_${Date.now()}_${Math.random()}`;

                        assistantResponse.push({
                            type: 'toolCall',
                            toolCallId: toolCallId,
                            name: part.functionCall.name || '',
                            arguments: part.functionCall.args as Record<string, any> || {}
                        });
                    }

                }
            }
        }
    }
    return assistantResponse
}

export function getAssistantStopReason(response: GenerateContentResponse): StopReason{

    let finishReason: FinishReason | undefined;

    if (response.candidates) {
        for (const candidate of response.candidates) {
            // Capture finish reason from first candidate
            if (candidate.finishReason && !finishReason) {
                finishReason = candidate.finishReason;
            }
        }
    }
    // Map stop reason
    let stopReason: StopReason = 'stop';
    if (finishReason) {
        stopReason = mapStopReason(finishReason);
    }
    return stopReason;
}

export function getResponseUsage(response: GenerateContentResponse, model: Model<'google'>): Usage{
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
    calculateCost(model, usage);
    return usage;
}

export function buildParams(model: Model<"google">, context: Context, options: GoogleProviderOptions){

    const contents = buildGoogleMessages(model, context);

	const {apiKey, signal, ...googleOptions} = options

	const config: GenerateContentConfig = {
		...googleOptions
	}

    if(options?.signal){
        config.abortSignal = options.signal;
    }

    if(context.systemPrompt){
        config.systemInstruction = sanitizeSurrogates(context.systemPrompt);
    }

    const tools: ToolListUnion = []

    if(context.tools && model.tools.includes('function_calling')){
        const convertedTools = convertTools(context.tools);
        for (const convertedTool of convertedTools){
            tools.push(convertedTool);
        }
    }

    if(googleOptions.tools){
        for (const optionTool of googleOptions.tools){
            tools.push(optionTool)
        }
    }

    if(tools.length > 0) config.tools = tools;

	const params: GenerateContentParameters = {
        model: model.id,
        contents,
        config
    };

    return params;
}

export function buildGoogleMessages(model: Model<'google'> ,context: Context): ContentListUnion{
    const contents: ContentListUnion = []

    for (let i=0; i< context.messages.length; i++){
        const message = context.messages[i];

        if(message.role === 'user'){
            const parts: Part[] = [];
            for(let p=0; p<message.content.length; p++){
                const messageContent = message.content[p];
                if(messageContent.type === 'text'){
                    parts.push({
                        text: sanitizeSurrogates(messageContent.content)
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
                                result: sanitizeSurrogates(textRes),
                                isError: message.isError
                            }
                        }
                    }
                ]
            })
        }

        if(message.role === 'assistant'){
            if(message.model.api === 'google'){
                const baseMessage = message as BaseAssistantMessage<'google'>
                if(baseMessage.message.candidates){
                    for(let p=0; p< baseMessage.message.candidates?.length; p++){
                        const candidate = baseMessage.message.candidates[p];
                        if(candidate.content){
                            contents.push(candidate.content)
                        }
                    }
                }
            }
            // TODO Implement other provider conversions
            else{
                throw new Error(
                    `Cannot convert ${message.model.api} assistant message to ${model.api} format. ` +
                    `Cross-provider conversion for ${message.model.api} → ${model.api} is not yet implemented.`
                );
            }
        }
    }
    return contents;
}

/**
 * JSON Schema type that can be primitives, objects, or arrays
 * Covers the recursive nature of JSON Schema structures
 */
type JSONSchemaValue = TSchema | { [key: string]: JSONSchemaValue } | JSONSchemaValue[] | string | number | boolean | null;

/**
 * Transforms a JSON Schema to Google's supported subset.
 * Main transformations:
 * - Converts { "const": "value" } to { "enum": ["value"] }
 * - Converts { "anyOf": [{ "const": "a" }, { "const": "b" }] } to { "enum": ["a", "b"] }
 * - Recursively processes nested objects and arrays
 */
export function transformSchemaForGoogle(schema: JSONSchemaValue): JSONSchemaValue {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	// Handle arrays
	if (Array.isArray(schema)) {
		return schema.map(transformSchemaForGoogle);
	}

	const transformed: Record<string, JSONSchemaValue> = {};

	// Handle const keyword - convert to enum
	if ('const' in schema) {
		transformed.enum = [schema.const];
		// Copy over other properties except const
		for (const key in schema) {
			if (key !== 'const') {
				transformed[key] = schema[key];
			}
		}
		return transformed;
	}

	// Handle anyOf with const values - convert to enum
	if ('anyOf' in schema && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
		const allConst = schema.anyOf.every((item: any) => item && typeof item === 'object' && 'const' in item);
		if (allConst) {
			// Extract all const values into a single enum
			transformed.enum = schema.anyOf.map((item: any) => item.const);
			// Copy over other properties from the parent schema
			for (const key in schema) {
				if (key !== 'anyOf') {
					transformed[key] = schema[key];
				}
			}
			// Copy type and other properties from the first anyOf item if not already set
			if (schema.anyOf.length > 0) {
				const firstItem = schema.anyOf[0];
				for (const key in firstItem) {
					if (key !== 'const' && !(key in transformed)) {
						transformed[key] = firstItem[key];
					}
				}
			}
			return transformed;
		}
	}

	// Recursively process all properties
	for (const key in schema) {
		if (key === 'properties' && typeof schema.properties === 'object') {
			// Recursively transform each property
			transformed.properties = {};
			for (const propKey in schema.properties) {
				transformed.properties[propKey] = transformSchemaForGoogle(schema.properties[propKey]);
			}
		} else if (key === 'items' && schema.items) {
			// Recursively transform array items schema
			transformed.items = transformSchemaForGoogle(schema.items);
		} else if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
			// Recursively transform union/intersection schemas
			transformed[key] = Array.isArray(schema[key])
				? schema[key].map(transformSchemaForGoogle)
				: transformSchemaForGoogle(schema[key]);
		} else {
			// Copy other properties as-is
			transformed[key] = schema[key];
		}
	}

	return transformed;
}

export function convertTools(tools: readonly Tool[]): any[] {
	return [
		{
			functionDeclarations: tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: transformSchemaForGoogle(tool.parameters),
			})),
		},
	];
}

export function mapStopReason(reason: FinishReason): StopReason {
	switch (reason) {
		case FinishReason.STOP:
			return "stop";
		case FinishReason.MAX_TOKENS:
			return "length";
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
			return "error";
		default: {
			const _exhaustive: never = reason;
			throw new Error(`Unhandled stop reason: ${_exhaustive}`);
		}
	}
}