import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentLoopService } from './services/agent-loop.service';
import { LLMControllerService } from './services/llm-controller.service';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { ContextBuilderService } from './services/context-builder.service';
import { PermissionsService } from './services/permissions.service';
import { YoloClassifierService } from './services/yolo-classifier.service';
import { MemoryModule } from '../memory/memory.module';
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
import { ResumePlanExecutor } from '../tools/executors/resume-plan.executor';
import { NotesModule } from '../notes/notes.module';
import { PlansModule } from '../plans/plans.module';
import { McpModule } from './mcp/mcp.module';
import { CoworkModule } from '../cowork/cowork.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SubagentService } from './subagent/subagent.service';
import { ModePolicyModule } from '../mode-policy/mode-policy.module';
import { ExcelModule } from '../excel/excel.module';
import { ReadExcelExecutor } from '../excel/executors/read-excel.executor';
import { WriteExcelExecutor } from '../excel/executors/write-excel.executor';
import { ExcelAddSheetExecutor } from '../excel/executors/excel-add-sheet.executor';
import { ListExcelSheetsExecutor } from '../excel/executors/list-excel-sheets.executor';
import { ExcelChartExecutor } from '../excel/executors/excel-chart.executor';
import { ConnectorModule } from '../connector/connector.module';
import { GoogleGmailSearchExecutor } from '../tools/executors/google-gmail-search.executor';
import { GoogleGmailReadExecutor } from '../tools/executors/google-gmail-read.executor';
import { GoogleGmailSendExecutor } from '../tools/executors/google-gmail-send.executor';
import { GoogleGmailDraftExecutor } from '../tools/executors/google-gmail-draft.executor';
import { GoogleGmailLabelsExecutor } from '../tools/executors/google-gmail-labels.executor';
import { GoogleCalendarListExecutor } from '../tools/executors/google-calendar-list.executor';
import { GoogleCalendarCreateExecutor } from '../tools/executors/google-calendar-create.executor';
import { GoogleCalendarUpdateExecutor } from '../tools/executors/google-calendar-update.executor';
import { GoogleCalendarAvailabilityExecutor } from '../tools/executors/google-calendar-availability.executor';
import { GoogleDriveSearchExecutor } from '../tools/executors/google-drive-search.executor';
import { GoogleDriveReadExecutor } from '../tools/executors/google-drive-read.executor';
import { GoogleDriveListExecutor } from '../tools/executors/google-drive-list.executor';
import { GoogleDriveUploadExecutor } from '../tools/executors/google-drive-upload.executor';
import { GoogleDriveCreateFolderExecutor } from '../tools/executors/google-drive-create-folder.executor';


@Module({
  imports: [MemoryModule, TasksModule, KnowledgeModule, SessionsModule, ProvidersModule, ToolsModule, NotesModule, PlansModule, McpModule, CoworkModule, WorkspaceModule, ModePolicyModule, ExcelModule, ConnectorModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentLoopService,
    LLMControllerService,
    OllamaProvider,
    OpenAIProvider,
    ContextBuilderService,
    PermissionsService,
    YoloClassifierService,
    SubagentService,
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
    ResumePlanExecutor,
    ReadExcelExecutor,
    WriteExcelExecutor,
    ExcelAddSheetExecutor,
    ListExcelSheetsExecutor,
    ExcelChartExecutor,
    GoogleGmailSearchExecutor,
    GoogleGmailReadExecutor,
    GoogleGmailSendExecutor,
    GoogleGmailDraftExecutor,
    GoogleGmailLabelsExecutor,
    GoogleCalendarListExecutor,
    GoogleCalendarCreateExecutor,
    GoogleCalendarUpdateExecutor,
    GoogleCalendarAvailabilityExecutor,
    GoogleDriveSearchExecutor,
    GoogleDriveReadExecutor,
    GoogleDriveListExecutor,
    GoogleDriveUploadExecutor,
    GoogleDriveCreateFolderExecutor,
  ],
})
export class AgentModule {}
