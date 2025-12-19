 Critical Bugs

  1. Shared State Between Instances (conversation.ts:21-28, 44-48)

  const defaultConversationState: AgentState = {
      messages: [],  // Single shared array!
      tools: [],     // Single shared array!
      pendingToolCalls: new Set<string>(),  // Single shared Set!
      ...
  }

  constructor(opts: AgentOptions) {
      this._state = { ...this._state, ...opts.initialState };  // Shallow copy!
  }
  Problem: All Conversation instances share the same messages, tools, and pendingToolCalls references unless explicitly overridden in initialState. Mutations in one instance corrupt others.

  2. isStreaming Never Reset (conversation.ts:241)

  this._state.isStreaming = true;  // Set in _prepareRun
  // NEVER set back to false anywhere!
  Problem: After any prompt completes (success, error, or abort), isStreaming remains true forever.

  3. runningPrompt Never Resolves (conversation.ts:236-238)

  this.runningPrompt = new Promise<void>((resolve) => {
      this.resolveRunningPrompt = resolve;
  });
  // resolveRunningPrompt is NEVER called!
  Problem: waitForIdle() will hang forever since the promise never resolves.

  4. Message Array Mutation in Continue Path (conversation.ts:302)

  // In _runAgentLoopContinue:
  await this._runLoop(cfg, llmMessages, newMessages);

  // In _runLoop:
  updatedMessages.push(llm);  // Mutates llmMessages!
  updatedMessages.push(...toolResults);  // Mutates llmMessages!
  Problem: When continue() is called, llmMessages (potentially same reference as this._state.messages via default transformer) gets mutated with push(), causing duplicate messages in state.

  5. Default Transformer Returns Same Reference (conversation.ts:30-32)

  const defaultMessageTransformer = (messages: Message[]) => {
      return messages  // Returns same array reference!
  }
  Problem: Combined with issue #4, this causes state corruption.

  ---
  Logic Errors

  6. Race Condition - No Concurrent Run Protection (conversation.ts:158, 212)

  async prompt(...): Promise<Message[]> {
      // No check if already running!
      const newMessages = await this._runAgentLoop(userMessage);
  }
  Problem: Multiple concurrent prompt() or continue() calls can overlap, causing unpredictable behavior.

  7. Abort Doesn't Clean Up State (conversation.ts:115-117)

  abort() {
      this.abortController?.abort();
      // Doesn't: set isStreaming=false, resolve runningPrompt, clear pendingToolCalls
  }

  8. Reset Doesn't Handle Running Prompts (conversation.ts:130-136)

  reset() {
      this._state.messages = [];
      // Doesn't abort running prompt or resolve runningPrompt
      // abortController not cleared
  }

  9. Duplicate Validation in Continue Path (conversation.ts:213-221 and 290-296)

  // In continue():
  if (lastMessage.role !== "user" && lastMessage.role !== "toolResult") { ... }

  // In _runAgentLoopContinue():
  if (lastMessage.role !== "user" && lastMessage.role !== "toolResult") { ... }                      Problem: Validates on raw messages in continue(), then on transformed messages in _runAgentLoopContinue(). Transformer could filter/change messages, causing inconsistent validation results.

  10. Tool Abort Not Checked Between Executions (conversation.ts:388)

  for (const toolCall of toolCalls) {
      // No signal.aborted check here before starting next tool
      result = await tool.execute(...);
  }
  Problem: If aborted mid-execution, next tool still starts before the signal propagates.

  11. pendingToolCalls Never Used (types.ts:57, conversation.ts)

  pendingToolCalls: Set<string>;  // Declared in AgentState
  // Never read or written anywhere in Conversation class

  ---
  Type Issues

  12. Inconsistent State Access (conversation.ts:71)

  setProvider(provider: Provider<Api>){
      this.state.provider = provider  // Uses getter
  }
  setSystemPrompt(v: string) {
      this._state.systemPrompt = v;  // Uses private field directly
  }

  13. Unnecessary Non-null Assertions (conversation.ts:17, 307)

  model: getModel('google', 'gemini-3-flash-preview')!,  // Could be undefined
  const signal: AbortSignal = this.abortController?.signal!;  // Could be undefined

  14. Misleading Generic on executeToolCalls (conversation.ts:383)

  private async executeToolCalls<T>(...): Promise<ToolResultMessage<T>[]>{
      const results: ToolResultMessage<any>[] = [];  // Uses any, not T
  Problem: Generic T is unused; each tool has its own details type.

  15. Provider Type Loses Specificity (types.ts:51-54)

  export interface AgentState {
      provider: Provider<Api>;  // Generic Api loses specific type
  }
  Problem: Can't access provider-specific options with type safety.

  16. Unnecessary Optional Chaining (conversation.ts:325, 377)

  this.emit({type: 'message_start', messageId: llm?.id!, messageType: llm?.role })
  // llm is already checked with `if (llm)` above

  queuedMessages = (await cfg.getQueuedMessages?.()) || [];
  // getQueuedMessages is not optional in AgentLoopConfig

  ---
  Inconsistency Issues

  17. Mutation Pattern Inconsistency (conversation.ts:90-96)

  appendMessage(m: Message) {
      this._state.messages = [...this._state.messages, m];  // Immutable
  }
  appendMessages(ms: Message[]){
      this.state.messages.push(...ms)  // Mutable
  }

  18. message_update Only Used for Custom Messages (conversation.ts:152)

  // Only emitted here:
  this.emit({type: 'message_update', messageId, messageType: 'custom', message: customMessage});
  // Never for user, assistant, or toolResult messages
  Problem: Event exists in types but inconsistently used.

  19. Event Ordering in addCustomMessage (conversation.ts:145-156)

  this.emit({type: 'message_start', ...});
  this.emit({type: 'message_update', ...});
  await this.waitForIdle();  // Events emitted BEFORE idle
  this.appendMessage(customMessage);
  this.emit({type: 'message_end', ...});
  Problem: Start/update events fire before the running prompt completes, end event fires after.

  ---
  Missing Error Handling

  20. No Try-Catch Around Complete Call (conversation.ts:338-346)

  const assistantMessage = await complete(...);
  // If complete throws unexpectedly, no cleanup happens

  21. No Error State Set on Loop Errors

  When errors occur, this._state.error is never set with the error message.

  ---
  Memory/Resource Issues

  22. Listeners Never Cleared (conversation.ts:36)

  private listeners = new Set<(e: AgentEvent) => void>();
  // No method to clear all listeners; subscribers must manually unsubscribe

  23. AbortController Not Cleaned Up

  Old abort controllers are replaced but never explicitly cleaned up.

  ---
  Missing Functionality

  24. No Message Removal/Edit Methods

  Can't remove or edit individual messages from conversation.

  25. No Serialization Support

  Can't save/load conversation state (messages contain methods like getContent()).

  26. Sequential Tool Execution Only (conversation.ts:388)

  Tools execute one at a time with for...of. No parallel execution option.

  ---
  Recommendations Summary

  Must Fix Immediately:
  1. Deep clone default state in constructor
  2. Add cleanup logic (resolve promise, reset isStreaming) at end of _runLoop and error paths
  3. Clone llmMessages before passing to _runLoop in continue path
  4. Add concurrency protection (check/throw if already running)

  Should Fix:
  5. Make mutation patterns consistent (prefer immutable)
  6. Add try-finally for cleanup in _runLoop
  7. Remove unused pendingToolCalls or implement it
  8. Fix default transformer to return messages.slice()