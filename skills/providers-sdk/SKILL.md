---
name: providers-sdk
description: |
  Multi-provider LLM SDK for building agentic systems with unified interfaces across OpenAI, Anthropic, Google, DeepSeek, Cerebras, and Z.AI. Use this skill when:
  (1) Making LLM API calls with complete() or stream() functions
  (2) Building agents with the Conversation class and tool execution
  (3) Working with multi-provider message formats (UserMessage, AssistantMessage, ToolResultMessage)
  (4) Implementing tools with TypeBox schemas
  (5) Handling streaming events (text_delta, thinking_delta, toolcall_delta)
  (6) Managing conversation state, message queuing, and cost/context limits
  (7) Converting between provider-native and normalized message formats
---

# @ank1015/providers SDK

Multi-provider LLM SDK supporting 6 providers with unified interfaces while preserving provider-specific capabilities.

## Quick Reference

### Supported Providers & Environment Variables
| Provider | Api Type | Environment Variable |
|----------|----------|---------------------|
| OpenAI | `'openai'` | `OPENAI_API_KEY` |
| Anthropic | `'anthropic'` | `ANTHROPIC_API_KEY` |
| Google | `'google'` | `GEMINI_API_KEY` |
| DeepSeek | `'deepseek'` | `DEEPSEEK_API_KEY` |
| Cerebras | `'cerebras'` | `CEREBRAS_API_KEY` |
| Z.AI | `'zai'` | `ZAI_API_KEY` |

## Core Usage Patterns

### 1. Simple LLM Calls

```typescript
import { complete, stream, getModel } from '@ank1015/providers';

// Non-streaming
const model = getModel('anthropic', 'claude-sonnet-4-20250514');
const response = await complete(model, {
  messages: [{ role: 'user', id: '1', content: [{ type: 'text', content: 'Hello' }] }],
  systemPrompt: 'You are helpful.'
});

// Streaming
const eventStream = stream(model, context);
for await (const event of eventStream) {
  if (event.type === 'text_delta') process.stdout.write(event.delta);
}
const finalMessage = await eventStream.result();
```

### 2. Agent with Tools (Conversation Class)

```typescript
import { Conversation, DefaultLLMClient } from '@ank1015/providers';
import { Type } from '@sinclair/typebox';

// Define tool
const searchTool = {
  name: 'search',
  label: 'Web Search',
  description: 'Search the web',
  parameters: Type.Object({ query: Type.String() }),
  execute: async (toolCallId, args) => ({
    content: [{ type: 'text', content: `Results for: ${args.query}` }],
    details: { source: 'web' }
  })
};

// Create conversation
const conversation = new Conversation({
  initialState: {
    provider: { model, providerOptions: { apiKey: process.env.ANTHROPIC_API_KEY } },
    tools: [searchTool],
    systemPrompt: 'You are a helpful assistant.'
  },
  client: new DefaultLLMClient()
});

// Subscribe to events
conversation.subscribe((event) => {
  if (event.type === 'message_update') console.log('Streaming:', event.message);
});

// Send prompt (runs agent loop automatically)
await conversation.prompt('Search for TypeScript tutorials');
```

## Key Types

### Message Types
- **UserMessage**: `{ role: 'user', id, content: Content[], timestamp? }`
- **ToolResultMessage**: `{ role: 'toolResult', id, toolCallId, toolName, content, isError, details? }`
- **BaseAssistantMessage<TApi>**: Provider response with both native `message` and normalized `content`

### Content Types
```typescript
type Content = (TextContent | ImageContent | FileContent)[];
// TextContent: { type: 'text', content: string }
// ImageContent: { type: 'image', data: string, mimeType: string }
// FileContent: { type: 'file', data: string, mimeType: string, filename: string }
```

### AssistantResponse (normalized across providers)
```typescript
type AssistantResponse = (
  | { type: 'response', content: Content }
  | { type: 'thinking', thinkingText: string }
  | { type: 'toolCall', name: string, arguments: Record<string, any>, toolCallId: string }
)[];
```

## Streaming Events

```typescript
type BaseAssistantEvent<TApi> =
  | { type: 'start', message }
  | { type: 'text_start' | 'text_delta' | 'text_end', contentIndex, delta?, message }
  | { type: 'thinking_start' | 'thinking_delta' | 'thinking_end', contentIndex, delta?, message }
  | { type: 'toolcall_start' | 'toolcall_delta' | 'toolcall_end', contentIndex, toolCall?, message }
  | { type: 'done', reason: StopReason, message }
  | { type: 'error', reason: StopReason, message };
```

## References

- **Complete types reference**: See [references/types-reference.md](references/types-reference.md) for all message, content, response, and agent types with parsing examples
- **API reference**: See [references/api-reference.md](references/api-reference.md) for complete(), stream(), getModel() functions
- **Tool implementation guide**: See [references/tools-guide.md](references/tools-guide.md) for AgentTool, TypeBox schemas, execution
- **Conversation class details**: See [references/conversation-guide.md](references/conversation-guide.md) for state management, events, queuing
- **Provider-specific options**: See [references/provider-options.md](references/provider-options.md) for Anthropic, OpenAI, Google, etc. options
