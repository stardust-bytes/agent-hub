import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { OllamaMessage } from './providers/llm-provider.interface';
import { SessionsService } from '../sessions/sessions.service';
import { ContextBuilderService } from './services/context-builder.service';
import { AgentRunState } from './dto/agent-run-state';
import { ProvidersService } from '../providers/providers.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
  ) {}

  async streamChat(
    message: string,
    providerModelId: number,
    res: Response,
    signal: AbortSignal,
    sessionId: number,
    mode: string = 'agent',
  ): Promise<void> {
    const providerModel = await this.providersService.findModelWithProvider(providerModelId);
    if (!providerModel) {
      res.write('data: {"error":"provider_not_found"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

    const providerConfig = {
      baseUrl: providerModel.provider.baseUrl ?? 'http://localhost:11434',
      key: providerModel.provider.key ?? undefined,
    };

    const runState = new AgentRunState(10, String(sessionId));
    const context = await this.contextBuilder.build(runState, sessionId);

    const history = await this.sessionsService.getHistory(sessionId);
    const messages: OllamaMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
    }

    const { finalText } = await this.provider.streamChat(
      messages, providerModel.name, res, signal, sessionId, mode, providerConfig,
    );

    if (!signal.aborted && finalText) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }
}
