# @ank1015/providers

A provider abstraction layer for building agentic systems with multiple LLM providers. Built with the philosophy of balancing **standardization** with **provider-specific fidelity**.

Most of the coding patterns are inspired by [PI-mono](https://github.com/badlogic/pi-mono/tree/main).

## Philosophy

LLM providers often offer unique capabilities and implementation details that are not universally available. Attempting to force different providers into a single, unified message abstraction often results in the loss of provider-specific features or information.

This library balances standardization with flexibility by:
- **Standardizing User & Tool Messages**: Input messages and tool results use a universal format that can be adapted for any provider.
- **Preserving Native Assistant Messages**: Assistant responses retain their native provider structure while exposing common fields (like content and usage) for convenience.
- **Unified Streaming**: Streaming events are normalized to a consistent interface without discarding provider-specific data.
- **Seamless Handoffs**: Switching providers is fully supported. While some provider-specific context (like caching or reasoning traces) may be lost during conversion, the core conversation history remains intact.

This approach ensures you can leverage the distinct strengths of each model—using specific harnesses to steer them effectively—while maintaining a consistent interface for testing and experimentation.

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
            // The 'message' property here is the streaming event (BaseAssistantEvent)
            // It contains the delta and the type (e.g., 'text_delta', 'thinking_delta')
            const streamEvent = event.message;
            
            if (streamEvent.type === 'text_delta') {
                process.stdout.write(streamEvent.delta);
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

## Examples

Check out the `examples/` directory for complete, runnable implementations:

- **[Coding Agent](examples/coding-agent)**: An agent demonstrating complex tool usage, file manipulation, and code generation capabilities.
- **[Research Agent](examples/research-agent)**: A research assistant showcasing multi-step reasoning and information gathering.

To run the examples:

```bash
# Run the coding agent CLI
npx tsx examples/coding-agent/cli.ts

# Run the research agent CLI
npx tsx examples/research-agent/cli.ts
```

## Architecture

- **`Conversation`**: The high-level state manager. It tracks message history, handles message queuing (for rapid user inputs), and manages the `AgentRunner`.
- **`AgentRunner`**: A stateless engine that executes the "Agent Protocol". It sends messages to the LLM, parses tool calls, executes tools, and feeds results back to the LLM until a final response is reached.
- **`LLMClient`**: The low-level abstraction that standardizes API calls to OpenAI, Google, etc.
- **`Utils`**: Includes helpers like `parseStreamingJson` (for real-time tool visualization) and `isContextOverflow` (for handling token limits).

## License

MIT
