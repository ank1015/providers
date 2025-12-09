// ============================================================================
// Main Functions
// ============================================================================
export { stream } from "./stream";
export { agentLoop } from "./agent/agent-loop";

// ============================================================================
// Core Types
// ============================================================================
export type {
	// Message types
	Message,
	UserMessage,
	ToolResultMessage,
	NativeAssistantMessage,
	NativeOpenAIMessage,

	// Content types
	UserTextContent,
	UserImageContent,
	UserFileContent,
	AssistantTextContent,
	AssistantThinkingContent,
	AssistantToolCall,
	AbstractedImageContent,

	// Context and Configuration
	Context,
	Tool,
	Api,
	Model,

	// Streaming types
	AssistantMessage,
	AssistantMessageEvent,
	Usage,
	StopReason,

	// Provider options
	OptionsForApi,
	StreamFunction,
} from "./types";

// ============================================================================
// Agent Types
// ============================================================================
export type {
	// Agent-specific types
	AgentContext,
	AgentTool,
	AgentToolResult,
	AgentEvent,
	AgentLoopConfig,
	QueuedMessage,
} from "./agent/types";

// ============================================================================
// Models and Registry
// ============================================================================
export { MODELS } from "./models.generated";
export { calculateCost } from "./models";

// ============================================================================
// Utilities
// ============================================================================
export { defineTool } from "./types";
export type { ToolName, ToolNames } from "./types";

// ============================================================================
// Event Streams
// ============================================================================
export { EventStream, AssistantMessageEventStream } from "./utils/event-stream";
