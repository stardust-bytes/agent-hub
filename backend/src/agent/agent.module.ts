import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentLoopService } from './services/agent-loop.service';
import { LLMControllerService } from './services/llm-controller.service';
import { OllamaProvider } from './providers/ollama.provider';
import { ContextBuilderService } from './services/context-builder.service';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ProvidersModule } from '../providers/providers.module';
import { ToolsModule } from '../tools/tools.module';
import { CreateTaskExecutor } from '../tools/executors/create-task.executor';
import { UpdateTaskExecutor } from '../tools/executors/update-task.executor';
import { ListTasksExecutor } from '../tools/executors/list-tasks.executor';
import { GetTaskExecutor } from '../tools/executors/get-task.executor';
import { DeleteTasksExecutor } from '../tools/executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from '../tools/executors/search-knowledge.executor';
import { WebFetchExecutor } from '../tools/executors/web-fetch.executor';
import { WebSearchExecutor } from '../tools/executors/web-search.executor';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule, ProvidersModule, ToolsModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentLoopService,
    LLMControllerService,
    OllamaProvider,
    ContextBuilderService,
    CreateTaskExecutor,
    UpdateTaskExecutor,
    ListTasksExecutor,
    GetTaskExecutor,
    DeleteTasksExecutor,
    SearchKnowledgeExecutor,
    WebFetchExecutor,
    WebSearchExecutor,
  ],
})
export class AgentModule {}
