# @ank1015/providers

A provider abstraction layer for building agentic systems with multiple LLM providers. Built with a philosophy that **harnesses should be model-specific** while maintaining the ability to test and compose different models together.

Most of the coding patterns are taken and inspired from [PI-mono](https://github.com/badlogic/pi-mono/tree/main)

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
- **💾 State Management**: Robust `Conversation` class to manage chat history, message queuing, and state persistence.

## Installation

```bash
npm install @ank1015/providers
```

## Quick Start

Here's how to create a simple agent that can perform calculations.

```typescript
import { Conversation, calculateTool } from "@ank1015/providers";

async function main() {
  // 1. Initialize Conversation
  // By default uses Gemini Flash, but you can configure any model
  const conversation = new Conversation();
  
  // 2. Add Tools
  // The SDK includes sample tools like 'calculate' for testing
  conversation.setTools([calculateTool]);

  // 3. Prompt the Agent
  console.log("User: What is (123 * 45) + 9?");
  const messages = await conversation.prompt("What is (123 * 45) + 9?");

  // 4. Get the result
  const lastMessage = messages[messages.length - 1];
  
  // content is an array of typed blocks (text, image, toolUse, etc.)
  const responseContent = lastMessage.content.find(c => c.type === 'response');
  
  if (responseContent?.content[0].type === 'text') {
    console.log("Agent:", responseContent.content[0].content);
  }
}
```

## Usage

### 1. Configuration & Providers

You can switch providers easily by setting the provider configuration.

```typescript
import { Conversation } from "@ank1015/providers";
import { getModel } from "@ank1015/providers/models";

const conversation = new Conversation();

// Switch to OpenAI GPT-5.2 (Example Model ID from registry)
const openAIModel = getModel('openai', 'gpt-5.2'); 

if (openAIModel) {
    conversation.setProvider({
        model: openAIModel,
        providerOptions: {
            apiKey: process.env.OPENAI_API_KEY
        }
    });
}
```

### 2. Defining Custom Tools

Tools are defined using `TypeBox` for schema validation. This ensures the LLM generates arguments that match your code's expectations.

```typescript
import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@ank1015/providers/agent/types";

// 1. Define the Schema
const getWeatherSchema = Type.Object({
    location: Type.String({ description: "The city and state, e.g. San Francisco, CA" }),
    unit: Type.Optional(Type.Union([Type.Literal("celsius"), Type.Literal("fahrenheit")]))
});

// 2. Create the Tool Definition
export const getWeatherTool: AgentTool<typeof getWeatherSchema> = {
    name: "get_weather",
    label: "Get Weather",
    description: "Get the current weather for a location",
    parameters: getWeatherSchema,
    // 3. Implement Execution Logic
    execute: async (toolCallId, args) => {
        // args is fully typed here!
        const { location, unit } = args;
        
        // Mock API call
        return {
            content: [{ type: "text", content: `Sunny, 25°C in ${location}` }],
            details: { temp: 25, condition: "Sunny" }
        };
    }
};

// 4. Register with Conversation
conversation.setTools([getWeatherTool]);
```

### 3. Streaming Events

Subscribe to the conversation to receive real-time updates. This is crucial for building responsive UIs that show "thinking" states or streaming text.

```typescript
conversation.subscribe((event) => {
    switch (event.type) {
        case "message_update":
             // Can handle 'thinking_delta', 'text_delta', etc. inside the event.message
            const msg = event.message;
            if (msg.type === 'text_delta') {
                process.stdout.write(msg.delta);
            }
            break;
            
        case "tool_execution_start":
            console.log(`\nTool ${event.toolName} started...`);
            break;
            
        case "tool_execution_end":
            console.log(`Tool ${event.toolName} finished.`);
            break;
    }
});
```

## Architecture

- **`Conversation`**: The high-level state manager. It tracks the message history (`Memory`), handles message queuing (for handling rapid user inputs), and manages the `AgentRunner`.
- **`AgentRunner`**: A stateless engine that executes the "Agent Protocol". It sends messages to the LLM, parses tool calls from the response, executes the tools, and feeds the results back to the LLM until a final response is reached or the loop terminates.
- **`LLMClient`**: The low-level abstraction that standardizes API calls to OpenAI, Google, etc.
- **`Utils`**: Includes powerful helpers like `parseStreamingJson` (for real-time tool visualization) and `isContextOverflow` (for handling token limits).

## License

MIT
