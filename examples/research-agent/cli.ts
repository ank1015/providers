import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Conversation } from "../../src/agent/conversation.js";
import type { AgentEvent } from "../../src/agent/types.js";
import type { Api, BaseAssistantEvent, Message } from "../../src/types.js";
import { MODELS } from "../../src/models.generated.js";
import { getModel } from "../../src/models.js";
import { generateUUID } from "../../src/utils/uuid.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createResearchTools } from "./tools/index.js";

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

// Default provider options for each API
const DEFAULT_PROVIDER_OPTIONS = {
	openai: {},
	google: {},
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
	white: "\x1b[37m",
};

function log(color: keyof typeof colors, label: string, message: string) {
	console.log(`${colors[color]}${label}:${colors.reset} ${message}`);
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

// Set up event handlers for displaying research activities
function setupEventHandlers(conversation: Conversation) {
	const events: AgentEvent[] = [];

	conversation.subscribe((event: AgentEvent) => {
		events.push(event);

		switch (event.type) {
			case "message_start":
				if (event.messageType === "user") {
					const userMsg = event.message as Message;
					if (userMsg.role === "user") {
						const textContent = userMsg.content.find((c) => c.type === "text");
						if (textContent && textContent.type === "text") {
							console.log(); // Add spacing before user message
							log("cyan", "User", textContent.content);
							console.log(); // Add spacing after user message
						}
					}
				}
				break;

			case "message_update":
				if (event.messageType === "assistant") {
					const assistantEvent = event.message as BaseAssistantEvent<Api>;

					switch (assistantEvent.type) {
						case "thinking_start":
							process.stdout.write(`${colors.dim}Thinking...${colors.reset} `);
							break;

						case "thinking_end":
							process.stdout.write("\n\n"); // Add spacing after thinking
							break;

						case "toolcall_end":
							const args = JSON.stringify(assistantEvent.toolCall.arguments);
							const preview = args.length > 100 ? args.substring(0, 100) + "..." : args;
							log("yellow", "Tool Request", `${assistantEvent.toolCall.name}(${preview})`);
							console.log(); // Add spacing after tool request
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
								console.log(); // Add spacing after assistant response
							}
						}
					}
				} else if (event.messageType === "toolResult") {
					const toolResultMsg = event.message as Message;
					if (toolResultMsg.role === "toolResult") {
						const resultText = toolResultMsg.content.find((c) => c.type === "text");
						if (resultText && resultText.type === "text") {
							const preview =
								resultText.content.length > 300
									? resultText.content.substring(0, 300) + "..."
									: resultText.content;
							const status = toolResultMsg.isError ? `${colors.red}ERROR${colors.reset}` : "OK";
							log("blue", `Tool [${toolResultMsg.toolName}]`, `${status}\n${colors.dim}${preview}${colors.reset}`);
							console.log(); // Add spacing after tool result
						}
					}
				}
				break;

			case "tool_execution_start":
				log("magenta", "Executing", `${event.toolName}...`);
				break;
		}
	});

	return events;
}

// Save session logs
async function saveLogs(
	logsDirectory: string,
	sessionId: string,
	workingDirectory: string,
	conversation: Conversation,
	events: AgentEvent[],
	modelId: string,
) {
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
		workingDirectory,
		logsDirectory,
		model: modelId,
		messageCount: conversation.state.messages.length,
	};
	await writeFile(sessionInfoPath, JSON.stringify(sessionInfo, null, 2), "utf-8");
}

// Main chat loop
async function chatLoop(
	conversation: Conversation,
	workingDirectory: string,
	logsDirectory: string,
	sessionId: string,
	modelId: string,
	events: AgentEvent[],
) {
	const rl = readline.createInterface({
		input,
		output,
		prompt: `\n${colors.bright}Research:${colors.reset} `,
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

	console.log(`${colors.dim}Press ESC to abort during research, Ctrl+D to exit${colors.reset}`);
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
			console.log(); // Add spacing after response
		} catch (error) {
			if (error instanceof Error) {
				log("red", "Error", error.message);
			}
		}

		// Show prompt again for next input
		rl.prompt();
	});

	rl.on("close", async () => {
		console.log(`\n${colors.dim}Saving session...${colors.reset}`);

		// Save logs
		await saveLogs(logsDirectory, sessionId, workingDirectory, conversation, events, modelId);

		console.log(`${colors.green}Session saved!${colors.reset}`);
		console.log(`${colors.dim}Research files: ${workingDirectory}${colors.reset}`);
		console.log(`${colors.dim}Logs: ${logsDirectory}${colors.reset}`);
		console.log(`\n${colors.bright}Goodbye!${colors.reset}`);
		process.exit(0);
	});
}

// Main function
async function main() {
	console.log(`${colors.bright}Research Agent CLI${colors.reset}`);

	// Generate session ID
	const sessionId = generateUUID();

	// Create temp working directory
	const workingDirectory = join(projectRoot, ".logs", "research", "temp", sessionId);
	await mkdir(workingDirectory, { recursive: true });

	// Create logs directory
	const logsDirectory = join(projectRoot, ".logs", "research", "cli", sessionId);
	await mkdir(logsDirectory, { recursive: true });

	console.log(`${colors.dim}Session ID: ${sessionId}${colors.reset}`);
	console.log(`${colors.dim}Workspace: ${workingDirectory}${colors.reset}\n`);

	// Select model
	const { api, modelId } = await selectModel();
	const model = getModel(api, modelId as any);

	if (!model) {
		console.error(`${colors.red}Model not found: ${api}/${modelId}${colors.reset}`);
		process.exit(1);
	}

	// Create tools
	const { researchTools } = createResearchTools(workingDirectory);

	// Build system prompt
	const systemPrompt = buildSystemPrompt(workingDirectory);

	// Create conversation
	const conversation = new Conversation({
		initialState: {
			provider: {
				model,
				providerOptions: DEFAULT_PROVIDER_OPTIONS[api],
			},
			tools: researchTools as any,
			systemPrompt,
		},
	});

	// Set up event handlers and collect events
	const events = setupEventHandlers(conversation);

	// Start chat loop
	await chatLoop(conversation, workingDirectory, logsDirectory, sessionId, modelId, events);
}

// Run the CLI
main().catch((error) => {
	console.error(`${colors.red}Fatal error:${colors.reset}`, error);
	process.exit(1);
});
