# Pricing
-> Image pricing is different
-> Streaming pricing?

# Native Tools
Add native tool supports in models
Tools should be defined instead of string[]

# Error catch in providers

# Forming Tool Result Error in appropriate way






Conversation
1. Can be initialized without any config, with default model and provider options.
2. Can be initialized with stored messages
3. Can change model


Variables
1) Model
2) Provider options
3) Messages
4) System prompt
5) Tools

Things it should handle
1) Passing Events
2) Provider features
3) Live state -> is streaming, tool calls, etc.
4) Queues
5) Send Message



What i want from (Coding Agent)

Features

1) Change Model, Same provider.
-> Same provider, no problem.

2) Different provider, New branch
Branching methods. Each session checkpoint has id. Can branch from any of it and so on. Ability to rename/resume session.

3) Rewind code?

4) Export conversation. 

