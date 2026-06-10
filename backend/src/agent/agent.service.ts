import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AgentLoopService } from './services/agent-loop.service';
import { ContextBuilderService } from './services/context-builder.service';
import { SessionsService } from '../sessions/sessions.service';
import { ProvidersService } from '../providers/providers.service';
import { PermissionsService } from './services/permissions.service';
import { PermissionsConfig } from './dto/permissions-config';
import { AgentRunState } from './dto/agent-run-state';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentLoop: AgentLoopService,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
    private readonly permissionsService: PermissionsService,
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
    const providerType = providerModel.provider.type ?? 'ollama';

    if (message.startsWith('/plan ')) {
      const taskText = message.slice(6).trim();
      if (!signal.aborted) {
        await this.sessionsService.saveMessage(sessionId, 'user', message);
      }
      await this.agentLoop.runPlanMode(
        taskText, providerType, providerModel.name, providerConfig, sessionId, res,
      );
      return;
    }

    const runState = {
      step: 0, maxIterations: 10, roomId: String(sessionId),
      steps: [], startTime: Date.now(), currentState: 'PLANNING',
    } as AgentRunState;
    const context = await this.contextBuilder.build(runState, sessionId, mode);
    const history = await this.sessionsService.getHistory(sessionId);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
    }

    const finalText = await this.agentLoop.run(
      providerType, providerModel.name, context.systemPrompt, history,
      message, context.tools, res, signal, sessionId, mode, providerConfig,
    );

    if (!signal.aborted && finalText) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }

  async executePlan(
    planId: number,
    providerModelId: number,
    sessionId: number,
    signal: AbortSignal,
    res: Response,
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
    const providerType = providerModel.provider.type ?? 'ollama';

    const runState = {
      step: 0, maxIterations: 10, roomId: String(sessionId),
      steps: [], startTime: Date.now(), currentState: 'PLANNING',
    } as AgentRunState;
    const context = await this.contextBuilder.build(runState, sessionId);

    await this.agentLoop.executePlan(
      planId, providerType, providerModel.name,
      context.systemPrompt, context.tools, providerConfig, signal, res, sessionId,
    );
  }

  async getPermissions(): Promise<PermissionsConfig> {
    return this.permissionsService.getConfig();
  }

  async updatePermissions(updates: Partial<PermissionsConfig>): Promise<PermissionsConfig> {
    return this.permissionsService.updateConfig(updates);
  }
}
