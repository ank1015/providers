import { describe, it, expect } from 'vitest';
import { Conversation } from '../../../src/agent/conversation.js';
import { MODELS } from '../../../src/models.generated.js';
import { calculateTool } from '../../../src/agent/tools/calculate.js';

describe('Budget Integration', () => {
    it('should stop execution when cost limit is exceeded during tool loop', async () => {
        const conversation = new Conversation();
        const model = MODELS.google['gemini-3-flash-preview'];

        conversation.setProvider({
            model: model,
            providerOptions: {
                apiKey: process.env.GEMINI_API_KEY
            }
        });

        conversation.setTools([calculateTool as any]);

        // Set a limit that allows the first text response but likely fails on the tool call cost
        // Since we don't know the exact token count, we set a very low limit.
        // The first response will contain a tool call (calculator).
        // Usage will update -> Limit exceeded -> Has tool calls -> Throw.
        conversation.setCostLimit(0.00000001); 

        // "What is 15 * 4?" requires a tool call.
        await expect(conversation.prompt('What is 15 * 4? Use the calculator tool.'))
            .rejects
            .toThrow(/Cost limit exceeded/);

        // Verify usage was updated despite error
        expect(conversation.state.usage.totalCost).toBeGreaterThan(0);
    }, 60000);

    it('should NOT throw if limit exceeded on final response', async () => {
        const conversation = new Conversation();
        const model = MODELS.google['gemini-3-flash-preview'];

        conversation.setProvider({
            model: model,
            providerOptions: {
                apiKey: process.env.GEMINI_API_KEY
            }
        });

        // Set low limit
        conversation.setCostLimit(0.00000001);

        // Simple prompt, no tools. Should produce one response and stop.
        // Even though cost > limit, hasMoreActions is false (no tools, no queue), so it should NOT throw.
        const messages = await conversation.prompt('Just say hi');

        expect(messages.length).toBeGreaterThan(0);
        expect(conversation.state.usage.totalCost).toBeGreaterThan(conversation.getCostLimit()!);

        // BUT, next prompt should fail immediately because of pre-flight check
        await expect(conversation.prompt('Hi again'))
            .rejects
            .toThrow('Cost limit exceeded');
    }, 60000);
});
