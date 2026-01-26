# Types Reference

Complete type definitions for constructing messages, parsing responses, and working with the SDK.

## Table of Contents
- [Message Types](#message-types)
- [Content Types](#content-types)
- [Assistant Response Types](#assistant-response-types)
- [Tool Types](#tool-types)
- [Agent Types](#agent-types)
- [Streaming Types](#streaming-types)
- [Model & Provider Types](#model--provider-types)
- [Usage Types](#usage-types)

---

## Message Types

### Message (Union)

```typescript
type Message = UserMessage | ToolResultMessage | BaseAssistantMessage<Api> | CustomMessage;
```

### UserMessage

User input with text, images, or files.

```typescript
interface UserMessage {
  role: 'user';
  id: string;
  timestamp?: number;
  content: Content;
}
```

**Construction Example:**
```typescript
const userMessage: UserMessage = {
  role: 'user',
  id: 'msg-001',
  timestamp: Date.now(),
  content: [
    { type: 'text', content: 'Analyze this image' },
    { type: 'image', data: base64Data, mimeType: 'image/png' }
  ]
};
```

### ToolResultMessage

Result from tool execution, sent back to LLM.

```typescript
interface ToolResultMessage<TDetails = any> {
  role: 'toolResult';
  id: string;
  toolName: string;
  toolCallId: string;      // Links to AssistantToolCall.toolCallId
  content: Content;        // Result visible to LLM
  details?: TDetails;      // App metadata (NOT sent to LLM)
  isError: boolean;
  error?: {
    message: string;
    name?: string;
    stack?: string;
  };
  timestamp: number;
}
```

**Construction Example:**
```typescript
const toolResult: ToolResultMessage<{ source: string }> = {
  role: 'toolResult',
  id: 'result-001',
  toolCallId: 'call-abc123',  // Must match the tool call
  toolName: 'search',
  content: [{ type: 'text', content: 'Found 10 results for query' }],
  details: { source: 'google' },
  isError: false,
  timestamp: Date.now()
};
```

**Error Example:**
```typescript
const errorResult: ToolResultMessage = {
  role: 'toolResult',
  id: 'result-002',
  toolCallId: 'call-xyz789',
  toolName: 'fetch_data',
  content: [{ type: 'text', content: 'Failed to fetch: timeout' }],
  isError: true,
  error: {
    message: 'Request timed out after 30s',
    name: 'TimeoutError'
  },
  timestamp: Date.now()
};
```

### BaseAssistantMessage

LLM response with both native and normalized formats.

```typescript
interface BaseAssistantMessage<TApi extends Api> {
  role: 'assistant';
  message: NativeAssistantMessageForApi<TApi>; // Provider's raw response
  api: string;
  id: string;
  model: Model<TApi>;
  errorMessage?: string;
  timestamp: number;
  duration: number;        // Response time in ms
  stopReason: StopReason;
  content: AssistantResponse;  // Normalized response
  usage: Usage;
}
```

**Parsing Example:**
```typescript
const response: BaseAssistantMessage<'anthropic'> = await complete(model, context);

// Access normalized content (works across all providers)
for (const block of response.content) {
  if (block.type === 'response') {
    console.log('Text:', block.content[0].content);
  } else if (block.type === 'thinking') {
    console.log('Thinking:', block.thinkingText);
  } else if (block.type === 'toolCall') {
    console.log('Tool:', block.name, block.arguments);
  }
}

// Access provider-native response (Anthropic-specific fields)
console.log('Native:', response.message);

// Check stop reason
if (response.stopReason === 'toolUse') {
  // Handle tool calls
}
```

### CustomMessage

Application-specific metadata (not sent to LLM).

```typescript
interface CustomMessage {
  role: 'custom';
  id: string;
  content: Record<string, any>;
  timestamp?: number;
}
```

**Example:**
```typescript
const bookmark: CustomMessage = {
  role: 'custom',
  id: 'custom-001',
  content: {
    type: 'bookmark',
    label: 'Important conversation point',
    tags: ['review', 'follow-up']
  },
  timestamp: Date.now()
};
```

### StopReason

Why the LLM stopped generating.

```typescript
type StopReason = 'stop' | 'length' | 'toolUse' | 'error' | 'aborted';
```

| Value | Meaning |
|-------|---------|
| `'stop'` | Natural completion |
| `'length'` | Hit max tokens |
| `'toolUse'` | Wants to call tools |
| `'error'` | Error occurred |
| `'aborted'` | Cancelled by user |

---

## Content Types

### Content (Array)

```typescript
type Content = (TextContent | ImageContent | FileContent)[];
```

### TextContent

```typescript
interface TextContent {
  type: 'text';
  content: string;
  metadata?: Record<string, any>;
}
```

**Example:**
```typescript
const text: TextContent = {
  type: 'text',
  content: 'Hello, how can I help you?',
  metadata: { source: 'greeting' }
};
```

### ImageContent

```typescript
interface ImageContent {
  type: 'image';
  data: string;        // Base64 encoded
  mimeType: string;    // 'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  metadata?: Record<string, any>;
}
```

**Example:**
```typescript
import fs from 'fs';

const imageData = fs.readFileSync('photo.png').toString('base64');
const image: ImageContent = {
  type: 'image',
  data: imageData,
  mimeType: 'image/png',
  metadata: { filename: 'photo.png', width: 800, height: 600 }
};
```

### FileContent

```typescript
interface FileContent {
  type: 'file';
  data: string;        // Base64 encoded
  mimeType: string;    // 'application/pdf', 'text/plain', etc.
  filename: string;
  metadata?: Record<string, any>;
}
```

**Example:**
```typescript
const pdfData = fs.readFileSync('document.pdf').toString('base64');
const file: FileContent = {
  type: 'file',
  data: pdfData,
  mimeType: 'application/pdf',
  filename: 'document.pdf',
  metadata: { pages: 10 }
};
```

---

## Assistant Response Types

### AssistantResponse (Array)

Normalized response from any provider.

```typescript
type AssistantResponse = (
  | AssistantResponseContent
  | AssistantThinkingContent
  | AssistantToolCall
)[];
```

### AssistantResponseContent

Text/media response from LLM.

```typescript
interface AssistantResponseContent {
  type: 'response';
  content: Content;
}
```

**Parsing:**
```typescript
const textBlocks = response.content
  .filter(c => c.type === 'response')
  .flatMap(c => c.content)
  .filter(c => c.type === 'text')
  .map(c => c.content)
  .join('');
```

### AssistantThinkingContent

Extended thinking/reasoning (Claude, o1, Gemini 2.0, etc.).

```typescript
interface AssistantThinkingContent {
  type: 'thinking';
  thinkingText: string;
}
```

**Parsing:**
```typescript
const thinking = response.content
  .filter(c => c.type === 'thinking')
  .map(c => c.thinkingText)
  .join('\n');

if (thinking) {
  console.log('Model reasoning:', thinking);
}
```

### AssistantToolCall

Request to execute a tool.

```typescript
interface AssistantToolCall {
  type: 'toolCall';
  name: string;
  arguments: Record<string, any>;
  toolCallId: string;
}
```

**Parsing:**
```typescript
const toolCalls = response.content.filter(c => c.type === 'toolCall');

for (const call of toolCalls) {
  console.log(`Tool: ${call.name}`);
  console.log(`Args: ${JSON.stringify(call.arguments)}`);
  console.log(`ID: ${call.toolCallId}`);  // Use this in ToolResultMessage
}
```

---

## Tool Types

### Tool (Base)

Basic tool definition for LLM.

```typescript
interface Tool<TParameters extends TSchema = TSchema, TName extends string = string> {
  name: TName;
  description: string;
  parameters: TParameters;  // TypeBox schema
}
```

### AgentTool (Extended)

Tool with execution capability.

```typescript
interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any>
  extends Tool<TParameters> {
  label: string;
  execute: (
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<TDetails>,
    context?: ToolExecutionContext
  ) => Promise<AgentToolResult<TDetails>>;
}
```

### AgentToolResult

What tools return.

```typescript
interface AgentToolResult<TDetails = any> {
  content: Content;    // Sent to LLM
  details: TDetails;   // App metadata (NOT sent to LLM)
}
```

**Example:**
```typescript
const result: AgentToolResult<{ queryTime: number }> = {
  content: [
    { type: 'text', content: 'Found 5 matching documents' }
  ],
  details: {
    queryTime: 150  // ms - for app analytics, not LLM
  }
};
```

### AgentToolUpdateCallback

For streaming tool progress.

```typescript
type AgentToolUpdateCallback<TDetails = any> = (
  partialResult: AgentToolResult<TDetails>
) => void;
```

### ToolExecutionContext

Read-only conversation access for tools.

```typescript
interface ToolExecutionContext {
  messages: readonly Message[];
}
```

---

## Agent Types

### AgentState

Full conversation state.

```typescript
interface AgentState {
  systemPrompt?: string;
  provider: Provider<Api>;
  messages: Message[];
  tools: AgentTool[];
  isStreaming: boolean;
  pendingToolCalls: Set<string>;
  error?: string;
  usage: {
    totalTokens: number;
    totalCost: number;
    lastInputTokens: number;
  };
  costLimit?: number;
  contextLimit?: number;
}
```

### AgentEvent

Events emitted during execution.

```typescript
type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start' }
  | { type: 'message_start'; messageType: string; messageId: string; message: Message }
  | { type: 'message_update'; messageType: string; messageId: string; message: Message }
  | { type: 'message_end'; messageType: string; messageId: string; message: Message }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: any }
  | { type: 'tool_execution_update'; toolCallId: string; toolName: string; args: any; partialResult: AgentToolResult<any> }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; result: AgentToolResult<any>; isError: boolean }
  | { type: 'turn_end' }
  | { type: 'agent_end'; agentMessages: Message[] };
```

**Handling Events:**
```typescript
conversation.subscribe((event) => {
  switch (event.type) {
    case 'message_update':
      if (event.messageType === 'assistant') {
        // Stream assistant response to UI
        const msg = event.message as BaseAssistantMessage<Api>;
        const text = msg.content
          .filter(c => c.type === 'response')
          .flatMap(c => c.content)
          .filter(c => c.type === 'text')
          .map(c => c.content)
          .join('');
        updateUI(text);
      }
      break;
    case 'tool_execution_start':
      showToolIndicator(event.toolName);
      break;
    case 'agent_end':
      // All new messages from this turn
      saveMessages(event.agentMessages);
      break;
  }
});
```

### QueuedMessage

For message injection.

```typescript
interface QueuedMessage<TApp = Message> {
  original: TApp;     // For UI/storage
  llm?: Message;      // Transformed for LLM (optional)
}
```

### Provider

Model + options bundle.

```typescript
interface Provider<TApi extends Api> {
  model: Model<TApi>;
  providerOptions: OptionsForApi<TApi>;
}
```

---

## Streaming Types

### BaseAssistantEvent

Events during streaming.

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

### BaseAssistantEventMessage

Partial message during streaming (no native `message` field).

```typescript
type BaseAssistantEventMessage<TApi extends Api> = Omit<BaseAssistantMessage<TApi>, 'message'>;
```

### Streaming Pattern

```typescript
const stream = stream(model, context, options);

let fullText = '';
let thinking = '';
const toolCalls: AssistantToolCall[] = [];

for await (const event of stream) {
  switch (event.type) {
    case 'text_delta':
      fullText += event.delta;
      process.stdout.write(event.delta);
      break;

    case 'thinking_delta':
      thinking += event.delta;
      break;

    case 'toolcall_end':
      toolCalls.push(event.toolCall);
      break;

    case 'done':
      console.log('\nFinished:', event.reason);
      break;

    case 'error':
      console.error('Error:', event.message.errorMessage);
      break;
  }
}

// Get complete message with native response
const final = await stream.result();
```

---

## Model & Provider Types

### Api

Supported providers.

```typescript
const KnownApis = ['openai', 'google', 'deepseek', 'anthropic', 'zai', 'cerebras'] as const;
type Api = typeof KnownApis[number];
```

### Model

Model configuration.

```typescript
interface Model<TApi extends Api> {
  id: string;              // 'claude-sonnet-4-20250514', 'gpt-4o'
  name: string;            // Display name
  api: TApi;               // Provider type
  baseUrl: string;         // API endpoint
  reasoning: boolean;      // Supports extended thinking
  input: ('text' | 'image' | 'file')[];
  cost: {
    input: number;         // $/million tokens
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;   // Max context tokens
  maxTokens: number;       // Max output tokens
  headers?: Record<string, string>;
  tools: string[];         // ['function_calling']
  excludeSettings?: string[];
}
```

### Context

Input to LLM calls.

```typescript
interface Context {
  messages: Message[];
  systemPrompt?: string;
  tools?: Tool[];
}
```

### NativeAssistantMessageForApi

Maps API to native response type.

```typescript
interface ApiNativeAssistantMessageMap {
  'openai': Response;              // OpenAI Response
  'google': GenerateContentResponse;
  'deepseek': ChatCompletion;
  'anthropic': AnthropicMessage;
  'zai': ChatCompletion;
  'cerebras': ChatCompletion;
}

type NativeAssistantMessageForApi<TApi extends Api> = ApiNativeAssistantMessageMap[TApi];
```

---

## Usage Types

### Usage

Token and cost tracking.

```typescript
interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;      // Dollars
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

**Accessing Usage:**
```typescript
const response = await complete(model, context);

console.log(`Input tokens: ${response.usage.input}`);
console.log(`Output tokens: ${response.usage.output}`);
console.log(`Cache read: ${response.usage.cacheRead}`);
console.log(`Total cost: $${response.usage.cost.total.toFixed(6)}`);
```

---

## Type Utilities

### Building a UserMessage

```typescript
import { generateUUID } from '@ank1015/providers';

function createUserMessage(text: string, images?: string[]): UserMessage {
  const content: Content = [{ type: 'text', content: text }];

  if (images) {
    for (const img of images) {
      content.push({
        type: 'image',
        data: img,  // base64
        mimeType: 'image/png'
      });
    }
  }

  return {
    role: 'user',
    id: generateUUID(),
    timestamp: Date.now(),
    content
  };
}
```

### Extracting Text from Response

```typescript
function extractText(response: BaseAssistantMessage<Api>): string {
  return response.content
    .filter(c => c.type === 'response')
    .flatMap(c => c.content)
    .filter(c => c.type === 'text')
    .map(c => c.content)
    .join('');
}
```

### Extracting Tool Calls

```typescript
function extractToolCalls(response: BaseAssistantMessage<Api>): AssistantToolCall[] {
  return response.content.filter(
    (c): c is AssistantToolCall => c.type === 'toolCall'
  );
}
```

### Checking for Tool Use

```typescript
function hasToolCalls(response: BaseAssistantMessage<Api>): boolean {
  return response.stopReason === 'toolUse' ||
    response.content.some(c => c.type === 'toolCall');
}
```
