# Conversation Class Guide

## Table of Contents
- [Overview](#overview)
- [Creating a Conversation](#creating-a-conversation)
- [Core Methods](#core-methods)
- [Event System](#event-system)
- [Message Management](#message-management)
- [Queue System](#queue-system)
- [Budget Limits](#budget-limits)
- [Lifecycle Management](#lifecycle-management)

## Overview

The `Conversation` class is a stateful wrapper around the agent execution loop. It manages:
- Message history
- Tool definitions
- Provider configuration
- Cost/context tracking
- Event subscription
- Message queuing

## Creating a Conversation

### Basic Setup

```typescript
import { Conversation, DefaultLLMClient, getModel } from '@ank1015/providers';

const model = getModel('anthropic', 'claude-sonnet-4-20250514');

const conversation = new Conversation({
  initialState: {
    provider: {
      model,
      providerOptions: { apiKey: process.env.ANTHROPIC_API_KEY }
    },
    systemPrompt: 'You are a helpful assistant.',
    tools: []
  },
  client: new DefaultLLMClient()
});
```

### Full Configuration

```typescript
const conversation = new Conversation({
  initialState: {
    provider: { model, providerOptions },
    systemPrompt: 'System prompt here',
    tools: [myTool1, myTool2],
    messages: [], // Pre-existing messages
  },
  client: new DefaultLLMClient(),
  costLimit: 0.50,           // Max $0.50 per session
  contextLimit: 100000,      // Max 100k tokens
  queueMode: 'one-at-a-time', // or 'all'
  messageTransformer: (messages) => {
    // Filter/transform messages before sending to LLM
    return messages.filter(m => m.role !== 'custom');
  }
});
```

### AgentState Interface

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

## Core Methods

### prompt()

Main entry point - adds user message and runs agent loop.

```typescript
const messages = await conversation.prompt('Hello, how are you?');
// Returns all new messages added during this turn
```

With attachments (images/files):

```typescript
const messages = await conversation.prompt('What is in this image?', [
  {
    type: 'image',
    data: base64ImageData,
    mimeType: 'image/png'
  }
]);
```

### continue()

Resume execution without a new user message. Useful after context overflow recovery.

```typescript
// After handling overflow, resume
await conversation.continue();
```

### abort()

Cancel the current execution.

```typescript
conversation.abort();
```

### waitForIdle()

Wait until no prompt is executing.

```typescript
await conversation.waitForIdle();
console.log('Conversation is idle');
```

### reset()

Clear all state and abort any running execution.

```typescript
conversation.reset();
```

## Event System

### subscribe()

Listen to conversation events.

```typescript
const unsubscribe = conversation.subscribe((event) => {
  switch (event.type) {
    case 'agent_start':
      console.log('Agent started');
      break;
    case 'turn_start':
      console.log('New turn');
      break;
    case 'message_start':
      console.log('Message started:', event.messageType);
      break;
    case 'message_update':
      // Streaming update - partial message
      if (event.messageType === 'assistant') {
        const delta = event.message.content;
        // Handle streaming content
      }
      break;
    case 'message_end':
      console.log('Message complete:', event.message);
      break;
    case 'tool_execution_start':
      console.log(`Executing tool: ${event.toolName}`);
      break;
    case 'tool_execution_update':
      console.log('Tool progress:', event.partialResult);
      break;
    case 'tool_execution_end':
      console.log(`Tool ${event.toolName} finished:`, event.result);
      break;
    case 'turn_end':
      console.log('Turn complete');
      break;
    case 'agent_end':
      console.log('Agent finished, new messages:', event.agentMessages);
      break;
  }
});

// Later: stop listening
unsubscribe();
```

### AgentEvent Types

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

## Message Management

### appendMessage() / appendMessages()

Add messages to history.

```typescript
conversation.appendMessage({
  role: 'user',
  id: 'msg-1',
  content: [{ type: 'text', content: 'Hello' }]
});

conversation.appendMessages([msg1, msg2, msg3]);
```

### updateMessage()

Update an existing message by ID.

```typescript
conversation.updateMessage('msg-1', {
  content: [{ type: 'text', content: 'Updated content' }]
});
```

### removeMessage()

Remove a message by ID.

```typescript
conversation.removeMessage('msg-1');
```

### addCustomMessage()

Add application-specific metadata messages.

```typescript
conversation.addCustomMessage({
  type: 'bookmark',
  timestamp: Date.now(),
  label: 'Important point'
});
// Creates: { role: 'custom', id: uuid, content: {...}, timestamp }
```

### getMessages()

Get current message history.

```typescript
const messages = conversation.getMessages();
```

## Queue System

Inject messages to be processed at the next turn boundary.

### queueMessage()

```typescript
conversation.queueMessage({
  original: myAppMessage,  // For UI/storage
  llm: {                   // Transformed for LLM
    role: 'user',
    id: 'queued-1',
    content: [{ type: 'text', content: 'Injected context' }]
  }
});
```

### Queue Modes

**`one-at-a-time`** (default): Process one queued message per turn.

```typescript
const conversation = new Conversation({
  queueMode: 'one-at-a-time',
  // ...
});
```

**`all`**: Process all queued messages at once.

```typescript
const conversation = new Conversation({
  queueMode: 'all',
  // ...
});
```

## Budget Limits

### Cost Limit

Stop execution when cost exceeds limit.

```typescript
const conversation = new Conversation({
  costLimit: 1.00, // $1.00 max
  // ...
});

// Check current usage
const state = conversation.getState();
console.log(`Spent: $${state.usage.totalCost}`);
```

### Context Limit

Stop when input tokens exceed limit.

```typescript
const conversation = new Conversation({
  contextLimit: 50000, // 50k tokens max
  // ...
});
```

When limits are exceeded and more actions are pending, execution stops with an error. If no more actions are needed, execution completes gracefully.

## Lifecycle Management

### State Accessors

```typescript
// Get full state
const state = conversation.getState();

// Update system prompt
conversation.setSystemPrompt('New system prompt');

// Switch provider/model
const newModel = getModel('openai', 'gpt-4o');
conversation.setProvider({
  model: newModel,
  providerOptions: { apiKey: process.env.OPENAI_API_KEY }
});
```

### Provider Interface

```typescript
interface Provider<TApi extends Api> {
  model: Model<TApi>;
  providerOptions: OptionsForApi<TApi>;
}
```

### Message Transformer

Filter or modify messages before sending to LLM:

```typescript
const conversation = new Conversation({
  messageTransformer: (messages) => {
    // Remove custom messages (not understood by LLM)
    const filtered = messages.filter(m => m.role !== 'custom');

    // Limit history to last 20 messages
    return filtered.slice(-20);
  },
  // ...
});
```

### Concurrency

Only one `prompt()` can execute at a time. Calling `prompt()` while another is running throws an error.

```typescript
// Safe pattern
await conversation.waitForIdle();
await conversation.prompt('New message');

// Or check state
if (!conversation.getState().isStreaming) {
  await conversation.prompt('Safe to send');
}
```

## Complete Example

```typescript
import { Conversation, DefaultLLMClient, getModel } from '@ank1015/providers';
import { Type } from '@sinclair/typebox';

// Define tools
const searchTool = {
  name: 'search',
  label: 'Search',
  description: 'Search for information',
  parameters: Type.Object({ query: Type.String() }),
  execute: async (id, args) => ({
    content: [{ type: 'text', content: `Found results for: ${args.query}` }],
    details: { resultCount: 10 }
  })
};

// Create conversation
const model = getModel('anthropic', 'claude-sonnet-4-20250514');
const conversation = new Conversation({
  initialState: {
    provider: { model, providerOptions: { apiKey: process.env.ANTHROPIC_API_KEY } },
    tools: [searchTool],
    systemPrompt: 'You are a research assistant with search capabilities.'
  },
  client: new DefaultLLMClient(),
  costLimit: 0.10
});

// Subscribe to events for UI
conversation.subscribe((event) => {
  if (event.type === 'message_update' && event.messageType === 'assistant') {
    // Stream to UI
    const textContent = event.message.content.find(c => c.type === 'response');
    if (textContent) {
      process.stdout.write(textContent.content[0]?.content || '');
    }
  }
});

// Run conversation
try {
  await conversation.prompt('Search for the latest TypeScript features');
  console.log('\n\nConversation complete!');
  console.log(`Total cost: $${conversation.getState().usage.totalCost.toFixed(4)}`);
} catch (error) {
  console.error('Error:', error.message);
}
```
