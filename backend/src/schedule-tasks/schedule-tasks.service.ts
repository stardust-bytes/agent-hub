import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleTaskDto } from './dto/create-schedule-task.dto';
import { UpdateScheduleTaskDto } from './dto/update-schedule-task.dto';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class ScheduleTasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.scheduleTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        logs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.scheduleTask.findUnique({ where: { id } });
  }

  create(dto: CreateScheduleTaskDto) {
    return this.prisma.scheduleTask.create({ data: dto as any });
  }

  update(id: number, dto: UpdateScheduleTaskDto) {
    return this.prisma.scheduleTask.update({ where: { id }, data: dto as any });
  }

  remove(id: number) {
    return this.prisma.scheduleTask.delete({ where: { id } });
  }

  async getLogs(taskId: number) {
    return this.prisma.scheduleTaskLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEligible(now: Date) {
    const tasks = await this.prisma.scheduleTask.findMany({
      where: { enabled: true, frequency: { not: 'manual' } },
      include: { logs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return tasks.filter(task => {
      const zonedNow = task.timezone ? toZonedTime(now, task.timezone) : now;
      const minute = zonedNow.getMinutes();
      const hour = zonedNow.getHours();
      const day = zonedNow.getDay();
      const lastLog = (task as any).logs?.[0];
      const lastRunTime = lastLog?.createdAt ? new Date(lastLog.createdAt).getTime() : 0;

      switch (task.frequency) {
        case 'hourly':
          return task.cronMinute === minute && (now.getTime() - lastRunTime > 3600000);
        case 'daily':
          return task.cronHour === hour && task.cronMinute === minute && (now.getTime() - lastRunTime > 86400000);
        case 'weekdays':
          return task.cronHour === hour && task.cronMinute === minute
            && day >= 1 && day <= 5 && (now.getTime() - lastRunTime > 86400000);
        case 'weekly':
          const days = (task.cronDaysOfWeek ?? String(task.cronDayOfWeek ?? '')).split(',').map(Number);
          return days.includes(day) && task.cronHour === hour && task.cronMinute === minute && (now.getTime() - lastRunTime > 86400000 * 7);
        default:
          return false;
      }
    });
  }
}
