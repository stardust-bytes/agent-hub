import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { OllamaMessage } from './providers/llm-provider.interface';
import { SessionsService } from '../sessions/sessions.service';
import { ContextBuilderService } from './services/context-builder.service';
import { AgentRunState } from './dto/agent-run-state';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
    sessionId: number,
  ): Promise<void> {
    const runState = new AgentRunState(10, String(sessionId));
    const context = await this.contextBuilder.build(runState, sessionId);

    const history = await this.sessionsService.getHistory(sessionId);
    const messages: OllamaMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const { finalText } = await this.provider.streamChat(messages, model, res, signal, sessionId);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
      if (finalText) {
        await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
        await this.sessionsService.autoTitle(sessionId, message);
      }
    }
  }
}
