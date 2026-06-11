import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';

@Injectable()
export class SpawnSubagentExecutor implements ToolExecutor {
  readonly name = 'spawn_subagent';

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const task = args.task as string | undefined;
    if (!task) {
      return 'Error: spawn_subagent requires a "task" parameter';
    }

    throw new Error('spawn_subagent cannot be called directly via execute() — use AgentLoopService');
  }
}
