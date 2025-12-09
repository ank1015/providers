# @ank1015/providers

A provider abstraction layer for building agentic systems with multiple LLM providers. Built with a philosophy that **harnesses should be model-specific** while maintaining the ability to test and compose different models together.

This documentation is written by claude.

## Philosophy

This library is designed around a key insight: **effective AI systems should be built for specific models**, following their unique best practices and capabilities. However, practical development requires:

1. **Testing flexibility**: Try different models during development
2. **Multi-model systems**: Compose systems where different models work together
3. **Forking capability**: Convert state between providers when needed

We achieve this by:
- Storing **user messages** and **tool results** in a standardized format (can be built for any provider)
- Storing **assistant messages** in their **native provider format** (preserving caching, thinking traces, and internal state)
- Providing **standardized streaming** for UI display without losing provider-specific data

**This is NOT** about switching models mid-session (which loses critical state). It's about building provider-specific implementations while avoiding vendor lock-in during development. But the library still allows hand-offs mid conversation using conversion function that transform one provider messages to another.

## Features

- **🎯 Provider-Specific Implementations**: Each provider follows its own best practices
- **🔄 Unified Streaming API**: Standardized event stream across all providers
- **🤖 Agent Loop**: Multi-turn conversations with automatic tool execution
- **🛠️ Type-Safe Tools**: TypeBox-powered JSON Schema validation
- **💰 Cost Tracking**: Automatic token usage and cost calculation
- **⚡ Real-Time Streaming**: 21 granular event types for UI updates
- **🎨 Extended Thinking**: Support for reasoning/thinking modes

## Supported Providers

- **OpenAI**: GPT-5 series (Codex, Mini, Pro) with prompt caching and reasoning
- **Google**: Gemini 2.5 Flash, Gemini 3 Pro with extended thinking

## Installation

```bash
npm install @ank1015/providers
```

Set up your API keys:
```bash
export OPENAI_API_KEY="your-key"
export GEMINI_API_KEY="your-key"
```

## Quick Start

### Basic Streaming

```typescript
import { stream, MODELS } from "@ank1015/providers";

const context = {
  systemPrompt: "You are a helpful assistant.",
  messages: [
    {
      role: "user",
      content: [{ type: "text", content: "Hello!" }],
      timestamp: Date.now(),
    },
  ],
};

const response = stream(MODELS.OPENAI_GPT5_MINI, context);

for await (const event of response) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}

// Get the final native message (preserves provider-specific state)
const nativeMessage = await response.result();
```

### Agent Loop with Tools

```typescript
import { agentLoop, defineTool, MODELS } from "@ank1015/providers";
import { Type } from "@sinclair/typebox";

// Define tools with type-safe schemas
const tools = [
  defineTool({
    name: "calculator",
    description: "Perform mathematical calculations",
    parameters: Type.Object({
      expression: Type.String({ description: "Math expression to evaluate" }),
    }),
  }),
] as const;

// Create agent tools with execution logic
const agentTools = tools.map((tool) => ({
  ...tool,
  label: "Calculator",
  async execute(toolCallId, params, signal) {
    const result = eval(params.expression); // Use a safe eval in production!
    return {
      content: [{ type: "text", content: `Result: ${result}` }],
      details: { result },
    };
  },
}));

const context = {
  systemPrompt: "You are a helpful assistant with access to a calculator.",
  messages: [],
  tools: agentTools,
};

const prompt = {
  role: "user" as const,
  content: [{ type: "text" as const, content: "What is 156 * 234?" }],
  timestamp: Date.now(),
};

const config = {
  model: MODELS.OPENAI_GPT5_MINI,
  providerOptions: {},
};

const eventStream = agentLoop(prompt, context, config);

for await (const event of eventStream) {
  switch (event.type) {
    case "message_update":
      // Handle streaming assistant message
      console.log("Assistant:", event.message);
      break;
    case "tool_execution_start":
      console.log(`Executing tool: ${event.toolName}`);
      break;
    case "tool_execution_end":
      console.log(`Result:`, event.result);
      break;
    case "agent_end":
      console.log("Agent completed with status:", event.status);
      break;
  }
}

// Get all messages for conversation history
const allMessages = await eventStream.result();
```

### Working with Different Providers

```typescript
import { stream, MODELS } from "@ank1015/providers";

// OpenAI with reasoning
const openaiResponse = stream(MODELS.OPENAI_GPT5_MINI, context, {
  reasoning: {
    effort: "medium",
    summaryStyle: "concise",
  }
});

// Google with thinking
const googleResponse = stream(MODELS.GOOGLE_GEMINI_2_5_FLASH, context, {
  thinkingConfig: { extendedThinking: { level: "EXTENDED_THINKING_THINK_MODE" } },
  temperature: 0.7,
});

// Both return the same standardized stream format
for await (const event of openaiResponse) {
  // Handle events the same way regardless of provider
}
```

### Cost Tracking

```typescript
for await (const event of response) {
  if (event.type === "done") {
    const { usage } = event.message;
    console.log(`Tokens: ${usage.totalTokens}`);
    console.log(`Cost: $${usage.cost.total.toFixed(4)}`);
    console.log(`Input: ${usage.input} ($${usage.cost.input.toFixed(4)})`);
    console.log(`Output: ${usage.output} ($${usage.cost.output.toFixed(4)})`);
    if (usage.cacheRead > 0) {
      console.log(`Cache Read: ${usage.cacheRead} ($${usage.cost.cacheRead.toFixed(4)})`);
    }
  }
}
```

## Architecture

### Message Storage Strategy

```
User Message ────────> Assistant Message ────────> Tool Result
Standardized            Native Provider            Standardized
✓ Can rebuild           ✗ Store as-is              ✓ Can rebuild
```

- **User Messages** & **Tool Results**: Stored in standardized format, can be converted to any provider
- **Assistant Messages**: Stored in native provider format to preserve:
  - Prompt caching state
  - Thinking traces
  - Internal provider state
  - Response metadata

### Streaming Events

The library provides 21 event types for granular control:

```typescript
type AssistantMessageEvent =
  | { type: "start"; partial: AssistantMessage }
  | { type: "text_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
  | { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
  | { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "toolcall_end"; contentIndex: number; toolCall: AssistantToolCall; partial: AssistantMessage }
  | { type: "done"; reason: StopReason; message: AssistantMessage }
  | { type: "error"; reason: StopReason; error: AssistantMessage };
```

### Agent Loop Flow

```
Initial Prompt
    ↓
┌─────────────────────────┐
│  While tool calls exist:│
│  1. Stream response     │
│  2. Execute tools       │
│  3. Inject results      │
│  4. Repeat              │
└─────────────────────────┘
    ↓
Return all messages
```

The agent loop automatically handles multi-turn conversations with tool execution, preserving full conversation state.

## API Reference

### Core Functions

#### `stream(model, context, options)`

Stream an LLM response with standardized events.

- **model**: Model object from `MODELS` registry
- **context**: Conversation context with messages, system prompt, and tools
- **options**: Provider-specific options (apiKey, temperature, reasoning, etc.)
- **returns**: `AssistantMessageEventStream` (async iterable)

#### `agentLoop(prompt, context, config, signal)`

Run a multi-turn agent loop with automatic tool execution.

- **prompt**: Initial user message
- **context**: Agent context with messages, system prompt, and agent tools
- **config**: Configuration with model, provider options, and optional preprocessor
- **signal**: Optional AbortSignal for cancellation
- **returns**: `EventStream<AgentEvent>` (async iterable)

### Types

#### `Message`

Union type for all message types:
```typescript
type Message = UserMessage | NativeAssistantMessage | ToolResultMessage
```

#### `Tool`

Type-safe tool definition:
```typescript
interface Tool<TParameters extends TSchema = TSchema> {
  name: string;
  description: string;
  parameters: TParameters; // TypeBox JSON Schema
}
```

#### `AgentTool`

Extended tool with execution logic:
```typescript
interface AgentTool extends Tool {
  label: string;
  execute(
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal
  ): Promise<AgentToolResult>;
}
```

### Utilities

#### `defineTool(tool)`

Helper for creating tools with better type inference:
```typescript
const tool = defineTool({
  name: "search",
  description: "Search the web",
  parameters: Type.Object({
    query: Type.String(),
  }),
});
```

#### `calculateCost(model, usage)`

Calculate costs based on token usage:
```typescript
import { calculateCost, MODELS } from "@ank1015/providers";

const usage = {
  input: 1000,
  output: 500,
  cacheRead: 200,
  cacheWrite: 0,
  totalTokens: 1700,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

calculateCost(MODELS.OPENAI_GPT5_MINI, usage);
console.log(usage.cost.total); // Calculated cost in USD
```

## Provider-Specific Features

### OpenAI

```typescript
stream(MODELS.OPENAI_GPT5_MINI, context, {
  reasoning: {
    effort: "low" | "medium" | "high",
    summaryStyle: "concise" | "detailed",
  },
  parallelToolCalls: true,
  prompt_cache_key: "unique-cache-key",
  promptCacheRetention: "in-memory" | "24h",
  maxOutputTokens: 4096,
  temperature: 0.7,
});
```

### Google

```typescript
stream(MODELS.GOOGLE_GEMINI_2_5_FLASH, context, {
  thinkingConfig: {
    extendedThinking: {
      level: "EXTENDED_THINKING_THINK_MODE",
    },
  },
  responseMimeType: "application/json",
  imageConfig: {
    aspectRatio: "ASPECT_RATIO_16_9",
    size: "LARGE",
  },
  maxOutputTokens: 8192,
  temperature: 0.7,
});
```

## Design Principles

1. **Model-Specific Best Practices**: Each provider implementation follows the provider's recommended patterns
2. **State Preservation**: Native assistant messages preserve all provider-specific state
3. **Type Safety**: TypeBox schemas provide compile-time and runtime validation
4. **Stream-First**: All operations are async and support real-time updates
5. **Cost Transparency**: Every response includes detailed token usage and costs
6. **Graceful Degradation**: Validation falls back gracefully in restricted environments
7. **Developer Experience**: Rich type inference and autocomplete support

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm run test

# Lint and type check
npm run check
```

## Project Structure

```
src/
├── index.ts                 # Main exports
├── types.ts                 # Core type definitions
├── stream.ts                # Provider routing
├── models.ts                # Cost calculation
├── models.generated.ts      # Model registry
├── agent/
│   ├── agent-loop.ts       # Multi-turn agent orchestration
│   └── types.ts            # Agent-specific types
├── providers/
│   ├── openai.ts           # OpenAI implementation
│   ├── google.ts           # Google implementation
│   └── convert.ts          # Message format conversion
└── utils/
    ├── event-stream.ts     # Async event streaming
    ├── validation.ts       # Tool argument validation
    ├── json-parse.ts       # Streaming JSON parser
    └── sanitize-unicode.ts # Unicode sanitization
```

## Why This Architecture?

Traditional LLM abstraction layers try to make all models interchangeable, leading to:
- Lost provider-specific features (caching, thinking traces)
- Lowest-common-denominator APIs
- Poor utilization of each model's strengths

Our approach:
- ✅ Build provider-specific implementations following best practices
- ✅ Preserve native state for optimal performance
- ✅ Provide standardized interfaces for development flexibility
- ✅ Enable model composition without forcing model switching
- ✅ Support forking/conversion when truly needed

The result: **You get the best of both worlds** - full provider capabilities without vendor lock-in.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

---

**Built for developers who want to harness the full power of frontier models without sacrificing flexibility.**
