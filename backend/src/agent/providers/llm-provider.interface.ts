import { Response } from 'express';

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export interface LLMProvider {
  streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<{ finalText: string }>;
}
