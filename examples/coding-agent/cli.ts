import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { appendFile, mkdir } from "fs/promises";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Conversation } from "../../src/agent/conversation.js";
import type { AgentEvent } from "../../src/agent/types.js";
import type { Api, BaseAssistantEvent, Message } from "../../src/types.js";
import { MODELS } from "../../src/models.generated.js";
import { getModel } from "../../src/models.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createCodingTools } from "./tools/index.js";
import { GoogleProviderOptions, GoogleThinkingLevel, OpenAIProviderOptions } from "../../src/index.js";

// Get project root directory (where package.json is)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");


const defaultOpenaiOptions: OpenAIProviderOptions = {
	reasoning: {
		summary: 'auto',
		effort: 'medium'
	}
}

const defaultGoogleOptions: GoogleProviderOptions = {
	thinkingConfig: {
		includeThoughts: true,
		thinkingLevel: GoogleThinkingLevel.HIGH
	}
}

// Default provider options for each API
const DEFAULT_PROVIDER_OPTIONS = {
	openai: defaultOpenaiOptions,
	google: defaultGoogleOptions,
};

// ANSI color codes
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	red: "\x1b[31m",
};

function log(color: keyof typeof colors, label: string, message: string) {
	console.log(`${colors[color]}${label}:${colors.reset} ${message}`);
}

// Ask for working directory
async function askForWorkingDirectory(): Promise<string> {
	const rl = readline.createInterface({ input, output });

	return new Promise((resolve) => {
		rl.question(`Working directory (default: ${process.cwd()}): `, (answer) => {
			const trimmed = answer.trim();
			rl.close();
			resolve(trimmed || process.cwd());
		});
	});
}

// Ask Yes/No question (Y is default)
async function askYesNo(question: string): Promise<boolean> {
	const rl = readline.createInterface({ input, output });

	return new Promise((resolve) => {
		rl.question(`${question} (Y/n): `, (answer) => {
			const trimmed = answer.trim().toLowerCase();
			rl.close();
			// Default to yes if empty, or if starts with 'y'
			resolve(trimmed === "" || trimmed.startsWith("y"));
		});
	});
}

// Display model selection menu
async function selectModel(): Promise<{ api: Api; modelId: string }> {
	console.log(`\n${colors.bright}Available Models:${colors.reset}\n`);

	const modelList: Array<{ api: Api; modelId: string; name: string }> = [];
	let index = 1;

	for (const [api, models] of Object.entries(MODELS)) {
		console.log(`${colors.cyan}${api.toUpperCase()}:${colors.reset}`);
		for (const [modelId, model] of Object.entries(models)) {
			console.log(`  ${index}. ${model.name} (${modelId})`);
			modelList.push({ api: api as Api, modelId, name: model.name });
			index++;
		}
		console.log();
	}

	const rl = readline.createInterface({ input, output });

	return new Promise((resolve) => {
		rl.question(`Select a model (1-${modelList.length}): `, (answer) => {
			const selection = parseInt(answer, 10) - 1;
			if (selection >= 0 && selection < modelList.length) {
				const selected = modelList[selection];
				console.log(`\n${colors.green}Selected: ${selected.name}${colors.reset}\n`);
				rl.close();
				resolve({ api: selected.api, modelId: selected.modelId });
			} else {
				console.log(`${colors.red}Invalid selection${colors.reset}`);
				rl.close();
				process.exit(1);
			}
		});
	});
}

// Set up event handlers for displaying messages
function setupEventHandlers(conversation: Conversation, collectEvents: boolean): AgentEvent[] {
	// Collect events if we need to save them
	const events: AgentEvent[] = [];

	conversation.subscribe((event: AgentEvent) => {
		if (collectEvents) {
			events.push(event);
		}

		switch (event.type) {
			case "message_start":
				if (event.messageType === "user") {
					const userMsg = event.message as Message;
					if (userMsg.role === "user") {
						const textContent = userMsg.content.find((c) => c.type === "text");
						if (textContent && textContent.type === "text") {
							log("cyan", "User", textContent.content);
							console.log(); // Empty line after user message
						}
					}
				}
				break;

			case "message_update":
				if (event.messageType === "assistant") {
					const assistantEvent = event.message as BaseAssistantEvent<Api>;

					switch (assistantEvent.type) {
						case "thinking_end":
							if (assistantEvent.content) {
								log("dim", "Thinking", assistantEvent.content.substring(0, 100) + "...");
								console.log(); // Empty line after thinking
							}
							break;

						case "toolcall_end":
							log(
								"yellow",
								"Requested Tool",
								`${assistantEvent.toolCall.name}(${JSON.stringify(assistantEvent.toolCall.arguments)})`,
							);
							console.log(); // Empty line after tool call
							break;
					}
				}
				break;

			case "message_end":
				if (event.messageType === "assistant") {
					const assistantMsg = event.message as Message;
					if (assistantMsg.role === "assistant") {
						// Display response content
						const responseContent = assistantMsg.content.find(
							(c) => c.type === "response" && c.content.some((cc) => cc.type === "text"),
						);
						if (responseContent && responseContent.type === "response") {
							const textContent = responseContent.content.find((c) => c.type === "text");
							if (textContent && textContent.type === "text") {
								log("green", "Assistant", textContent.content);
								console.log(); // Empty line after assistant response
							}
						}
					}
				} else if (event.messageType === "toolResult") {
					const toolResultMsg = event.message as Message;
					if (toolResultMsg.role === "toolResult") {
						const resultText = toolResultMsg.content.find((c) => c.type === "text");
						if (resultText && resultText.type === "text") {
							const preview =
								resultText.content.length > 200
									? resultText.content.substring(0, 200) + "..."
									: resultText.content;
							const status = toolResultMsg.isError ? `${colors.red}ERROR${colors.reset}` : "SUCCESS";
							log(
								"magenta",
								`Tool Result [${toolResultMsg.toolName}]`,
								`${status}\n${colors.dim}${preview}${colors.reset}`,
							);
							console.log(); // Empty line after tool result
						}
					}
				}
				break;

			case "tool_execution_start":
				log("blue", "Executing Tool", `${event.toolName}(${JSON.stringify(event.args)})`);
				console.log(); // Empty line after tool execution start
				break;
		}
	});

	return events;
}

// Main chat loop
async function chatLoop(
	conversation: Conversation,
	events: AgentEvent[],
	saveMessagesPath?: string,
	saveEventsPath?: string,
) {
	const rl = readline.createInterface({
		input,
		output,
		prompt: `\n${colors.bright}You:${colors.reset} `,
	});

	// Handle ESC key to abort
	if (input.isTTY) {
		input.setRawMode(true);
	}

	input.on("data", (key) => {
		// ESC key (27) or Ctrl+C
		if (key[0] === 27 || key[0] === 3) {
			if (conversation.state.isStreaming) {
				console.log(`\n${colors.red}Aborting...${colors.reset}`);
				conversation.abort();
			}
		}
	});

	console.log(`${colors.dim}Press ESC to abort during execution, Ctrl+D to exit${colors.reset}`);
	rl.prompt();

	rl.on("line", async (line) => {
		const prompt = line.trim();

		if (!prompt) {
			rl.prompt();
			return;
		}

		try {
			// Execute the prompt
			await conversation.prompt(prompt);

			// Save messages if path provided
			if (saveMessagesPath) {
				const messagesJson = JSON.stringify(conversation.state.messages, null, 2);
				await appendFile(saveMessagesPath, `\n${messagesJson}\n`, "utf-8");
			}

			// Save events if path provided
			if (saveEventsPath && events.length > 0) {
				const eventsJson = JSON.stringify(events, null, 2);
				await appendFile(saveEventsPath, `\n${eventsJson}\n`, "utf-8");
			}
		} catch (error) {
			if (error instanceof Error) {
				log("red", "Error", error.message);
				console.log();
			}
		}

		// Show prompt again for next input
		rl.prompt();
	});

	rl.on("close", () => {
		console.log(`\n${colors.dim}Goodbye!${colors.reset}`);
		process.exit(0);
	});
}

// Main function
async function main() {
	console.log(`${colors.bright}Coding Agent CLI${colors.reset}\n`);

	// Ask for working directory
	const workingDirectory = await askForWorkingDirectory();
	console.log(`${colors.dim}Working Directory: ${workingDirectory}${colors.reset}\n`);

	// Select model
	const { api, modelId } = await selectModel();
	const model = getModel(api, modelId as any);

	if (!model) {
		console.error(`${colors.red}Model not found: ${api}/${modelId}${colors.reset}`);
		process.exit(1);
	}

	// Ask if user wants to save messages and events
	const saveMessages = await askYesNo("Save messages?");
	const saveEvents = await askYesNo("Save events?");

	let saveMessagesPath: string | undefined;
	let saveEventsPath: string | undefined;

	// Create log directory structure if saving (in project root)
	if (saveMessages || saveEvents) {
		const sessionId = randomUUID();
		const logsDir = join(projectRoot, ".logs", "cli", sessionId);

		// Create directory
		await mkdir(logsDir, { recursive: true });

		if (saveMessages) {
			saveMessagesPath = join(logsDir, "result.txt");
			console.log(`${colors.dim}Messages will be saved to: ${saveMessagesPath}${colors.reset}`);
		}

		if (saveEvents) {
			saveEventsPath = join(logsDir, "events.txt");
			console.log(`${colors.dim}Events will be saved to: ${saveEventsPath}${colors.reset}`);
		}
		console.log();
	}

	// Create tools
	const { codingTools } = createCodingTools(workingDirectory);

	// Build system prompt
	const systemPrompt = buildSystemPrompt(workingDirectory);

	// Create conversation
	const conversation = new Conversation({
		initialState: {
			provider: {
				model,
				providerOptions: DEFAULT_PROVIDER_OPTIONS[api],
			},
			tools: codingTools as any,
			systemPrompt,
		},
	});

	// Set up event handlers and collect events if needed
	const events = setupEventHandlers(conversation, !!saveEventsPath);

	// Start chat loop
	await chatLoop(conversation, events, saveMessagesPath, saveEventsPath);
}

// Run the CLI
main().catch((error) => {
	console.error(`${colors.red}Fatal error:${colors.reset}`, error);
	process.exit(1);
});
