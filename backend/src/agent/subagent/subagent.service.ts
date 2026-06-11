import { Injectable } from '@nestjs/common';
import { AgentLoopService } from '../services/agent-loop.service';
import { ToolDefinition } from '../services/context-builder.service';
import { WriteStream } from '../dto/write-stream.interface';

@Injectable()
export class SubagentService {
  constructor(private readonly agentLoop: AgentLoopService) {}

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
