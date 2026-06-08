import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { TasksService } from '../../tasks/tasks.service';

@Injectable()
export class CreateTaskExecutor implements ToolExecutor {
  readonly name = 'create_task';

  constructor(private readonly tasksService: TasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const task = await this.tasksService.create({
      title: args.title as string,
      priority: args.priority as number | undefined,
      description: args.description as string | undefined,
    });
    return `Task #${task.id} created: "${task.title}"`;
  }
}
