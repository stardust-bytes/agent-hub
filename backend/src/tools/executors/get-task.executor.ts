import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { TasksService } from '../../tasks/tasks.service';

@Injectable()
export class GetTaskExecutor implements ToolExecutor {
  readonly name = 'get_task';

  constructor(private readonly tasksService: TasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const task = await this.tasksService.findOne(args.id as number);
    return `Task #${task.id}: "${task.title}" [${task.status}] priority=${task.priority} description="${task.description ?? ''}" due=${task.dueDate ?? ''}`;
  }
}
