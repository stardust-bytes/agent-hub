import { Module } from '@nestjs/common';
import { ScheduleTasksController } from './schedule-tasks.controller';
import { ScheduleTasksService } from './schedule-tasks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleTasksController],
  providers: [ScheduleTasksService],
})
export class ScheduleTasksModule {}
