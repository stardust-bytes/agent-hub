import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleTasksService } from './schedule-tasks.service';
import { ScheduleRunnerService } from './schedule-runner.service';

@Injectable()
export class ScheduleCronService {
  constructor(
    private readonly taskService: ScheduleTasksService,
    private readonly runner: ScheduleRunnerService,
  ) {}

  @Cron('*/10 * * * * *')
  async checkSchedules() {
    const now = new Date();
    console.log(`[ScheduleCron] Checking schedules at ${now.toISOString()}`);
    try {
      const tasks = await this.taskService.findEligible(now);
      console.log(`[ScheduleCron] Found ${tasks.length} eligible tasks`);
      for (const task of tasks) {
        console.log(`[ScheduleCron] Running task ${task.id} (${task.name})`);
        await this.runner.runNow(task.id).catch(e =>
          console.error(`[ScheduleCron] Task ${task.id} failed:`, e.message)
        );
      }
    } catch (e) {
      console.error(`[ScheduleCron] Error checking schedules:`, e instanceof Error ? e.message : e);
    }
  }
}
