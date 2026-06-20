import { Injectable } from '@nestjs/common';
import { AgentLoopService } from './services/agent-loop.service';
import { ContextBuilderService } from './services/context-builder.service';
import { SessionsService } from '../sessions/sessions.service';
import { ProvidersService } from '../providers/providers.service';
import { PermissionsService } from './services/permissions.service';
import { CoworkService } from '../cowork/cowork.service';
import { PlansService } from '../plans/plans.service';
import { PermissionsConfig } from './dto/permissions-config';
import { AgentRunState } from './dto/agent-run-state';
import { WriteStream } from './dto/write-stream.interface';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';
import { parseAgentCommand } from './dto/agent-command.util';
import { filterSubagentTools } from './subagent/subagent-tools.util';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentLoop: AgentLoopService,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
    private readonly permissionsService: PermissionsService,
    private readonly plansService: PlansService,
    private readonly cowork: CoworkService,
    private readonly agentProfiles: AgentProfilesService,
  ) {}

  async streamChat(
    message: string,
    providerModelId: number,
    res: WriteStream,
    signal: AbortSignal,
    sessionId: number,
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

    const project = await this.cowork.getProject().catch(() => null);
    const projectPath = project ?? undefined;

    const agentCmd = parseAgentCommand(message);
    if (agentCmd) {
      const profile = await this.agentProfiles.findBySlug(agentCmd.slug);
      if (!profile || !profile.enabled) {
        const enabled = await this.agentProfiles.findEnabled();
        const slugs = enabled.map(p => p.slug).join(', ') || '(none)';
        res.write(`data: ${JSON.stringify({ error: `unknown agent profile "${agentCmd.slug}". Available: ${slugs}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        return;
      }

      let cmdProviderType = providerType;
      let cmdModel = providerModel.name;
      let cmdProviderConfig = providerConfig;
      if (profile.modelId) {
        const pm = await this.providersService.findModelWithProvider(profile.modelId);
        if (pm) {
          cmdProviderType = pm.provider.type ?? 'ollama';
          cmdModel = pm.name;
          cmdProviderConfig = {
            baseUrl: pm.provider.baseUrl ?? 'http://localhost:11434',
            key: pm.provider.key ?? undefined,
          };
        }
      }

      const runState = {
        step: 0, maxIterations: 10, roomId: String(sessionId),
        steps: [], startTime: Date.now(), currentState: 'PLANNING',
      } as AgentRunState;
      const context = await this.contextBuilder.build(runState, sessionId, profile.systemPrompt);
      const tools = filterSubagentTools(context.tools, profile.allowedTools);
      const history = await this.sessionsService.getHistory(sessionId);
      if (!signal.aborted) {
        await this.sessionsService.saveMessage(sessionId, 'user', message);
      }
      await this.agentLoop.run(
        cmdProviderType, cmdModel, profile.systemPrompt, history,
        agentCmd.task, tools, res, signal, sessionId, projectPath, cmdProviderConfig,
      );
      if (!signal.aborted) {
        await this.sessionsService.autoTitle(sessionId, message);
      }
      return;
    }

    if (message.startsWith('/plan ')) {
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
          const context = await this.contextBuilder.build(runState, sessionId);
          await this.agentLoop.executePlan(
            planId, providerType, providerModel.name, context.systemPrompt,
            context.tools, providerConfig, signal, res, sessionId, projectPath,
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
          const context = await this.contextBuilder.build(runState, sessionId);
          await this.agentLoop.executePlan(
            planId, providerType, providerModel.name, context.systemPrompt,
            context.tools, providerConfig, signal, res, sessionId, projectPath,
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
          taskText, providerType, providerModel.name, providerConfig, sessionId, res, signal,
        );
        return;
      }
    }

    const runState = {
      step: 0, maxIterations: 10, roomId: String(sessionId),
      steps: [], startTime: Date.now(), currentState: 'PLANNING',
    } as AgentRunState;
    const context = await this.contextBuilder.build(runState, sessionId);
    const history = await this.sessionsService.getHistory(sessionId);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
    }

    const finalText = await this.agentLoop.run(
      providerType, providerModel.name, context.systemPrompt, history,
      message, context.tools, res, signal, sessionId, projectPath, providerConfig,
    );

    if (!signal.aborted) {
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

    const project = await this.cowork.getProject().catch(() => null);
    const projectPath = project ?? undefined;

    const runState = {
      step: 0, maxIterations: 10, roomId: String(sessionId),
      steps: [], startTime: Date.now(), currentState: 'PLANNING',
    } as AgentRunState;
    const context = await this.contextBuilder.build(runState, sessionId);

    await this.agentLoop.executePlan(
      planId, providerType, providerModel.name,
      context.systemPrompt, context.tools, providerConfig, signal, res, sessionId, projectPath,
    );
  }

  async getPermissions(): Promise<PermissionsConfig> {
    return this.permissionsService.getConfig();
  }

  async updatePermissions(updates: Partial<PermissionsConfig>): Promise<PermissionsConfig> {
    return this.permissionsService.updateConfig(updates);
  }
}
