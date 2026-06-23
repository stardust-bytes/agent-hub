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
  images?: string[];
  reasoningContent?: string;
  toolCallId?: string;
  toolCalls?: Array<{ id?: string; function: { name: string; arguments: unknown } }>;
}

const VISION_MODELS = new Set([
  'llava', 'llava:7b', 'llava:13b', 'llava:34b',
  'bakllava', 'bakllava:7b',
  'moondream',
  'gpt-4o', 'gpt-4o-2024-05-13', 'gpt-4o-2024-08-06', 'gpt-4o-mini',
  'gpt-4-turbo', 'gpt-4-vision-preview',
  'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
  'claude-3-5-sonnet', 'claude-3-5-haiku',
  'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash',
  'gemini-2.0-flash',
]);

export function isVisionModel(model: string): boolean {
  const lower = model.toLowerCase();
  for (const pattern of VISION_MODELS) {
    if (lower === pattern || lower.startsWith(pattern)) return true;
  }
  return false;
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
