# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.35] - 2024-12-27

### Added
- **Conversation Limits**: Added optional cost and context limits to Conversation
  - `costLimit`: Stops execution if accumulated cost exceeds limit (pre-flight and during loop)
  - `contextLimit`: Stops execution if context size (last input tokens) exceeds limit
  - **Usage Tracking**: Added real-time tracking of `totalTokens`, `totalCost`, and `lastInputTokens` in `AgentState`
  - **Runtime Enforcement**: AgentRunner now strictly enforces limits during multi-step tool execution loops
  - Added specific error types for limit violations

## [0.0.34] - 2024-12-27

### Added
- **Anthropic Provider**: Full support for Anthropic (Claude) models
  - Implemented `claude-haiku-4-5`, `claude-sonnet-4-5`, and `claude-opus-4-5`
  - Complete support for `complete` and `stream` functionality
  - Added specific OAuth utilities for Anthropic
  - Added comprehensive unit and integration tests

## [0.0.33] - 2024-12-26

### Added
- **DeepSeek Provider**: Full support for DeepSeek models
  - Implemented `deepseek-reasoner` (DeepSeek V3.2)
  - Complete support for `complete` and `stream` functionality
  - Pricing and context window configuration added
  - Integration with unified SDK interface

## [0.0.32] - 2024-12-25

### Fixed
- **Google Provider**: Correct input token calculation by subtracting cached tokens from prompt token count.
- **Package**: Updated test script to run unit tests specifically in `prepublishOnly`.

## [0.0.31] - 2024-12-24

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

## [0.0.3] - 2024-12-20

### Fixed
- Updated Gemini 3 Flash pricing to match current rates

## [0.0.2] - 2024-12-20

### Added
- Initial release with multi-provider support
- OpenAI provider implementation
- Google (Gemini) provider implementation
- Basic agent conversation support
