import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentLoopService } from '../agent/services/agent-loop.service';
import { ContextBuilderService } from '../agent/services/context-builder.service';
import { ProvidersService } from '../providers/providers.service';
import { SessionsService } from '../sessions/sessions.service';
import { CoworkService } from '../cowork/cowork.service';
import { AgentRunState } from '../agent/dto/agent-run-state';

class CapturingWriteStream {
  private buffer = ''
  write(data: string) { this.buffer += data; return true; }
  end() {}
  getOutput() { return this.buffer; }
}

@Injectable()
export class ScheduleRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentLoop: AgentLoopService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
    private readonly sessionsService: SessionsService,
    private readonly cowork: CoworkService,
  ) {}

  async runNow(taskId: number) {
    const task = await this.prisma.scheduleTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error(`ScheduleTask ${taskId} not found`);

    const log = await this.prisma.scheduleTaskLog.create({
      data: { taskId, status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const session = await this.sessionsService.create(`Task - ${task.name}`);
      const projectPath = task.projectPath ?? undefined;

      if (task.projectPath) {
        await this.cowork.setProject(task.projectPath).catch(() => {});
      }

      let providerType = 'ollama';
      let modelName = '';
      let providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' };

      if (task.modelId) {
        const model = await this.providersService.findModelWithProvider(task.modelId);
        if (model) {
          providerType = model.provider.type ?? 'ollama';
          modelName = model.name;
          providerConfig = {
            baseUrl: model.provider.baseUrl ?? 'http://localhost:11434',
            key: model.provider.key ?? undefined,
          };
        }
      } else {
        const models = await this.providersService.findAll();
        if (models.length > 0 && models[0].models && models[0].models.length > 0) {
          const first = models[0].models[0];
          modelName = first.name;
        }
      }

      if (!modelName) {
        throw new Error('No available model found. Please configure a provider first.');
      }

      const stream = new CapturingWriteStream();
      const signal = new AbortController().signal;
      const runState = {
        step: 0, maxIterations: 10, roomId: String(session.id),
        steps: [], startTime: Date.now(), currentState: 'PLANNING',
      } as AgentRunState;
      const context = await this.contextBuilder.build(runState, session.id);

      const finalText = await this.agentLoop.run(
        providerType, modelName, context.systemPrompt, [],
        task.prompt, context.tools, stream as any, signal, session.id,
        projectPath ?? undefined, providerConfig,
      );

      const output = finalText || stream.getOutput();

      await this.prisma.scheduleTaskLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', output, completedAt: new Date(), sessionId: session.id },
      });

      return this.prisma.scheduleTaskLog.findUnique({ where: { id: log.id } });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      await this.prisma.scheduleTaskLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', output: errorMsg, completedAt: new Date() },
      });
      return this.prisma.scheduleTaskLog.findUnique({ where: { id: log.id } });
    }
  }
}
