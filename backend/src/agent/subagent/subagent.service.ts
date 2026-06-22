import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as crypto from 'crypto';
import { AgentLoopService } from '../services/agent-loop.service';
import { ToolDefinition } from '../services/context-builder.service';
import { WriteStream } from '../dto/write-stream.interface';
import { runWithConcurrency } from './subagent-tools.util';

@Injectable()
export class SubagentService {
  private static readonly MAX_PARALLEL = 4;

  constructor(@Inject(forwardRef(() => AgentLoopService)) private readonly agentLoop: AgentLoopService) {}

  async delegate(
    tasks: string[],
    providerType: string,
    model: string,
    providerConfig: { baseUrl: string; key?: string },
    tools: ToolDefinition[],
    signal: AbortSignal,
    res: WriteStream,
    sessionId?: number,
    projectPath?: string,
    systemPromptOverride?: string,
    subagentName?: string,
  ): Promise<string> {
    if (signal.aborted) return 'Aborted';

    const requestId = crypto.randomUUID();

    res.write(`data: ${JSON.stringify({ delegate: { requestId, taskCount: tasks.length } })}\n\n`);

    const results = await runWithConcurrency(tasks, SubagentService.MAX_PARALLEL, async (task, i) => {
      res.write(`data: ${JSON.stringify({ delegateProgress: { requestId, index: i, subtask: task, status: 'running' } })}\n\n`);
      try {
        const summary = await this.spawn(task, providerType, model, providerConfig, tools, signal, res, sessionId, projectPath, systemPromptOverride, subagentName);
        return { index: i, task, status: 'completed' as const, summary: summary.slice(0, 200) };
      } catch (err) {
        return { index: i, task, status: 'failed' as const, summary: (err as Error).message ?? 'Unknown error' };
      }
    });

    res.write(`data: ${JSON.stringify({ delegateResult: { requestId, results } })}\n\n`);

    return results.map(r => `Delegate result ${r.index}: [${r.status}] — ${r.task}\n  Summary: ${r.summary}`).join('\n');
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
    projectPath?: string,
    systemPromptOverride?: string,
    subagentName?: string,
    subagentRunId?: string,
  ): Promise<string> {
    const runId = subagentRunId ?? crypto.randomUUID();
    let projectContext = '';
    if (projectPath) {
      projectContext = `\nThe current working project is at: ${projectPath}\nUse this directory as the base path for all file operations (read_file, write_file, list_directory, glob, grep).\n`;
    }
    const subagentPrompt = systemPromptOverride ??
      (`You are a sub-agent. Your task: ${task}\n\n` +
       'You have access to the same workspace tools. Complete the task and report back concisely.' +
       projectContext);

    const subRes = this.createPrefixedResponse(res, subagentName, runId);

    return this.agentLoop.run(
      providerType, model, subagentPrompt, [], task,
      tools, subRes, signal, sessionId, projectPath, providerConfig, subagentName, runId,
    );
  }

  private createPrefixedResponse(res: WriteStream, subagentName?: string, subagentRunId?: string): WriteStream {
    const originalWrite = res.write.bind(res);
    return {
      write(data: string): boolean {
        if (/^data: \[DONE\]\n?$/m.test(data)) {
          const donePayload: Record<string, unknown> = { subagent: true, done: true };
          if (subagentName) donePayload.subagentName = subagentName;
          if (subagentRunId) donePayload.subagentRunId = subagentRunId;
          return originalWrite(`data: ${JSON.stringify(donePayload)}\n\n`);
        }
        const modified = data.replace(
          /^(data: )(\{.*?\})(\n\n)$/gm,
          (_match: string, prefix: string, json: string, suffix: string) => {
            try {
              const parsed = JSON.parse(json);
              parsed.subagent = true;
              if (subagentName) parsed.subagentName = subagentName;
              if (subagentRunId) parsed.subagentRunId = subagentRunId;
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
