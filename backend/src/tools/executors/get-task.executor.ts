import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class GetTaskExecutor implements ToolExecutor {
  readonly name = 'get_task';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = args.id as number;
    const task = await this.scheduleTasksService.findOne(id);
    if (!task) return `Task #${id} not found.`;

    return [
      `Task #${task.id}: "${task.name}"`,
      `Description: ${task.description ?? '(none)'}`,
      `Prompt: ${task.prompt}`,
      `Frequency: ${task.frequency}`,
      task.cronHour != null ? `Time: ${String(task.cronHour).padStart(2, '0')}:${String(task.cronMinute ?? 0).padStart(2, '0')}` : null,
      task.cronDaysOfWeek ? `Days: ${task.cronDaysOfWeek}` : null,
      `Model ID: ${task.modelId ?? '(default)'}`,
      `Project: ${task.projectPath ?? '(none)'}`,
      `Timezone: ${task.timezone ?? '(none)'}`,
      `Enabled: ${task.enabled}`,
    ].filter(Boolean).join('\n');
  }
}
