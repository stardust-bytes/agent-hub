import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { OllamaMessage } from './providers/llm-provider.interface';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly sessionsService: SessionsService,
  ) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
    sessionId: number,
  ): Promise<void> {
    const history = await this.sessionsService.getHistory(sessionId);
    const messages: OllamaMessage[] = [...history, { role: 'user', content: message }];

    const { finalText } = await this.provider.streamChat(messages, model, res, signal);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }
}
