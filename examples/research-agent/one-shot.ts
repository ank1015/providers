import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Conversation } from "../../src/agent/conversation.js";
import type { AgentEvent, Provider } from "../../src/agent/types.js";
import type { Api, Message } from "../../src/types.js";
import { generateUUID } from "../../src/utils/uuid.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createResearchTools } from "./tools/index.js";
import { getModel } from "../../src/models.js";
import { GoogleThinkingLevel } from "../../src/index.js";

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

export interface ResearchOneShotOptions {
	prompt: string;
	provider: Provider<Api>;
	systemPrompt?: string;
	saveLogs?: boolean;
}

/**
 * Execute a one-shot research agent task.
 *
 * @param options - Configuration options for the one-shot execution
 * @returns Promise resolving to the working directory path and messages
 */
export async function oneShot(options: ResearchOneShotOptions): Promise<{ workingDirectory: string; messages: Message[] }> {
	const { prompt, provider, systemPrompt, saveLogs = false } = options;

	// Generate session ID
	const sessionId = generateUUID();

	// Create temp working directory for the agent
	const workingDirectory = join(projectRoot, ".logs", "research", "temp", sessionId);
	await mkdir(workingDirectory, { recursive: true });

	// Create logs directory if saving is enabled
	let logsDirectory: string | undefined;
	if (saveLogs) {
		logsDirectory = join(projectRoot, ".logs", "research", "one-shot", sessionId);
		await mkdir(logsDirectory, { recursive: true });
	}

	// Create tools for the working directory
	const { researchTools } = createResearchTools(workingDirectory);

	// Build system prompt (use provided or generate default)
	const finalSystemPrompt = systemPrompt ?? buildSystemPrompt(workingDirectory);

	// Create conversation with initial state
	const conversation = new Conversation({
		initialState: {
			provider,
			tools: researchTools as any,
			systemPrompt: finalSystemPrompt,
		},
	});

	// Collect events if we need to save them
	const events: AgentEvent[] = [];
	if (saveLogs) {
		conversation.subscribe((event) => {
			events.push(event);
		});
	}

	// Execute the prompt
	const messages = await conversation.prompt(prompt);

	// Save logs if enabled
	if (saveLogs && logsDirectory) {
		// Save messages
		const messagesPath = join(logsDirectory, "messages.json");
		const messagesJson = JSON.stringify(conversation.state.messages, null, 2);
		await writeFile(messagesPath, messagesJson, "utf-8");

		// Save events
		const eventsPath = join(logsDirectory, "events.json");
		const eventsJson = JSON.stringify(events, null, 2);
		await writeFile(eventsPath, eventsJson, "utf-8");

		// Save session info
		const sessionInfoPath = join(logsDirectory, "session-info.json");
		const sessionInfo = {
			sessionId,
			timestamp: new Date().toISOString(),
			prompt,
			workingDirectory,
			logsDirectory,
			model: provider.model.id,
		};
		await writeFile(sessionInfoPath, JSON.stringify(sessionInfo, null, 2), "utf-8");

		console.log(`\nLogs saved to: ${logsDirectory}`);
	}

	console.log(`\nResearch workspace: ${workingDirectory}`);

	return {
		workingDirectory,
		messages,
	};
}