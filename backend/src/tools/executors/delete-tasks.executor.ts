import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class DeleteTasksExecutor implements ToolExecutor {
  readonly name = 'delete_tasks';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const ids = args.ids as number[];
    for (const id of ids) {
      await this.scheduleTasksService.remove(id);
    }
    return `Deleted ${ids.length} schedule task(s): #${ids.join(', #')}`;
  }
}
