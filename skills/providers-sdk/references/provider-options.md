# Provider-Specific Options

## Table of Contents
- [Common Options](#common-options)
- [Anthropic](#anthropic)
- [OpenAI](#openai)
- [Google](#google)
- [DeepSeek](#deepseek)
- [Cerebras](#cerebras)
- [Z.AI](#zai)
- [Kimi](#kimi)

## Common Options

All providers support these base options:

```typescript
interface CommonOptions {
  apiKey?: string;    // Override env variable
  signal?: AbortSignal; // Cancel request
}
```

## Anthropic

```typescript
import { AnthropicProviderOptions } from '@ank1015/providers';

const options: AnthropicProviderOptions = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  signal: abortController.signal,
  max_tokens: 4096,

  // Extended thinking (Claude 3.5+)
  thinking: {
    type: 'enabled',
    budget_tokens: 10000
  },

  // Temperature (0-1)
  temperature: 0.7,

  // Top-p sampling
  top_p: 0.9,

  // Stop sequences
  stop_sequences: ['END', 'STOP'],

  // Metadata
  metadata: {
    user_id: 'user-123'
  }
};
```

### Extended Thinking

Enable Claude's extended thinking for complex reasoning:

```typescript
const response = await complete(model, context, {
  thinking: {
    type: 'enabled',
    budget_tokens: 10000 // Max thinking tokens
  }
});

// Access thinking in response
const thinking = response.content.find(c => c.type === 'thinking');
console.log('Thinking:', thinking?.thinkingText);
```

## OpenAI

```typescript
import { OpenAIProviderOptions } from '@ank1015/providers';

const options: OpenAIProviderOptions = {
  apiKey: process.env.OPENAI_API_KEY,
  signal: abortController.signal,

  // Temperature (0-2)
  temperature: 0.7,

  // Top-p sampling
  top_p: 0.9,

  // Frequency penalty (-2 to 2)
  frequency_penalty: 0.5,

  // Presence penalty (-2 to 2)
  presence_penalty: 0.5,

  // Max tokens
  max_output_tokens: 4096,

  // Reasoning effort (for o1/o3 models)
  reasoning: {
    effort: 'medium' // 'low' | 'medium' | 'high'
  },

  // Response format
  text: {
    format: {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: { type: 'object', properties: { answer: { type: 'string' } } }
      }
    }
  }
};
```

### Reasoning Models (o1, o3)

```typescript
const model = getModel('openai', 'o1');

const response = await complete(model, context, {
  reasoning: {
    effort: 'high' // More thinking tokens
  }
});

// Access reasoning in response
const reasoning = response.content.find(c => c.type === 'thinking');
```

## Google

```typescript
import { GoogleProviderOptions } from '@ank1015/providers';

const options: GoogleProviderOptions = {
  apiKey: process.env.GEMINI_API_KEY,
  signal: abortController.signal,

  // Generation config
  generationConfig: {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 4096,
    stopSequences: ['END']
  },

  // Safety settings
  safetySettings: [
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    }
  ],

  // Thinking config (Gemini 2.0+)
  thinkingConfig: {
    thinkingBudget: 10000
  }
};
```

### Thinking with Gemini

```typescript
const model = getModel('google', 'gemini-2.0-flash-thinking-exp');

const response = await complete(model, context, {
  thinkingConfig: {
    thinkingBudget: 8000
  }
});
```

## DeepSeek

```typescript
import { DeepSeekProviderOptions } from '@ank1015/providers';

const options: DeepSeekProviderOptions = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  signal: abortController.signal,

  // Temperature (0-2)
  temperature: 0.7,

  // Top-p sampling
  top_p: 0.9,

  // Frequency penalty
  frequency_penalty: 0.5,

  // Presence penalty
  presence_penalty: 0.5,

  // Max tokens
  max_tokens: 4096,

  // Stop sequences
  stop: ['END', 'STOP']
};
```

### DeepSeek Reasoning

DeepSeek models automatically include reasoning when available:

```typescript
const model = getModel('deepseek', 'deepseek-reasoner');

const response = await complete(model, context);

// Reasoning content appears in response
const reasoning = response.content.find(c => c.type === 'thinking');
```

## Cerebras

```typescript
import { CerebrasProviderOptions } from '@ank1015/providers';

const options: CerebrasProviderOptions = {
  apiKey: process.env.CEREBRAS_API_KEY,
  signal: abortController.signal,

  // Temperature
  temperature: 0.7,

  // Top-p sampling
  top_p: 0.9,

  // Max tokens
  max_tokens: 4096,

  // Reasoning format
  reasoning_format: 'parsed', // 'parsed' | 'raw' | 'hidden' | 'none'

  // Reasoning effort
  reasoning_effort: 'medium', // 'low' | 'medium' | 'high'

  // Disable reasoning entirely
  disable_reasoning: false,

  // Clear thinking (don't show in response)
  clear_thinking: false
};
```

### Reasoning Options

```typescript
// Parsed: structured thinking blocks
const parsed = await complete(model, context, {
  reasoning_format: 'parsed',
  reasoning_effort: 'high'
});

// Hidden: reasoning happens but not in response
const hidden = await complete(model, context, {
  reasoning_format: 'hidden'
});

// No reasoning
const noReasoning = await complete(model, context, {
  disable_reasoning: true
});
```

## Z.AI

```typescript
import { ZaiProviderOptions } from '@ank1015/providers';

const options: ZaiProviderOptions = {
  apiKey: process.env.ZAI_API_KEY,
  signal: abortController.signal,

  // Temperature
  temperature: 0.7,

  // Top-p sampling
  top_p: 0.9,

  // Max tokens
  max_tokens: 4096,

  // Thinking configuration
  thinking: {
    type: 'enabled', // 'enabled' | 'disabled'
    clear_thinking: false // Hide thinking from response
  }
};
```

### Z.AI Thinking

```typescript
const model = getModel('zai', 'grok-3-mini');

const response = await complete(model, context, {
  thinking: {
    type: 'enabled'
  }
});

// Access thinking
const thinking = response.content.find(c => c.type === 'thinking');
```

## Kimi

```typescript
import { KimiProviderOptions } from '@ank1015/providers';

const options: KimiProviderOptions = {
  apiKey: process.env.KIMI_API_KEY,
  signal: abortController.signal,

  // Temperature (0-1, fixed at 1.0 for kimi-k2.5, 0.6 for non-thinking mode)
  temperature: 0.6,

  // Top-p sampling (fixed at 0.95 for kimi-k2.5)
  top_p: 0.95,

  // Max tokens (default 32768)
  max_tokens: 32768,

  // Thinking configuration (kimi-k2.5 only)
  thinking: {
    type: 'enabled' // 'enabled' | 'disabled'
  }
};
```

### Kimi Thinking

Kimi K2.5 supports extended thinking mode:

```typescript
const model = getModel('kimi', 'kimi-k2.5');

const response = await complete(model, context, {
  thinking: {
    type: 'enabled' // Default for reasoning models
  }
});

// Access thinking (reasoning_content)
const thinking = response.content.find(c => c.type === 'thinking');
console.log('Reasoning:', thinking?.thinkingText);
```

### Disable Thinking

```typescript
const response = await complete(model, context, {
  thinking: {
    type: 'disabled'
  }
});
```

### Kimi K2 Turbo (Fast Model)

```typescript
const model = getModel('kimi', 'kimi-k2-turbo-preview');

// Turbo model - faster, no thinking mode
const response = await complete(model, context, {
  temperature: 0.6
});
```

## Provider Comparison

| Feature | Anthropic | OpenAI | Google | DeepSeek | Cerebras | Z.AI | Kimi |
|---------|-----------|--------|--------|----------|----------|------|------|
| Extended Thinking | Yes | Yes (o1/o3) | Yes | Yes | Yes | Yes | Yes |
| JSON Mode | Via prompt | Native | Native | Via prompt | Via prompt | Via prompt | Via prompt |
| Vision | Yes | Yes | Yes | Limited | No | Yes | Yes |
| File Input | Yes | Yes | Yes | No | No | No | Yes |
| Caching | Yes | Yes | No | Yes | Yes | Yes | Yes |
| Streaming | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

## Environment Variables

```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
CEREBRAS_API_KEY=csk-...
ZAI_API_KEY=xai-...
KIMI_API_KEY=sk-...
```

## Switching Providers

```typescript
// Same context works across providers
const context: Context = {
  messages: [...],
  systemPrompt: '...',
  tools: [...]
};

// Anthropic
const anthropicResponse = await complete(
  getModel('anthropic', 'claude-sonnet-4-20250514'),
  context,
  { apiKey: process.env.ANTHROPIC_API_KEY }
);

// OpenAI
const openaiResponse = await complete(
  getModel('openai', 'gpt-4o'),
  context,
  { apiKey: process.env.OPENAI_API_KEY }
);

// Google
const googleResponse = await complete(
  getModel('google', 'gemini-2.0-flash'),
  context,
  { apiKey: process.env.GEMINI_API_KEY }
);

// Kimi
const kimiResponse = await complete(
  getModel('kimi', 'kimi-k2.5'),
  context,
  { apiKey: process.env.KIMI_API_KEY }
);
```

Messages from one provider can be passed to another - the SDK normalizes them automatically.
