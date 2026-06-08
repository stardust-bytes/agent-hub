import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { TasksService } from '../../tasks/tasks.service';

@Injectable()
export class DeleteTasksExecutor implements ToolExecutor {
  readonly name = 'delete_tasks';

  constructor(private readonly tasksService: TasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const ids = args.ids as number[];
    const count = await this.tasksService.removeMany(ids);
    return `Deleted ${count} task(s): #${ids.join(', #')}`;
  }
}
