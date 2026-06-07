import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';

@Injectable()
export class AgentService {
  constructor(private readonly provider: OllamaProvider) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    await this.provider.streamChat(message, model, res, signal);
  }
}
