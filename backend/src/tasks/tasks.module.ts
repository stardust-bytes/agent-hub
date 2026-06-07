import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
  exports: [TasksService],
})
export class TasksModule {}
