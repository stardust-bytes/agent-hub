import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentLoopService } from './services/agent-loop.service';
import { LLMControllerService } from './services/llm-controller.service';
import { OllamaProvider } from './providers/ollama.provider';
import { ContextBuilderService } from './services/context-builder.service';
import { PermissionsService } from './services/permissions.service';
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
import { CreateNoteExecutor } from '../tools/executors/create-note.executor';
import { UpdateNoteExecutor } from '../tools/executors/update-note.executor';
import { ListNotesExecutor } from '../tools/executors/list-notes.executor';
import { DeleteNoteExecutor } from '../tools/executors/delete-note.executor';
import { ConvertNoteToTaskExecutor } from '../tools/executors/convert-note-to-task.executor';
import { NotesModule } from '../notes/notes.module';
import { PlansModule } from '../plans/plans.module';
import { McpModule } from './mcp/mcp.module';
import { CoworkModule } from '../cowork/cowork.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule, ProvidersModule, ToolsModule, NotesModule, PlansModule, McpModule, CoworkModule, WorkspaceModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentLoopService,
    LLMControllerService,
    OllamaProvider,
    ContextBuilderService,
    PermissionsService,
    CreateTaskExecutor,
    UpdateTaskExecutor,
    ListTasksExecutor,
    GetTaskExecutor,
    DeleteTasksExecutor,
    SearchKnowledgeExecutor,
    WebFetchExecutor,
    WebSearchExecutor,
    CreateNoteExecutor,
    UpdateNoteExecutor,
    ListNotesExecutor,
    DeleteNoteExecutor,
    ConvertNoteToTaskExecutor,
  ],
})
export class AgentModule {}
