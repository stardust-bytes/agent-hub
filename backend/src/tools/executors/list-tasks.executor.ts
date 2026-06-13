import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class ListTasksExecutor implements ToolExecutor {
  readonly name = 'list_tasks';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(_args: Record<string, unknown>): Promise<string> {
    const tasks = await this.scheduleTasksService.findAll();
    if (tasks.length === 0) return 'No scheduled tasks found.';

    return tasks.map(t =>
      `#${t.id}: "${t.name}" [${t.frequency}] ${t.enabled ? '● enabled' : '○ disabled'}`
    ).join('\n');
  }
}
