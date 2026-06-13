import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';
import { ProvidersService } from '../../providers/providers.service';

@Injectable()
export class CreateTaskExecutor implements ToolExecutor {
  readonly name = 'create_task';

  constructor(
    private readonly scheduleTasksService: ScheduleTasksService,
    private readonly providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const name = args.name as string;
    const description = (args.description ?? '') as string;

    let modelId = args.modelId as number | undefined;
    if (!modelId) {
      const models = await this.providersService.findAllModels();
      if (models.length > 0) modelId = models[0].id;
    }

    const task = await this.scheduleTasksService.create({
      name,
      description: description || null,
      prompt: description || '',
      frequency: (args.frequency as string) ?? 'manual',
      cronMinute: args.cronMinute as number | undefined,
      cronHour: args.cronHour as number | undefined,
      cronDayOfWeek: args.cronDayOfWeek as number | undefined,
      cronDaysOfWeek: args.cronDaysOfWeek as string | undefined,
      projectPath: args.projectPath as string | undefined,
      modelId: modelId ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    return `Schedule task #${task.id} created: "${task.name}"`;
  }
}
