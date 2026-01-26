# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.38] - 2026-01-26

### Added
- **Cerebras Provider**: Full support for Cerebras Inference models
  - Implemented `gpt-oss-120b` (GPT OSS 120B) with 131K context window
  - Implemented `zai-glm-4.7` (Z.ai GLM 4.7) with 131K context window
  - Complete support for `complete` and `stream` functionality
  - Support for reasoning via `reasoning_format` parameter (`parsed`, `raw`, `hidden`, `none`)
  - Model-specific reasoning controls: `reasoning_effort` (GPT-OSS), `disable_reasoning` and `clear_thinking` (GLM)
  - Prompt caching support via `prompt_tokens_details.cached_tokens`
  - OpenAI-compatible chat completions API implementation
  - Added comprehensive unit and integration tests

## [0.0.37] - 2026-01-20

### Added
- **Z.AI Provider**: Full support for Z.AI (GLM) models
  - Implemented `glm-4.7` model with 200K context window
  - Complete support for `complete` and `stream` functionality
  - Support for thinking/reasoning mode via `reasoning_content` field
  - Support for preserved thinking across turns with `clear_thinking: false` parameter
  - OpenAI-compatible chat completions API implementation
  - Added comprehensive unit and integration tests

## [0.0.36] - 2026-01-07

### Added
- **Tool Execution Context**: Tools can now access conversation history during execution
  - Added `ToolExecutionContext` interface with read-only `messages` array
  - Optional `context` parameter added to `AgentTool.execute()` signature
  - Enables context-aware tools (e.g., deduplication, caching, referencing previous results)
  - Fully backward compatible - existing tools work without changes

## [0.0.35] - 2026-01-27

### Added
- **Conversation Limits**: Added optional cost and context limits to Conversation
  - `costLimit`: Stops execution if accumulated cost exceeds limit (pre-flight and during loop)
  - `contextLimit`: Stops execution if context size (last input tokens) exceeds limit
  - **Usage Tracking**: Added real-time tracking of `totalTokens`, `totalCost`, and `lastInputTokens` in `AgentState`
  - **Runtime Enforcement**: AgentRunner now strictly enforces limits during multi-step tool execution loops
  - Added specific error types for limit violations

## [0.0.34] - 2025-12-27

### Added
- **Anthropic Provider**: Full support for Anthropic (Claude) models
  - Implemented `claude-haiku-4-5`, `claude-sonnet-4-5`, and `claude-opus-4-5`
  - Complete support for `complete` and `stream` functionality
  - Added specific OAuth utilities for Anthropic
  - Added comprehensive unit and integration tests

## [0.0.33] - 2025-12-26

### Added
- **DeepSeek Provider**: Full support for DeepSeek models
  - Implemented `deepseek-reasoner` (DeepSeek V3.2)
  - Complete support for `complete` and `stream` functionality
  - Pricing and context window configuration added
  - Integration with unified SDK interface

## [0.0.32] - 2025-12-25

### Fixed
- **Google Provider**: Correct input token calculation by subtracting cached tokens from prompt token count.
- **Package**: Updated test script to run unit tests specifically in `prepublishOnly`.

## [0.0.31] - 2025-12-24

### Added
- **Cross-Provider Message Handoff**: Implement seamless conversation handoff between different LLM providers
  - OpenAI ↔ Google (Gemini) message conversion support
  - Preserves conversation context including thinking, tool calls, and responses
  - Thinking content wrapped in `<thinking>` tags for cross-provider context preservation
  - Tool call format conversion between provider-specific schemas
  - Unicode sanitization for cross-provider compatibility
- **Google Provider Integration Tests**: Complete integration test suite for Google provider
  - Basic completion tests
  - Usage tracking and cost calculation tests
  - Tool calling functionality tests
  - Error handling with abort signals
  - Multi-turn conversation tests
  - Cross-provider handoff scenarios
- **Comprehensive Unit Tests**: Added unit tests for cross-provider message conversion
  - Text response conversion tests
  - Thinking content conversion tests
  - Tool call format conversion tests
  - Mixed content handling tests
  - Empty content edge cases

### Fixed
- **Google Provider**: Fixed `stopReason` detection bug where tool calls at index 0 were not properly detected due to falsy value check
- **Google Provider**: Added proper `thoughtSignature` validation bypass for cross-provider tool calls

### Changed
- **OpenAI Provider**: Updated `buildOpenAIMessages` to support assistant messages from other providers
- **Google Provider**: Updated `buildGoogleMessages` to support assistant messages from other providers

## [0.0.3] - 2025-12-20

### Fixed
- Updated Gemini 3 Flash pricing to match current rates

## [0.0.2] - 2025-12-20

### Added
- Initial release with multi-provider support
- OpenAI provider implementation
- Google (Gemini) provider implementation
- Basic agent conversation support
