import { Injectable } from '@nestjs/common';
import { AgentLoopService } from '../services/agent-loop.service';
import { ToolDefinition } from '../services/context-builder.service';
import { WriteStream } from '../dto/write-stream.interface';

@Injectable()
export class SubagentService {
  constructor(private readonly agentLoop: AgentLoopService) {}

  async delegate(
    tasks: string[],
    providerType: string,
    model: string,
    providerConfig: { baseUrl: string; key?: string },
    tools: ToolDefinition[],
    signal: AbortSignal,
    res: WriteStream,
    sessionId?: number,
    mode: string = 'agent',
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    res.write(`data: ${JSON.stringify({ delegate: { requestId, taskCount: tasks.length } })}\n\n`);

    const promises = tasks.map((task, i) => {
      res.write(`data: ${JSON.stringify({ delegateProgress: { requestId, index: i, subtask: task, status: 'running' } })}\n\n`);
      return this.spawn(task, providerType, model, providerConfig, tools, signal, res, sessionId, mode)
        .then(result => ({ index: i, task, status: 'completed' as const, summary: result.slice(0, 200) }))
        .catch((err: Error) => ({ index: i, task, status: 'failed' as const, summary: err.message ?? 'Unknown error' }));
    });

    const settled = await Promise.allSettled(promises);
    const results: Array<{ index: number; task: string; status: string; summary: string }> = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { index: i, task: tasks[i], status: 'failed', summary: 'Promise rejected' };
    });

    res.write(`data: ${JSON.stringify({ delegateResult: { requestId, results } })}\n\n`);

    return results.map(r => `Task ${r.index}: [${r.status}] ${r.task}\n  ${r.summary}`).join('\n');
  }

  async spawn(
    task: string,
    providerType: string,
    model: string,
    providerConfig: { baseUrl: string; key?: string },
    tools: ToolDefinition[],
    signal: AbortSignal,
    res: WriteStream,
    sessionId?: number,
    mode: string = 'agent',
  ): Promise<string> {
    const subagentPrompt =
      `You are a sub-agent. Your task: ${task}\n\n` +
      'You have access to the same workspace tools. Complete the task and report back concisely.';

    const subRes = this.createPrefixedResponse(res);

    return this.agentLoop.run(
      providerType, model, subagentPrompt, [], task,
      tools, subRes, signal, sessionId, mode, providerConfig,
    );
  }

  private createPrefixedResponse(res: WriteStream): WriteStream {
    const originalWrite = res.write.bind(res);
    return {
      write(data: string): boolean {
        if (/^data: \[DONE\]\n?$/m.test(data)) {
          return originalWrite('data: {"subagent":true,"done":true}\n\n');
        }
        const modified = data.replace(
          /^(data: )(\{.*?\})(\n\n)$/gm,
          (_match: string, prefix: string, json: string, suffix: string) => {
            try {
              const parsed = JSON.parse(json);
              parsed.subagent = true;
              return `${prefix}${JSON.stringify(parsed)}${suffix}`;
            } catch {
              return _match;
            }
          },
        );
        return originalWrite(modified);
      },
    };
  }
}
