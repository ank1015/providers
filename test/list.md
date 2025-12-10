# Unit Test Plan

Comprehensive test suite for @ank1015/providers. All tests should be implemented using Vitest with proper mocking for external API calls.

---

## 1. Provider Tests

### 1.1 OpenAI Provider (`test/openai/`)

#### Message Building Tests
- [ ] `buildOpenAIMessages` - User message with text content
- [ ] `buildOpenAIMessages` - User message with image content (base64 data URI)
- [ ] `buildOpenAIMessages` - User message with file content (base64 data)
- [ ] `buildOpenAIMessages` - User message with mixed content (text + images + files)
- [ ] `buildOpenAIMessages` - System prompt conversion to developer role
- [ ] `buildOpenAIMessages` - Tool result message conversion to function_call_output
- [ ] `buildOpenAIMessages` - Tool result with error flag
- [ ] `buildOpenAIMessages` - Native OpenAI assistant message passthrough
- [ ] `buildOpenAIMessages` - Cross-provider assistant message (should work for OpenAI→OpenAI)
- [ ] `buildOpenAIMessages` - Cross-provider assistant message (should throw for Google→OpenAI)
- [ ] `buildOpenAIMessages` - Unicode surrogate sanitization in text content
- [ ] `buildOpenAIMessages` - Empty messages array
- [ ] `buildOpenAIMessages` - Messages with tools defined in context

#### Streaming Tests
- [ ] `streamOpenAI` - Basic text streaming (start → text_delta → text_end → done)
- [ ] `streamOpenAI` - Reasoning mode streaming (reasoning_summary_text.delta events)
- [ ] `streamOpenAI` - Tool call streaming (function_call events)
- [ ] `streamOpenAI` - Multiple tool calls in single response
- [ ] `streamOpenAI` - Parallel tool calls configuration
- [ ] `streamOpenAI` - Tool call with streaming JSON arguments
- [ ] `streamOpenAI` - Tool call with invalid JSON arguments (validation failure)
- [ ] `streamOpenAI` - Tool call with partial JSON during streaming
- [ ] `streamOpenAI` - Stop reason mapping (stop, length, toolUse)
- [ ] `streamOpenAI` - Error handling (API error response)
- [ ] `streamOpenAI` - Abort signal cancellation
- [ ] `streamOpenAI` - Token usage calculation
- [ ] `streamOpenAI` - Cost calculation with cache read/write
- [ ] `streamOpenAI` - Prompt caching with prompt_cache_key
- [ ] `streamOpenAI` - Prompt caching retention (in-memory vs 24h)
- [ ] `streamOpenAI` - Temperature parameter
- [ ] `streamOpenAI` - maxOutputTokens parameter
- [ ] `streamOpenAI` - Truncation parameter
- [ ] `streamOpenAI` - Reasoning effort levels (low, medium, high)
- [ ] `streamOpenAI` - Reasoning summary styles (concise, detailed)
- [ ] `streamOpenAI` - Response with mixed content (text + tool calls)
- [ ] `streamOpenAI` - Empty response handling
- [ ] `streamOpenAI` - Network error handling
- [ ] `streamOpenAI` - Invalid API key error

#### Integration Tests
- [ ] End-to-end streaming with real OpenAI API (optional, use env flag)
- [ ] End-to-end with reasoning mode
- [ ] End-to-end with tool calls
- [ ] End-to-end with prompt caching

---

### 1.2 Google Provider (`test/google/`)

#### Schema Transformation Tests
- [ ] `transformSchemaForGoogle` - const → enum conversion
- [ ] `transformSchemaForGoogle` - anyOf with const values → enum conversion
- [ ] `transformSchemaForGoogle` - Nested object schema transformation
- [ ] `transformSchemaForGoogle` - Array items schema transformation
- [ ] `transformSchemaForGoogle` - Recursive schema transformation
- [ ] `transformSchemaForGoogle` - Schema without const values (no transformation)
- [ ] `transformSchemaForGoogle` - Mixed schema with some const values
- [ ] `transformSchemaForGoogle` - Deep nesting transformation

#### Message Building Tests
- [ ] `buildGoogleMessages` - User message with text content
- [ ] `buildGoogleMessages` - User message with image content (inlineData)
- [ ] `buildGoogleMessages` - User message with file content (inlineData)
- [ ] `buildGoogleMessages` - User message with mixed content
- [ ] `buildGoogleMessages` - System instruction mapping
- [ ] `buildGoogleMessages` - Tool result message with functionResponse
- [ ] `buildGoogleMessages` - Tool result with error status
- [ ] `buildGoogleMessages` - Native Google assistant message passthrough
- [ ] `buildGoogleMessages` - Cross-provider assistant message (should throw for OpenAI→Google)
- [ ] `buildGoogleMessages` - Parts accumulation (merging consecutive text parts)
- [ ] `buildGoogleMessages` - Empty messages array
- [ ] `buildGoogleMessages` - Messages with tools defined

#### Streaming Tests
- [ ] `streamGoogle` - Basic text streaming
- [ ] `streamGoogle` - Thinking mode streaming (part.thought flag detection)
- [ ] `streamGoogle` - Function call streaming
- [ ] `streamGoogle` - Multiple function calls in single response
- [ ] `streamGoogle` - Function call ID auto-generation
- [ ] `streamGoogle` - Tool argument validation
- [ ] `streamGoogle` - Parts accumulation during streaming
- [ ] `streamGoogle` - FinishReason mapping to StopReason
- [ ] `streamGoogle` - Token usage with thinking tokens
- [ ] `streamGoogle` - Cost calculation
- [ ] `streamGoogle` - Extended thinking configuration
- [ ] `streamGoogle` - Response MIME type setting
- [ ] `streamGoogle` - Image generation config
- [ ] `streamGoogle` - Temperature parameter
- [ ] `streamGoogle` - maxOutputTokens parameter
- [ ] `streamGoogle` - Error handling (API error)
- [ ] `streamGoogle` - Abort signal cancellation
- [ ] `streamGoogle` - Empty response handling
- [ ] `streamGoogle` - Network error handling
- [ ] `streamGoogle` - Invalid API key error

#### Integration Tests
- [ ] End-to-end streaming with real Google API (optional, use env flag)
- [ ] End-to-end with extended thinking
- [ ] End-to-end with function calls
- [ ] End-to-end with schema transformation

---

### 1.3 Message Conversion Tests (`test/providers/convert.test.ts`)

- [ ] `buildOpenAIMessages` vs `buildGoogleMessages` - Same user message produces valid formats for both
- [ ] Tool result conversion consistency across providers
- [ ] Image content format differences (OpenAI vs Google)
- [ ] File content format differences
- [ ] System prompt handling differences
- [ ] Cross-provider message forwarding limitations
- [ ] Unicode sanitization applied consistently

---

## 2. Utilities Tests

### 2.1 Event Stream Tests (`test/utils/event-stream.test.ts`)

- [ ] `EventStream` - Basic push and iteration
- [ ] `EventStream` - Push multiple events before iteration
- [ ] `EventStream` - Iteration waits for events (waiter-based)
- [ ] `EventStream` - Multiple concurrent iterators
- [ ] `EventStream` - end() with result
- [ ] `EventStream` - result() promise resolution
- [ ] `EventStream` - result() before end() (waits for end)
- [ ] `EventStream` - Iteration after stream ended
- [ ] `EventStream` - Event queue behavior
- [ ] `EventStream` - Memory cleanup after end
- [ ] `AssistantMessageEventStream` - Type safety for events
- [ ] `AssistantMessageEventStream` - Type safety for result

### 2.2 Validation Tests (`test/utils/validation.test.ts`)

- [ ] `validateToolArguments` - Valid arguments pass validation
- [ ] `validateToolArguments` - Invalid arguments throw error
- [ ] `validateToolArguments` - Missing required field
- [ ] `validateToolArguments` - Extra fields (additionalProperties: false)
- [ ] `validateToolArguments` - Type mismatch (string vs number)
- [ ] `validateToolArguments` - Nested object validation
- [ ] `validateToolArguments` - Array validation
- [ ] `validateToolArguments` - Enum validation
- [ ] `validateToolArguments` - Format validation (email, uri, etc.)
- [ ] `validateToolArguments` - Number constraints (min, max)
- [ ] `validateToolArguments` - String constraints (minLength, maxLength, pattern)
- [ ] `validateToolArguments` - TypeBox schema support
- [ ] `validateToolArguments` - Error message formatting
- [ ] `validateToolArguments` - CSP restriction handling (browser extension)
- [ ] `validateToolArguments` - Graceful degradation when AJV unavailable
- [ ] `validateToolArguments` - Complex schema with anyOf/oneOf
- [ ] `validateToolArguments` - Recursive schema validation

### 2.3 JSON Parsing Tests (`test/utils/json-parse.test.ts`)

- [ ] `parseStreamingJson` - Complete valid JSON
- [ ] `parseStreamingJson` - Incomplete JSON (partial object)
- [ ] `parseStreamingJson` - Incomplete JSON (partial array)
- [ ] `parseStreamingJson` - Incomplete JSON (partial string)
- [ ] `parseStreamingJson` - Invalid JSON (returns empty object)
- [ ] `parseStreamingJson` - Empty string input
- [ ] `parseStreamingJson` - Null input
- [ ] `parseStreamingJson` - Complex nested JSON
- [ ] `parseStreamingJson` - JSON with unicode characters
- [ ] `parseStreamingJson` - JSON with escaped characters

### 2.4 Unicode Sanitization Tests (`test/utils/sanitize-unicode.test.ts`)

- [ ] `sanitizeSurrogates` - Valid text unchanged
- [ ] `sanitizeSurrogates` - Unpaired high surrogate removed
- [ ] `sanitizeSurrogates` - Unpaired low surrogate removed
- [ ] `sanitizeSurrogates` - Valid emoji preserved (paired surrogates)
- [ ] `sanitizeSurrogates` - Multiple unpaired surrogates
- [ ] `sanitizeSurrogates` - Mixed valid and invalid surrogates
- [ ] `sanitizeSurrogates` - Empty string
- [ ] `sanitizeSurrogates` - String with only surrogates
- [ ] `sanitizeSurrogates` - Unicode normalization

---

## 3. Stream Tests (`test/stream.test.ts`)

### Core Stream Function Tests
- [ ] `stream` - Routes to OpenAI provider correctly
- [ ] `stream` - Routes to Google provider correctly
- [ ] `stream` - API key from environment variable (OPENAI_API_KEY)
- [ ] `stream` - API key from environment variable (GEMINI_API_KEY)
- [ ] `stream` - API key from options (overrides env)
- [ ] `stream` - Missing API key throws error
- [ ] `stream` - Invalid provider throws error
- [ ] `stream` - Options passed through to provider
- [ ] `stream` - Context passed through to provider
- [ ] `stream` - Model passed through to provider
- [ ] `stream` - Returns AssistantMessageEventStream
- [ ] `stream` - Exhaustiveness check for provider switch statement

### Event Stream Format Tests
- [ ] Stream events follow standardized format across providers
- [ ] Start event contains partial message
- [ ] Text delta events accumulate correctly
- [ ] Thinking delta events accumulate correctly
- [ ] Tool call delta events accumulate correctly
- [ ] Done event contains complete message
- [ ] Error event contains error details
- [ ] Partial message updates correctly throughout stream

---

## 4. Agent Loop Tests (`test/agent/agent-loop.test.ts`)

### Basic Agent Loop Tests
- [ ] `agentLoop` - Single turn without tool calls
- [ ] `agentLoop` - Single turn with text response
- [ ] `agentLoop` - Initial prompt added to messages
- [ ] `agentLoop` - Agent start/end events emitted
- [ ] `agentLoop` - Turn start/end events emitted
- [ ] `agentLoop` - Message start/end events emitted
- [ ] `agentLoop` - Returns all accumulated messages
- [ ] `agentLoop` - Preserves message order

### Tool Execution Tests
- [ ] `agentLoop` - Single tool call execution
- [ ] `agentLoop` - Multiple tool calls in single turn
- [ ] `agentLoop` - Tool execution events (start/end)
- [ ] `agentLoop` - Tool result message creation
- [ ] `agentLoop` - Tool result added to context
- [ ] `agentLoop` - Multi-turn loop with tool calls
- [ ] `agentLoop` - Tool call → result → next turn
- [ ] `agentLoop` - Tool not found error handling
- [ ] `agentLoop` - Tool execution error handling
- [ ] `agentLoop` - Tool argument validation before execution
- [ ] `agentLoop` - Tool with validated typed arguments
- [ ] `agentLoop` - Tool result with content blocks
- [ ] `agentLoop` - Tool result with details field
- [ ] `agentLoop` - Tool result with error flag
- [ ] `agentLoop` - Tool result with full error details (message, name, stack)

### Queued Messages Tests
- [ ] `agentLoop` - getQueuedMessages callback invoked
- [ ] `agentLoop` - Queued messages injected before turn
- [ ] `agentLoop` - Queued message events emitted
- [ ] `agentLoop` - Queued messages added to context
- [ ] `agentLoop` - Multiple queued messages processed
- [ ] `agentLoop` - Queued messages with original and LLM format
- [ ] `agentLoop` - Queued messages error handling (callback throws)
- [ ] `agentLoop` - Loop continues with queued messages but no tool calls

### Preprocessor Tests
- [ ] `agentLoop` - Preprocessor callback invoked before streaming
- [ ] `agentLoop` - Preprocessed messages sent to LLM
- [ ] `agentLoop` - Original messages preserved in context
- [ ] `agentLoop` - Preprocessor with async transformation
- [ ] `agentLoop` - Preprocessor receives signal parameter

### Abort Signal Tests
- [ ] `agentLoop` - Abort signal passed to stream
- [ ] `agentLoop` - Abort signal passed to tool execution
- [ ] `agentLoop` - Abort signal passed to preprocessor
- [ ] `agentLoop` - Abort during streaming
- [ ] `agentLoop` - Abort during tool execution
- [ ] `agentLoop` - Agent end event with aborted status
- [ ] `agentLoop` - Messages accumulated before abort returned

### Error Handling Tests
- [ ] `agentLoop` - Stream error handling
- [ ] `agentLoop` - Agent end event with error status
- [ ] `agentLoop` - Tool execution error doesn't stop loop
- [ ] `agentLoop` - getQueuedMessages error doesn't stop loop
- [ ] `agentLoop` - Invalid assistant message handling
- [ ] `agentLoop` - Stop reason "error" ends loop
- [ ] `agentLoop` - Stop reason "aborted" ends loop

### Event Streaming Tests
- [ ] `agentLoop` - All event types emitted in correct order
- [ ] `agentLoop` - Message update events during streaming
- [ ] `agentLoop` - AssistantMessageEvent wrapped in message_update
- [ ] `agentLoop` - Event stream result promise resolves with messages
- [ ] `agentLoop` - Events can be consumed asynchronously

### Multi-Turn Conversation Tests
- [ ] `agentLoop` - Context accumulates across turns
- [ ] `agentLoop` - Assistant message added to context after turn
- [ ] `agentLoop` - Tool results visible in next turn
- [ ] `agentLoop` - Multiple tool-using turns in sequence
- [ ] `agentLoop` - Loop ends when no more tool calls
- [ ] `agentLoop` - Loop ends after final assistant response

---

## 5. Model Tests (`test/models/`)

### 5.1 Cost Calculation Tests (`test/models/cost.test.ts`)

- [ ] `calculateCost` - Input token cost calculation
- [ ] `calculateCost` - Output token cost calculation
- [ ] `calculateCost` - Cache read token cost calculation
- [ ] `calculateCost` - Cache write token cost calculation
- [ ] `calculateCost` - Total cost calculation (sum of all)
- [ ] `calculateCost` - Zero tokens result in zero cost
- [ ] `calculateCost` - Per-million token rate conversion
- [ ] `calculateCost` - Different model pricing rates
- [ ] `calculateCost` - OpenAI model costs
- [ ] `calculateCost` - Google model costs
- [ ] `calculateCost` - High token count accuracy
- [ ] `calculateCost` - Floating point precision

### 5.2 Model Registry Tests (`test/models/registry.test.ts`)

- [ ] `MODELS` - Contains OpenAI models
- [ ] `MODELS` - Contains Google models
- [ ] `MODELS` - Each model has required fields (id, name, api, baseUrl, etc.)
- [ ] `MODELS` - Model IDs are unique
- [ ] `MODELS` - Cost values are non-negative
- [ ] `MODELS` - Context window values are positive
- [ ] `MODELS` - Max tokens values are positive
- [ ] `MODELS` - Input types array is non-empty
- [ ] `MODELS` - API field matches provider ('openai' | 'google')
- [ ] `MODELS` - Reasoning flag is boolean
- [ ] `MODELS` - Headers are valid objects (if present)

---

## 6. Type Tests (`test/types/`)

### 6.1 Tool Definition Tests (`test/types/tool.test.ts`)

- [ ] `defineTool` - Returns tool unchanged
- [ ] `defineTool` - Type inference works correctly
- [ ] `defineTool` - TypeBox schema support
- [ ] `defineTool` - Tool name type extraction (ToolName)
- [ ] `defineTool` - Tool names array type extraction (ToolNames)
- [ ] `defineTool` - Tool array with 'as const' provides autocomplete

### 6.2 Message Type Tests (`test/types/message.test.ts`)

- [ ] `UserMessage` - Valid user message structure
- [ ] `UserMessage` - Text content type
- [ ] `UserMessage` - Image content type with base64 data
- [ ] `UserMessage` - File content type with base64 data
- [ ] `UserMessage` - Mixed content array
- [ ] `UserMessage` - Timestamp field
- [ ] `ToolResultMessage` - Valid tool result structure
- [ ] `ToolResultMessage` - Error flag and error details
- [ ] `ToolResultMessage` - Details field (generic type)
- [ ] `ToolResultMessage` - Tool name and call ID
- [ ] `NativeOpenAIMessage` - Provider field '_provider' is 'openai'
- [ ] `NativeOpenAIMessage` - Contains OpenAI Response object
- [ ] `NativeGoogleMessage` - Provider field '_provider' is 'google'
- [ ] `NativeGoogleMessage` - Contains Google GenerateContentResponse
- [ ] `AssistantMessage` - Standardized message structure
- [ ] `AssistantMessage` - Content array with mixed types
- [ ] `AssistantMessage` - Usage and cost fields
- [ ] `AssistantMessage` - Stop reason enum values

### 6.3 Context Type Tests (`test/types/context.test.ts`)

- [ ] `Context` - Valid context structure
- [ ] `Context` - Messages array
- [ ] `Context` - Optional system prompt
- [ ] `Context` - Optional tools array
- [ ] `Context` - Generic tools type parameter

---

## 7. Integration Tests (`test/integration/`)

### 7.1 End-to-End Streaming Tests (`test/integration/e2e-stream.test.ts`)

- [ ] E2E - Complete streaming flow with mocked provider
- [ ] E2E - User message → Stream → Assistant message
- [ ] E2E - Text streaming with delta accumulation
- [ ] E2E - Tool call streaming with argument parsing
- [ ] E2E - Cost calculation in complete flow
- [ ] E2E - Error handling in complete flow
- [ ] E2E - Multiple messages in context

### 7.2 End-to-End Agent Loop Tests (`test/integration/e2e-agent.test.ts`)

- [ ] E2E - Complete agent loop with tool execution
- [ ] E2E - Multi-turn conversation with context preservation
- [ ] E2E - Tool execution → result → continuation
- [ ] E2E - Agent events emitted in correct sequence
- [ ] E2E - Final messages contain all turns
- [ ] E2E - Error recovery in agent loop

### 7.3 Cross-Provider Tests (`test/integration/cross-provider.test.ts`)

- [ ] Cross-provider - Same context works with different providers
- [ ] Cross-provider - Event format consistency across providers
- [ ] Cross-provider - Cost calculation accuracy across providers
- [ ] Cross-provider - Message conversion limitations (OpenAI↔Google)
- [ ] Cross-provider - Tool execution works with both providers

---

## 8. Edge Cases and Error Handling Tests

### 8.1 Edge Cases (`test/edge-cases/`)

- [ ] Empty context (no messages, no system prompt)
- [ ] Very long context (near context window limit)
- [ ] Very long single message
- [ ] Unicode edge cases (emojis, surrogate pairs, special characters)
- [ ] Malformed base64 in image/file content
- [ ] Invalid MIME types
- [ ] Null/undefined in content arrays
- [ ] Circular references in tool arguments
- [ ] Very large tool argument objects
- [ ] Tool with no parameters
- [ ] Tool with optional parameters
- [ ] Tool with nested optional parameters
- [ ] Duplicate tool names
- [ ] Tool call with unknown tool name
- [ ] Tool call without ID
- [ ] Assistant message with empty content array
- [ ] Streaming interrupted mid-delta
- [ ] Network timeout during streaming
- [ ] Rate limit errors
- [ ] Invalid model ID

### 8.2 Error Recovery Tests (`test/error-recovery/`)

- [ ] Retry logic for transient failures
- [ ] Graceful degradation when validation unavailable
- [ ] Partial JSON recovery during streaming
- [ ] Tool execution error doesn't crash agent loop
- [ ] Stream error emits error event (doesn't throw)
- [ ] Invalid API response handling
- [ ] Missing required fields in API response
- [ ] Type mismatch in API response

---

## 9. Performance Tests (`test/performance/`)

- [ ] Event stream memory usage with many events
- [ ] Large context handling (10k+ messages)
- [ ] Rapid event emission (100+ events/sec)
- [ ] Concurrent agent loops (10+ simultaneous)
- [ ] Tool execution parallelization (if implemented)
- [ ] Memory cleanup after stream completion
- [ ] Large tool argument validation performance

---

## 10. Mock and Test Utilities

### Required Test Utilities
- [ ] Mock OpenAI SDK streaming responses
- [ ] Mock Google Gemini SDK streaming responses
- [ ] Mock AbortSignal implementation
- [ ] Helper to create test messages
- [ ] Helper to create test tools
- [ ] Helper to create test contexts
- [ ] Helper to assert event sequences
- [ ] Helper to assert message structure
- [ ] Helper to measure timing/performance
- [ ] Environment variable mocking utilities

---

## Test Coverage Goals

- **Target**: 90%+ code coverage
- **Critical Paths**: 100% coverage for:
  - Message conversion logic
  - Tool validation
  - Agent loop state management
  - Error handling paths
- **Provider Integration**: Mock by default, optional real API tests with env flag
- **Type Safety**: Ensure TypeScript types prevent invalid states

---

## Testing Strategy

1. **Unit Tests**: Test individual functions in isolation with mocks
2. **Integration Tests**: Test complete flows with mocked API responses
3. **E2E Tests** (Optional): Test against real APIs with environment flags
4. **Property-Based Tests**: Use fast-check for complex validation logic
5. **Snapshot Tests**: For complex objects (message conversions, event sequences)

---

## Priority Levels

### P0 (Critical - Implement First)
- Core stream function tests
- Message conversion tests
- Tool validation tests
- Agent loop basic flow tests
- Event stream tests

### P1 (High - Implement Second)
- Provider-specific streaming tests
- Tool execution tests
- Error handling tests
- Cost calculation tests

### P2 (Medium - Implement Third)
- Edge cases
- Performance tests
- Cross-provider tests
- Schema transformation tests

### P3 (Nice to Have)
- E2E tests with real APIs
- Property-based tests
- Advanced error recovery scenarios

---

**Total Estimated Tests**: ~250+ individual test cases

This comprehensive test suite will ensure the system is robust, handles edge cases gracefully, and maintains correctness across all features.
