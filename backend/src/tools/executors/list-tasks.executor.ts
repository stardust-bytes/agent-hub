import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { TasksService } from '../../tasks/tasks.service';

@Injectable()
export class ListTasksExecutor implements ToolExecutor {
  readonly name = 'list_tasks';

  constructor(private readonly tasksService: TasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const tasks = await this.tasksService.findAll();
    const filtered = args.status
      ? tasks.filter(t => t.status === args.status)
      : tasks;
    if (filtered.length === 0) return 'No tasks found.';
    return filtered.map(t =>
      `#${t.id} ${t.title} [${t.status}] (priority: ${t.priority})`
    ).join('\n');
  }
}
