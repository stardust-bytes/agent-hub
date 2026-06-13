import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleTasksService } from './schedule-tasks.service';
import { ScheduleRunnerService } from './schedule-runner.service';

@Injectable()
export class ScheduleCronService {
  constructor(
    private readonly taskService: ScheduleTasksService,
    private readonly runner: ScheduleRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    const now = new Date();
    const tasks = await this.taskService.findEligible(now);
    for (const task of tasks) {
      await this.runner.runNow(task.id).catch(e =>
        console.error(`[ScheduleCron] Task ${task.id} failed:`, e.message)
      );
    }
  }
}
