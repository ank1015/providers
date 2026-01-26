# Tool Implementation Guide

## Table of Contents
- [Defining Tools](#defining-tools)
- [Tool Schema with TypeBox](#tool-schema-with-typebox)
- [Tool Execution](#tool-execution)
- [Streaming Tool Updates](#streaming-tool-updates)
- [Error Handling](#error-handling)
- [Built-in Tools](#built-in-tools)

## Defining Tools

### AgentTool Interface

```typescript
interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
  name: string;
  label: string;
  description: string;
  parameters: TParameters;
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

```typescript
interface AgentToolResult<TDetails = any> {
  content: Content;   // Sent to LLM (text, images, files)
  details: TDetails;  // App metadata (not sent to LLM)
}
```

## Tool Schema with TypeBox

Use `@sinclair/typebox` for type-safe parameter schemas.

### Basic Schema

```typescript
import { Type, Static } from '@sinclair/typebox';

const searchSchema = Type.Object({
  query: Type.String({ description: 'Search query' }),
  limit: Type.Optional(Type.Number({ description: 'Max results', default: 10 }))
});

type SearchParams = Static<typeof searchSchema>;
// { query: string; limit?: number }
```

### Complex Schema

```typescript
const fileOperationSchema = Type.Object({
  operation: Type.Union([
    Type.Literal('read'),
    Type.Literal('write'),
    Type.Literal('delete')
  ], { description: 'Operation type' }),
  path: Type.String({ description: 'File path' }),
  content: Type.Optional(Type.String({ description: 'Content for write operation' })),
  options: Type.Optional(Type.Object({
    encoding: Type.Optional(Type.String({ default: 'utf-8' })),
    recursive: Type.Optional(Type.Boolean({ default: false }))
  }))
});
```

### Schema Patterns

```typescript
// Enum-like values
Type.Union([Type.Literal('a'), Type.Literal('b'), Type.Literal('c')])

// Arrays
Type.Array(Type.String())

// Optional with default
Type.Optional(Type.Number({ default: 10 }))

// Nested objects
Type.Object({
  nested: Type.Object({ field: Type.String() })
})

// String with constraints
Type.String({ minLength: 1, maxLength: 1000 })
```

## Tool Execution

### Complete Tool Example

```typescript
import { Type, Static } from '@sinclair/typebox';
import { AgentTool, AgentToolResult, Content } from '@ank1015/providers';

const weatherSchema = Type.Object({
  city: Type.String({ description: 'City name' }),
  units: Type.Optional(Type.Union([
    Type.Literal('celsius'),
    Type.Literal('fahrenheit')
  ], { default: 'celsius' }))
});

type WeatherParams = Static<typeof weatherSchema>;

interface WeatherDetails {
  apiCallDuration: number;
  source: string;
}

export const weatherTool: AgentTool<typeof weatherSchema, WeatherDetails> = {
  name: 'get_weather',
  label: 'Weather',
  description: 'Get current weather for a city',
  parameters: weatherSchema,

  execute: async (
    toolCallId: string,
    params: WeatherParams,
    signal?: AbortSignal,
    onUpdate?: (partial: AgentToolResult<WeatherDetails>) => void,
    context?: { messages: readonly Message[] }
  ): Promise<AgentToolResult<WeatherDetails>> => {
    const start = Date.now();

    // Check abort signal
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    // Fetch weather (mock)
    const temp = params.units === 'fahrenheit' ? '72°F' : '22°C';

    return {
      content: [{
        type: 'text',
        content: `Weather in ${params.city}: ${temp}, Sunny`
      }],
      details: {
        apiCallDuration: Date.now() - start,
        source: 'weather-api'
      }
    };
  }
};
```

### Using Conversation Context

Tools receive read-only access to conversation history:

```typescript
execute: async (toolCallId, params, signal, onUpdate, context) => {
  // Access previous messages
  const previousMessages = context?.messages || [];

  // Find relevant context
  const userMessages = previousMessages.filter(m => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];

  // Use context to inform response
  return {
    content: [{ type: 'text', content: `Found ${userMessages.length} user messages` }],
    details: {}
  };
}
```

## Streaming Tool Updates

For long-running tools, provide progress updates:

```typescript
const downloadTool: AgentTool<typeof downloadSchema, DownloadDetails> = {
  name: 'download_file',
  label: 'Download',
  description: 'Download a file with progress updates',
  parameters: downloadSchema,

  execute: async (toolCallId, params, signal, onUpdate) => {
    const chunks = 10;

    for (let i = 0; i < chunks; i++) {
      if (signal?.aborted) throw new Error('Download cancelled');

      // Simulate download progress
      await new Promise(r => setTimeout(r, 100));

      // Send progress update
      onUpdate?.({
        content: [{ type: 'text', content: `Downloading: ${(i + 1) * 10}%` }],
        details: { progress: (i + 1) / chunks }
      });
    }

    return {
      content: [{ type: 'text', content: 'Download complete!' }],
      details: { progress: 1, bytesDownloaded: 1024 }
    };
  }
};
```

## Error Handling

### Tool Errors

Return errors gracefully - they become `ToolResultMessage` with `isError: true`:

```typescript
execute: async (toolCallId, params) => {
  try {
    const result = await riskyOperation(params);
    return {
      content: [{ type: 'text', content: result }],
      details: {}
    };
  } catch (error) {
    // Throwing creates isError: true ToolResultMessage
    throw new Error(`Operation failed: ${error.message}`);
  }
}
```

### Validation Errors

Arguments are validated against TypeBox schema using AJV. Invalid arguments throw before `execute()` is called.

```typescript
// If LLM sends { query: 123 } for Type.String(), validation fails with:
// "Validation failed for tool 'search':
//   - query: must be string"
```

## Built-in Tools

### calculateTool

```typescript
import { calculateTool } from '@ank1015/providers';
// Evaluates mathematical expressions
// Parameters: { expression: string }
// Example: "2 + 2 * 3" → "8"
```

### getCurrentTimeTool

```typescript
import { getCurrentTimeTool } from '@ank1015/providers';
// Gets current date/time
// Parameters: { timezone?: string }
// Example: { timezone: 'America/New_York' } → "2024-01-15T10:30:00-05:00"
```

## Registering Tools

### With Conversation Class

```typescript
const conversation = new Conversation({
  initialState: {
    provider: { model, providerOptions },
    tools: [weatherTool, calculateTool, getCurrentTimeTool],
    systemPrompt: 'You have access to weather, calculator, and time tools.'
  },
  client: new DefaultLLMClient()
});
```

### With Direct LLM Calls

```typescript
const context: Context = {
  messages: [...],
  systemPrompt: '...',
  tools: [
    {
      name: 'search',
      description: 'Search the web',
      parameters: Type.Object({ query: Type.String() })
    }
  ]
};

const response = await complete(model, context);

// Check for tool calls in response
const toolCalls = response.content.filter(c => c.type === 'toolCall');
```

## Tool Lifecycle in Agent Loop

```
1. User sends prompt
2. LLM generates response with tool calls
3. For each tool call:
   a. Validate arguments against schema
   b. Execute tool with context
   c. Build ToolResultMessage
   d. Add to conversation
4. Loop: send tool results back to LLM
5. Continue until LLM responds without tool calls
```
