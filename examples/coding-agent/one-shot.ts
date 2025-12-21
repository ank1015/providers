import { appendFile } from "fs/promises";
import { Conversation } from "../../src/agent/conversation.js";
import type { AgentEvent, Provider } from "../../src/agent/types.js";
import type { Api, Message } from "../../src/types.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createCodingTools } from "./tools/index.js";
import { getModel } from "../../src/models.js";
import { GoogleThinkingLevel } from "../../src/index.js";

export interface OneShotOptions {
	workingDirectory: string;
	prompt: string;
	provider: Provider<Api>;
	systemPrompt?: string;
	saveMessagesPath?: string;
	saveEventsPath?: string;
}

/**
 * Execute a one-shot coding agent task.
 *
 * @param options - Configuration options for the one-shot execution
 * @returns Promise resolving to the array of messages from the conversation
 */
export async function oneShot(options: OneShotOptions): Promise<Message[]> {
	const { workingDirectory, prompt, provider, systemPrompt, saveMessagesPath, saveEventsPath } = options;

	// Create tools for the working directory
	const { allTools } = createCodingTools(workingDirectory);

	// Build system prompt (use provided or generate default)
	const finalSystemPrompt = systemPrompt ?? buildSystemPrompt(workingDirectory);

	// Create conversation with initial state
	const conversation = new Conversation({
		initialState: {
			provider,
			tools: allTools as any,
			systemPrompt: finalSystemPrompt,
		},
	});

	// Collect events if we need to save them
	const events: AgentEvent[] = [];
	if (saveEventsPath) {
		conversation.subscribe((event) => {
			events.push(event);
		});
	}

	// Execute the prompt
	const messages = await conversation.prompt(prompt);

	// Save messages if path provided
	if (saveMessagesPath) {
		const messagesJson = JSON.stringify(conversation.state.messages, null, 2);
		await appendFile(saveMessagesPath, `\n${messagesJson}\n`, "utf-8");
	}

	// Save events if path provided
	if (saveEventsPath) {
		const eventsJson = JSON.stringify(events, null, 2);
		await appendFile(saveEventsPath, `\n${eventsJson}\n`, "utf-8");
	}

	return messages;
}