import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { CreateTaskExecutor } from './executors/create-task.executor';
import { UpdateTaskExecutor } from './executors/update-task.executor';
import { ListTasksExecutor } from './executors/list-tasks.executor';
import { GetTaskExecutor } from './executors/get-task.executor';
import { DeleteTasksExecutor } from './executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from './executors/search-knowledge.executor';
import { WebFetchExecutor } from './executors/web-fetch.executor';
import { WebSearchExecutor } from './executors/web-search.executor';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

const EXECUTORS = [
  CreateTaskExecutor,
  UpdateTaskExecutor,
  ListTasksExecutor,
  GetTaskExecutor,
  DeleteTasksExecutor,
  SearchKnowledgeExecutor,
  WebFetchExecutor,
  WebSearchExecutor,
];

@Module({
  imports: [TasksModule, KnowledgeModule],
  controllers: [ToolsController],
  providers: [ToolsService, ...EXECUTORS],
  exports: [ToolsService, ...EXECUTORS],
})
export class ToolsModule {}
