export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ToolCall {
  id?: string;
  type?: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionInput {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  tools?: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatCompletionOutput {
  content: string;
  toolCalls: ToolCall[];
  usage?: { promptTokens?: number; completionTokens?: number };
  model?: string;
}

export interface AIProvider {
  name: string;
  /** One-shot completion. Supports tools when available. */
  chat(messages: ChatMessage[], opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json_object';
    tools?: ChatCompletionInput['tools'];
    toolChoice?: ChatCompletionInput['toolChoice'];
    signal?: AbortSignal;
  }): Promise<string>; // kept for backward compat with older routes
  /** Structured completion (returns content + tool calls) */
  complete(input: ChatCompletionInput): Promise<ChatCompletionOutput>;
  /** Stream tokens */
  stream?(messages: ChatMessage[], opts?: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }): AsyncIterable<string>;
}

export class AIConfigError extends Error {}
