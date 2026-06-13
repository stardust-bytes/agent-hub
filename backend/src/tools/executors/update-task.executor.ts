import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class UpdateTaskExecutor implements ToolExecutor {
  readonly name = 'update_task';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = args.id as number;
    const dto: Record<string, unknown> = {};
    if (args.name !== undefined) dto.name = args.name;
    if (args.description !== undefined) dto.description = args.description;
    if (args.frequency !== undefined) dto.frequency = args.frequency;
    if (args.cronMinute !== undefined) dto.cronMinute = args.cronMinute;
    if (args.cronHour !== undefined) dto.cronHour = args.cronHour;
    if (args.cronDayOfWeek !== undefined) dto.cronDayOfWeek = args.cronDayOfWeek;
    if (args.cronDaysOfWeek !== undefined) dto.cronDaysOfWeek = args.cronDaysOfWeek;
    if (args.projectPath !== undefined) dto.projectPath = args.projectPath;
    if (args.modelId !== undefined) dto.modelId = args.modelId;

    const task = await this.scheduleTasksService.update(id, dto as any);
    return `Schedule task #${task.id} updated: "${task.name}"`;
  }
}
