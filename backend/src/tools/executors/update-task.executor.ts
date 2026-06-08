import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { TasksService } from '../../tasks/tasks.service';

@Injectable()
export class UpdateTaskExecutor implements ToolExecutor {
  readonly name = 'update_task';

  constructor(private readonly tasksService: TasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const task = await this.tasksService.update(args.id as number, {
      title: args.title as string | undefined,
      description: args.description as string | undefined,
      status: args.status as string | undefined,
      priority: args.priority as number | undefined,
      dueDate: args.dueDate as string | undefined,
    });
    return `Task #${task.id} updated: "${task.title}" [${task.status}]`;
  }
}
