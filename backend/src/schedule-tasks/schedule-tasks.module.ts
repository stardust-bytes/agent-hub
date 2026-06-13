import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduleTasksController } from './schedule-tasks.controller';
import { ScheduleTasksService } from './schedule-tasks.service';
import { ScheduleRunnerService } from './schedule-runner.service';
import { ScheduleCronService } from './schedule-cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentModule } from '../agent/agent.module';
import { ProvidersModule } from '../providers/providers.module';
import { SessionsModule } from '../sessions/sessions.module';
import { CoworkModule } from '../cowork/cowork.module';

@Module({
  imports: [PrismaModule, AgentModule, ProvidersModule, SessionsModule, CoworkModule, ScheduleModule.forRoot()],
  controllers: [ScheduleTasksController],
  providers: [ScheduleTasksService, ScheduleRunnerService, ScheduleCronService],
})
export class ScheduleTasksModule {}
