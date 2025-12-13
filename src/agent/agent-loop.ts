import { EventStream } from "../utils/event-stream";
import { UserMessage, Api, NativeAssistantMessage, Context, AssistantMessage, ToolResultMessage } from "../types";
import { AgentContext, AgentEvent, AgentLoopConfig, AgentTool, AgentToolResult, QueuedMessage } from "./types";
import { stream as streamLLM } from "../stream";
import { validateToolArguments } from "../utils/validation";

// Main prompt function - returns a stream of events
export function agentLoop<TApi extends Api>(
	prompt: UserMessage,
	context: AgentContext,
	config: AgentLoopConfig<TApi>,
	signal?: AbortSignal,
): EventStream<AgentEvent, AgentContext["messages"]> {

	// Convert AgentContext to Context for stream
	// Use a copy of messages to avoid mutating the original context
	const stream = new EventStream<AgentEvent, AgentContext["messages"]>();

	// Run the prompt async
	(async () => {
		// Add timestamp to prompt if not provided
		if (!prompt.timestamp) {
			prompt.timestamp = Date.now();
		}

		// Track new messages generated during this prompt
		const newMessages: AgentContext["messages"] = [];
		// Create user message for the prompt
		const messages = [...context.messages, prompt];
		newMessages.push(prompt);

		stream.push({ type: "agent_start" });

		// Track turn number
		let turnNumber = 0;

		stream.push({ type: "turn_start", turnNumber });
		stream.push({ type: "message_start", message: prompt });
		stream.push({ type: "message_end", message: prompt });

		// Update context with new messages
		const currentContext: AgentContext = {
			...context,
			messages,
		};

		// Keep looping while we have tool calls or queued messages
		let hasMoreToolCalls = true;
		let queuedMessages: QueuedMessage<any>[] = [];

		// Safely get queued messages, handling any errors
		try {
			queuedMessages = (await config.getQueuedMessages?.()) || [];
		} catch (error) {
			console.warn("Error getting queued messages:", error instanceof Error ? error.message : String(error));
			// Continue with empty queued messages
		}

		while (hasMoreToolCalls || queuedMessages.length > 0) {
			// Increment turn number for subsequent turns
			if (turnNumber > 0) {
				stream.push({ type: "turn_start", turnNumber });
			}

			// Process queued messages first (inject before next assistant response)
			if (queuedMessages.length > 0) {
				for (const { original, llm } of queuedMessages) {
					// Add timestamp to user messages if not provided
					if (original.role === 'user' && !original.timestamp) {
						original.timestamp = Date.now();
					}
					stream.push({ type: "message_start", message: original });
					stream.push({ type: "message_end", message: original });
					if (llm) {
						// Add timestamp to LLM message if it's a user message without timestamp
						if (llm.role === 'user' && !llm.timestamp) {
							llm.timestamp = Date.now();
						}
						currentContext.messages.push(llm);
						newMessages.push(llm);
					}
				}
				queuedMessages = [];
			}

			// Stream assistant response
			const {finalAssistantMessage, finalMessage} = await streamAssistantResponse(currentContext, config, signal, stream);
			newMessages.push(finalMessage);
			currentContext.messages.push(finalMessage);  // ✅ Add to context so LLM sees its previous responses!

			// Check if assistant message is valid
			if (!finalAssistantMessage) {
				// This should never happen, but handle it gracefully
				stream.push({ type: "turn_end", turnNumber, status: "error" });
				stream.push({ type: "agent_end", status: "error" });
				stream.end(newMessages);
				return;
			}

			if(finalAssistantMessage.stopReason === 'aborted' || finalAssistantMessage.stopReason === "error"){
				const status = finalAssistantMessage.stopReason === 'aborted' ? "aborted" : "error";
				stream.push({ type: "turn_end", turnNumber, status });
				stream.push({ type: "agent_end", status });
				stream.end(newMessages);
				return;
			}

			// Check for tool calls
			const toolCalls = finalAssistantMessage.content.filter((c) => c.type === "toolCall");
			hasMoreToolCalls = toolCalls.length > 0;

			let turnStatus: "completed" | "aborted" | "error" = "completed";
			if (hasMoreToolCalls) {
				// Execute tool calls
				const toolExecutionStatus = await executeToolCalls(currentContext.tools, finalAssistantMessage, signal, stream);
				currentContext.messages.push(...toolExecutionStatus.results);
				newMessages.push(...toolExecutionStatus.results);
				turnStatus = toolExecutionStatus.status;
			}

			stream.push({ type: "turn_end", turnNumber, status: turnStatus });

			// Only terminate on abort - tool errors should be sent back to LLM for handling
			if (turnStatus === "aborted") {
				stream.push({ type: "agent_end", status: "aborted" });
				stream.end(newMessages);
				return;
			}

			// If tool had error, the ToolResultMessage with isError=true is now in context
			// Loop will continue, LLM will see the error and can respond appropriately

			// Get queued messages after turn completes
			try {
				queuedMessages = (await config.getQueuedMessages?.()) || [];
			} catch (error) {
				console.warn("Error getting queued messages:", error instanceof Error ? error.message : String(error));
				queuedMessages = [];
			}

			// Increment turn number for next iteration
			turnNumber++;
		}
		stream.push({ type: "agent_end", status: "completed" });
		stream.end(newMessages);
	})()

	return stream;
}

interface StreamAssistantResult {
	finalMessage: NativeAssistantMessage,
	finalAssistantMessage: AssistantMessage
}

// Helper functions
async function streamAssistantResponse<TApi extends Api>(
	context: AgentContext,
	config: AgentLoopConfig<TApi>,
	signal: AbortSignal | undefined,
	stream: EventStream<AgentEvent, AgentContext["messages"]>,
): Promise<StreamAssistantResult> {

	// Convert AgentContext to Context for stream
	// Use a copy of messages to avoid mutating the original context

	let processedMessages: AgentContext["messages"];
	try {
		processedMessages = config.preprocessor
			? await config.preprocessor(context.messages, signal)
			: [...context.messages];
	} catch (error) {
		// Preprocessor error - create error assistant message
		const errorMessage: AssistantMessage = {
			role: "assistant",
			content: [{
				type: "text",
				text: `Preprocessor error: ${error instanceof Error ? error.message : String(error)}`
			}],
			api: config.model.api,
			model: config.model.id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
			},
			stopReason: "error",
			errorMessage: error instanceof Error ? error.message : String(error),
			timestamp: Date.now()
		};

		// Create a minimal native message for the error
		const errorNativeMessage: NativeAssistantMessage = {
			role: "assistant",
			_provider: config.model.api,
			message: {} as any,
			startTimestamp: Date.now(),
			endTimestamp: Date.now(),
			model: config.model as any,
			error: error instanceof Error ? {
				message: error.message,
				name: error.name,
				stack: error.stack
			} : { message: String(error) }
		}

		stream.push({ type: "message_start", message: errorMessage });
		stream.push({ type: "message_end", message: errorMessage });

		return { finalMessage: errorNativeMessage, finalAssistantMessage: errorMessage };
	}

	const processedContext: Context = {
		systemPrompt: context.systemPrompt,
		messages: [...processedMessages],
		tools: context.tools
	}

	const response = streamLLM(config.model, processedContext, {...config.providerOptions , signal});

	let partialMessage: AssistantMessage | null = null;
	let addedPartial = false;

	for await (const event of response) {
		switch (event.type) {
			case "start":
				partialMessage = event.partial;
				// context.messages.push(partialMessage);
				addedPartial = true;
				stream.push({ type: "message_start", message: { ...partialMessage } });
				break;

			case "text_start":
			case "text_delta":
			case "text_end":
			case "thinking_start":
			case "thinking_delta":
			case "thinking_end":
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				if (partialMessage) {
					partialMessage = event.partial;
					// context.messages[context.messages.length - 1] = partialMessage;
					stream.push({ type: "message_update", assistantMessageEvent: event });
				}
				break;

			case "done":
			case "error": {
				const finalAssistantMessage = event.type === 'error' ? event.error : event.message
				if (!addedPartial) {
					stream.push({ type: "message_start", message: { ...finalAssistantMessage } });
				}
				stream.push({ type: "message_end", message: finalAssistantMessage });

				const finalMessage = await response.result();
				return {finalMessage, finalAssistantMessage}
			}
		}
	}
	const finalMessage = await response.result();
	return {finalAssistantMessage: partialMessage!, finalMessage}
}

interface ExecuteToolCallsResult<T> {
	results: ToolResultMessage<T>[];
	status: "completed" | "aborted" | "error";
}

async function executeToolCalls<T>(
	tools: readonly AgentTool<any, T>[] | undefined,
	assistantMessage: AssistantMessage,
	signal: AbortSignal | undefined,
	stream: EventStream<AgentEvent, AgentContext["messages"]>,
): Promise<ExecuteToolCallsResult<T>> {

	const toolCalls = assistantMessage.content.filter((c) => c.type === "toolCall");
	const results: ToolResultMessage<any>[] = [];
	let overallStatus: "completed" | "aborted" | "error" = "completed";

	for (const toolCall of toolCalls) {
		const tool = tools?.find((t) => t.name === toolCall.name);

		stream.push({
			type: "tool_execution_start",
			toolCallId: toolCall.id!,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});
		let resultOrError: AgentToolResult<T> | string;
		let isError = false;
		let toolStatus: "completed" | "aborted" | "error" = "completed";

		let errorDetails: ToolResultMessage["error"] | undefined;

		try {
			if (!tool) {
				const availableTools = tools?.map((t) => t.name).join(", ") || "none";
				throw new Error(
					`Tool "${toolCall.name}" not found. Available tools: ${availableTools}`
				);
			}

			// Validate arguments using shared validation function
			const validatedArgs = validateToolArguments(tool, toolCall);

			// Execute with validated, typed arguments
			resultOrError = await tool.execute(toolCall.id!, validatedArgs, signal);
		} catch (e) {
			resultOrError = e instanceof Error ? e.message : String(e);
			isError = true;

			// Check if it was an abort
			if (e instanceof Error && e.name === "AbortError") {
				toolStatus = "aborted";
				overallStatus = "aborted";
			} else {
				toolStatus = "error";
				if (overallStatus === "completed") {
					overallStatus = "error";
				}
			}

			// Preserve full error details for debugging
			if (e instanceof Error) {
				errorDetails = {
					message: e.message,
					name: e.name,
					stack: e.stack,
				};
			}
		}

		stream.push({
			type: "tool_execution_end",
			toolCallId: toolCall.id!,
			status: toolStatus,
		});

		// Convert result to content blocks
		const content: ToolResultMessage<T>["content"] =
			typeof resultOrError === "string" ? [{ type: "text", content: resultOrError }] : resultOrError.content;

		const toolResultMessage: ToolResultMessage<T> = {
			role: "toolResult",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			content,
			details: typeof resultOrError === "string" ? ({} as T) : resultOrError.details,
			isError,
			error: errorDetails,
			timestamp: Date.now(),
		};

		results.push(toolResultMessage);
		stream.push({ type: "message_start", message: toolResultMessage });
		stream.push({ type: "message_end", message: toolResultMessage });
	}

	return { results, status: overallStatus };
}