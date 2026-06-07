import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { OllamaMessage } from './providers/llm-provider.interface';

@Injectable()
export class AgentService {
  constructor(private readonly provider: OllamaProvider) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    const messages: OllamaMessage[] = [{ role: 'user', content: message }];
    await this.provider.streamChat(messages, model, res, signal);
  }
}
