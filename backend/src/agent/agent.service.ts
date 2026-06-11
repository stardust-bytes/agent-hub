import { Injectable } from '@nestjs/common';
import { AgentLoopService } from './services/agent-loop.service';
import { ContextBuilderService } from './services/context-builder.service';
import { SessionsService } from '../sessions/sessions.service';
import { ProvidersService } from '../providers/providers.service';
import { PermissionsService } from './services/permissions.service';
import { PlansService } from '../plans/plans.service';
import { PermissionsConfig } from './dto/permissions-config';
import { AgentRunState } from './dto/agent-run-state';
import { SubagentService } from './subagent/subagent.service';
import { WriteStream } from './dto/write-stream.interface';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentLoop: AgentLoopService,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
    private readonly permissionsService: PermissionsService,
    private readonly plansService: PlansService,
    private readonly subagentService: SubagentService,
  ) {}

  async streamChat(
    message: string,
    providerModelId: number,
    res: WriteStream,
    signal: AbortSignal,
    sessionId: number,
    mode: string = 'agent',
  ): Promise<void> {
    if (!sessionId || sessionId <= 0) {
      res.write('data: {"error":"Invalid session ID"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

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

    if (mode === 'cowork' && message.startsWith('/plan ')) {
      const approveMatch = message.match(/^\/plan approve (\d+)$/);
      if (approveMatch) {
        const planId = parseInt(approveMatch[1], 10);
        if (!isNaN(planId)) {
          if (!signal.aborted) {
            await this.sessionsService.saveMessage(sessionId, 'user', message);
          }
          await this.plansService.approve(planId);
          const runState = {
            step: 0, maxIterations: 10, roomId: String(sessionId),
            steps: [], startTime: Date.now(), currentState: 'PLANNING',
          } as AgentRunState;
          const context = await this.contextBuilder.build(runState, sessionId, mode);
          await this.agentLoop.executePlan(
            planId, providerType, providerModel.name, context.systemPrompt,
            context.tools, providerConfig, signal, res, sessionId,
          );
          return;
        }
      }

      const resumeMatch = message.match(/^\/plan resume (\d+)$/);
      if (resumeMatch) {
        const planId = parseInt(resumeMatch[1], 10);
        if (!isNaN(planId)) {
          if (!signal.aborted) {
            await this.sessionsService.saveMessage(sessionId, 'user', message);
          }
          const runState = {
            step: 0, maxIterations: 10, roomId: String(sessionId),
            steps: [], startTime: Date.now(), currentState: 'PLANNING',
          } as AgentRunState;
          const context = await this.contextBuilder.build(runState, sessionId, mode);
          await this.agentLoop.executePlan(
            planId, providerType, providerModel.name, context.systemPrompt,
            context.tools, providerConfig, signal, res, sessionId,
          );
          return;
        }
      }

      const rejectMatch = message.match(/^\/plan reject (\d+)$/);
      if (rejectMatch) {
        const planId = parseInt(rejectMatch[1], 10);
        if (!isNaN(planId)) {
          await this.plansService.reject(planId);
        }
        // Fall through to normal run so LLM can respond about the cancellation
      } else {
        const taskText = message.slice(6).trim();
        if (!signal.aborted) {
          await this.sessionsService.saveMessage(sessionId, 'user', message);
        }
        await this.agentLoop.runPlanMode(
          taskText, providerType, providerModel.name, providerConfig, sessionId, res,
        );
        return;
      }
    }

    if (message.startsWith('/delegate ')) {
      const delegateMatch = message.match(/^\/delegate (parallel|sequential) (.+)$/);
      if (!delegateMatch) {
        res.write(`data: ${JSON.stringify({ error: 'Usage: /delegate parallel|sequential <requestId>' })}\n\n`);
        res.write('data: [DONE]\n\n');
        return;
      }

      const action = delegateMatch[1];
      const requestId = delegateMatch[2].trim();
      const delegation = this.subagentService.getDelegation(requestId);

      if (!delegation) {
        res.write(`data: ${JSON.stringify({ error: 'Delegation request not found or expired' })}\n\n`);
        res.write('data: [DONE]\n\n');
        return;
      }

      this.subagentService.removeDelegation(requestId);

      if (!signal.aborted) {
        await this.sessionsService.saveMessage(sessionId, 'user', message);
      }

      if (action === 'parallel') {
        await this.sessionsService.saveMessage(
          sessionId, 'system', `[Running ${delegation.subtasks.length} subtasks via sub-agents...]`
        );

        for (let i = 0; i < delegation.subtasks.length; i++) {
          if (signal.aborted) break;
          const subtask = delegation.subtasks[i];
          await this.sessionsService.saveMessage(
            sessionId, 'system', `[Subtask ${i + 1}/${delegation.subtasks.length}] ${subtask}`
          );

          try {
            await this.subagentService.spawn(
              subtask,
              providerType,
              providerModel.name,
              providerConfig,
              delegation.tools,
              signal,
              res,
              sessionId,
              delegation.mode,
            );
          } catch (e) {
            const errMsg = `Subtask ${i + 1} failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
            await this.sessionsService.saveMessage(sessionId, 'system', `[Error] ${errMsg}`);
          }
        }

        if (!signal.aborted) {
          await this.sessionsService.saveMessage(
            sessionId, 'system', '[All subtasks completed]'
          );
        }
        res.write('data: [DONE]\n\n');
      } else if (action === 'sequential') {
        const runState = {
          step: 0, maxIterations: 10, roomId: String(sessionId),
          steps: [], startTime: Date.now(), currentState: 'PLANNING',
        } as AgentRunState;
        const seqContext = await this.contextBuilder.build(runState, sessionId, delegation.mode);
        const history = await this.sessionsService.getHistory(sessionId);
        await this.sessionsService.saveMessage(sessionId, 'user', delegation.task);
        const finalText = await this.agentLoop.run(
          providerType, providerModel.name, seqContext.systemPrompt,
          history, delegation.task, seqContext.tools, res,
          signal, sessionId, delegation.mode, providerConfig,
        );
        if (!signal.aborted && finalText) {
          await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
        }
      }
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
    res: WriteStream,
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
