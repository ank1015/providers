import { appendFileSync } from "fs";
import { stream } from "./stream";
import { calculateTool } from "./agent/tools";
import { AgentContext, AgentLoopConfig } from "./agent/types";
import { getModel } from "./models";
import { Context, UserMessage } from "./types";
import { OpenAIProviderOptions } from "./providers/openai";
import { ThinkingLevel } from "@google/genai";

const main = async () => {
    
    const userMessage: UserMessage = {
        role: 'user',
        content: [{
            type: 'text', content: 'What do you think about the world?'
        }],
        timestamp: Date.now()
    }

    const context: Context = {
        systemPrompt: 'Be a helpful assistant',
        messages: [userMessage],
        tools: [calculateTool as any]
    }

    const model = getModel('google', 'gemini-3-pro-preview');

    // const providerOptions: OpenAIProviderOptions = {
    //     reasoning: {
    //         effort: 'high',
    //         summary: 'auto'
    //     }
    // }

    // const stream = agentLoop(userMessage, context, config);
    const events = stream(model, context, {
        thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
            includeThoughts: true
        }
    } );

    for await (const ev of events){
        appendFileSync('/Users/notacoder/Desktop/frontier-agents/providers/events.txt', JSON.stringify(ev, null, 2) + '\n' )
    }
    const result = await events.result();
    console.log(result)
}

main()