import { ToolDefinition } from '../services/context-builder.service';

export interface StreamChunk {
  type: 'token' | 'tool_call' | 'thinking' | 'done' | 'error';
  token?: string;
  toolCall?: { name: string; arguments: unknown };
  reasoningContent?: string;
  thinking?: string;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoningContent?: string;
  toolCallId?: string;
  toolCalls?: Array<{ id?: string; function: { name: string; arguments: unknown } }>;
}

export interface StreamOptions {
  model: string;
  messages: OllamaMessage[];
  tools: ToolDefinition[];
  signal: AbortSignal;
  baseUrl: string;
  key?: string;
}

export interface LLMProvider {
  stream(options: StreamOptions): AsyncGenerator<StreamChunk>;
}
