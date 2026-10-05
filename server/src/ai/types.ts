export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  name: string;
  /** Returns a complete (non-streaming) response. Used by MVP. */
  chat(messages: ChatMessage[], opts?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string>;
  /** Streams response tokens as an async iterable of text deltas. */
  stream?(messages: ChatMessage[], opts?: { model?: string; temperature?: number; maxTokens?: number }): AsyncIterable<string>;
}

export class AIConfigError extends Error {}
