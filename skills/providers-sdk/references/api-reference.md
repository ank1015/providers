# API Reference

## Table of Contents
- [Core Functions](#core-functions)
- [Type Definitions](#type-definitions)
- [Model Configuration](#model-configuration)
- [Usage & Cost Tracking](#usage--cost-tracking)

## Core Functions

### complete()

Non-streaming LLM completion.

```typescript
function complete<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: OptionsForApi<TApi>,
  id?: string
): Promise<BaseAssistantMessage<TApi>>
```

**Parameters:**
- `model`: Model configuration from `getModel()`
- `context`: Messages, system prompt, and tools
- `options`: Provider-specific options (apiKey, signal, etc.)
- `id`: Optional message ID (auto-generated if omitted)

**Example:**
```typescript
const model = getModel('anthropic', 'claude-sonnet-4-20250514');
const response = await complete(model, {
  messages: [
    { role: 'user', id: '1', content: [{ type: 'text', content: 'What is 2+2?' }] }
  ],
  systemPrompt: 'You are a math tutor.',
  tools: []
}, { apiKey: process.env.ANTHROPIC_API_KEY });

console.log(response.content); // AssistantResponse[]
console.log(response.usage.cost.total); // Cost in dollars
```

### stream()

Streaming LLM completion with async iteration.

```typescript
function stream<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: OptionsForApi<TApi>,
  id?: string
): AssistantMessageEventStream<TApi>
```

**Returns:** `AssistantMessageEventStream` - async iterable of events.

**Example:**
```typescript
const eventStream = stream(model, context, options);

// Iterate over events
for await (const event of eventStream) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_delta':
      console.log('[thinking]', event.delta);
      break;
    case 'toolcall_end':
      console.log('Tool called:', event.toolCall.name);
      break;
    case 'done':
      console.log('Finished:', event.reason);
      break;
    case 'error':
      console.error('Error:', event.reason);
      break;
  }
}

// Get final complete message
const finalMessage = await eventStream.result();
```

### getModel()

Retrieve a model configuration by API and model ID.

```typescript
function getModel<TApi extends Api>(
  api: TApi,
  modelId: ModelIdsForApi<TApi>
): Model<TApi> | undefined
```

**Example:**
```typescript
const claude = getModel('anthropic', 'claude-sonnet-4-20250514');
const gpt4 = getModel('openai', 'gpt-4o');
const gemini = getModel('google', 'gemini-2.0-flash');
```

### getApiKeyFromEnv()

Get API key from environment variable.

```typescript
function getApiKeyFromEnv(api: Api): string | undefined
```

## Type Definitions

### Context

Input context for LLM calls.

```typescript
interface Context {
  messages: Message[];
  systemPrompt?: string;
  tools?: Tool[];
}
```

### Message (Union Type)

```typescript
type Message = UserMessage | ToolResultMessage | BaseAssistantMessage<Api> | CustomMessage;
```

### UserMessage

```typescript
interface UserMessage {
  role: 'user';
  id: string;
  timestamp?: number;
  content: Content;
}
```

### ToolResultMessage

```typescript
interface ToolResultMessage<TDetails = any> {
  role: 'toolResult';
  id: string;
  toolName: string;
  toolCallId: string;
  content: Content;
  details?: TDetails;
  isError: boolean;
  error?: { message: string; name?: string; stack?: string };
  timestamp: number;
}
```

### BaseAssistantMessage

```typescript
interface BaseAssistantMessage<TApi extends Api> {
  role: 'assistant';
  message: NativeAssistantMessageForApi<TApi>; // Provider's native response
  api: string;
  id: string;
  model: Model<TApi>;
  errorMessage?: string;
  timestamp: number;
  duration: number;
  stopReason: StopReason;
  content: AssistantResponse; // Normalized response
  usage: Usage;
}
```

### Content

```typescript
type Content = (TextContent | ImageContent | FileContent)[];

interface TextContent {
  type: 'text';
  content: string;
  metadata?: Record<string, any>;
}

interface ImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
  metadata?: Record<string, any>;
}

interface FileContent {
  type: 'file';
  data: string; // base64
  mimeType: string;
  filename: string;
  metadata?: Record<string, any>;
}
```

### AssistantResponse

Normalized response from any provider.

```typescript
type AssistantResponse = (
  | AssistantResponseContent
  | AssistantThinkingContent
  | AssistantToolCall
)[];

interface AssistantResponseContent {
  type: 'response';
  content: Content;
}

interface AssistantThinkingContent {
  type: 'thinking';
  thinkingText: string;
}

interface AssistantToolCall {
  type: 'toolCall';
  name: string;
  arguments: Record<string, any>;
  toolCallId: string;
}
```

### StopReason

```typescript
type StopReason = 'stop' | 'length' | 'toolUse' | 'error' | 'aborted';
```

### Tool

Base tool definition for LLM function calling.

```typescript
interface Tool<TParameters extends TSchema = TSchema, TName extends string = string> {
  name: TName;
  description: string;
  parameters: TParameters; // TypeBox schema
}
```

## Model Configuration

### Model Interface

```typescript
interface Model<TApi extends Api> {
  id: string;
  name: string;
  api: TApi;
  baseUrl: string;
  reasoning: boolean;
  input: ('text' | 'image' | 'file')[];
  cost: {
    input: number;    // $/million tokens
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  tools: string[];
  excludeSettings?: string[];
}
```

### Available APIs

```typescript
const KnownApis = ['openai', 'google', 'deepseek', 'anthropic', 'zai', 'cerebras'] as const;
type Api = typeof KnownApis[number];
```

## Usage & Cost Tracking

### Usage Interface

```typescript
interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

### calculateCost()

```typescript
function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage['cost']
```

**Example:**
```typescript
const response = await complete(model, context);
console.log(`Total cost: $${response.usage.cost.total.toFixed(6)}`);
console.log(`Input tokens: ${response.usage.input}`);
console.log(`Output tokens: ${response.usage.output}`);
```

## Streaming Event Types

### BaseAssistantEvent

```typescript
type BaseAssistantEvent<TApi extends Api> =
  | { type: 'start'; message: BaseAssistantEventMessage<Api> }
  | { type: 'text_start'; contentIndex: number; message: BaseAssistantEventMessage<Api> }
  | { type: 'text_delta'; contentIndex: number; delta: string; message: BaseAssistantEventMessage<Api> }
  | { type: 'text_end'; contentIndex: number; content: Content; message: BaseAssistantEventMessage<Api> }
  | { type: 'thinking_start'; contentIndex: number; message: BaseAssistantEventMessage<Api> }
  | { type: 'thinking_delta'; contentIndex: number; delta: string; message: BaseAssistantEventMessage<Api> }
  | { type: 'thinking_end'; contentIndex: number; content: string; message: BaseAssistantEventMessage<Api> }
  | { type: 'toolcall_start'; contentIndex: number; message: BaseAssistantEventMessage<Api> }
  | { type: 'toolcall_delta'; contentIndex: number; delta: string; message: BaseAssistantEventMessage<Api> }
  | { type: 'toolcall_end'; contentIndex: number; toolCall: AssistantToolCall; message: BaseAssistantEventMessage<Api> }
  | { type: 'done'; reason: StopReason; message: BaseAssistantEventMessage<Api> }
  | { type: 'error'; reason: StopReason; message: BaseAssistantEventMessage<Api> };
```

### AssistantMessageEventStream

```typescript
class AssistantMessageEventStream<TApi extends Api>
  extends EventStream<BaseAssistantEvent<TApi>, BaseAssistantMessage<TApi>> {

  // Async iterate over events
  [Symbol.asyncIterator](): AsyncIterator<BaseAssistantEvent<TApi>>;

  // Get final complete message after iteration
  result(): Promise<BaseAssistantMessage<TApi>>;
}
```
