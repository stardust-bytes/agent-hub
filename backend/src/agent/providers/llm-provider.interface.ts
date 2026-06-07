import { Response } from 'express';
import { ToolDefinition } from '../services/context-builder.service';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ function: { name: string; arguments: string } }>;
}

export interface LLMProvider {
  streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<{ finalText: string }>;
}
