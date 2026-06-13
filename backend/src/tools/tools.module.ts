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
import { CreateNoteExecutor } from './executors/create-note.executor';
import { UpdateNoteExecutor } from './executors/update-note.executor';
import { ListNotesExecutor } from './executors/list-notes.executor';
import { DeleteNoteExecutor } from './executors/delete-note.executor';
import { ConvertNoteToTaskExecutor } from './executors/convert-note-to-task.executor';
import { WriteFileExecutor } from './executors/write-file.executor';
import { ReadFileExecutor } from './executors/read-file.executor';
import { ListDirectoryExecutor } from './executors/list-directory.executor';
import { RunCommandExecutor } from './executors/run-command.executor';
import { GrepExecutor } from './executors/grep.executor';
import { GlobExecutor } from './executors/glob.executor';
import { ResumePlanExecutor } from './executors/resume-plan.executor';
import { CreatePlanExecutor } from './executors/create-plan.executor';
import { SpawnSubagentExecutor } from './executors/spawn-subagent.executor';
import { ReadWordExecutor } from '../word/executors/read-word.executor';
import { WriteWordExecutor } from '../word/executors/write-word.executor';
import { EditWordExecutor } from '../word/executors/edit-word.executor';
import { WordModule } from '../word/word.module';
import { ScheduleTasksModule } from '../schedule-tasks/schedule-tasks.module';
import { ProvidersModule } from '../providers/providers.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { NotesModule } from '../notes/notes.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PlansModule } from '../plans/plans.module';
import { ConnectorModule } from '../connector/connector.module';
import { GoogleGmailSearchExecutor } from './executors/google-gmail-search.executor';
import { GoogleGmailReadExecutor } from './executors/google-gmail-read.executor';
import { GoogleGmailSendExecutor } from './executors/google-gmail-send.executor';
import { GoogleGmailDraftExecutor } from './executors/google-gmail-draft.executor';
import { GoogleGmailLabelsExecutor } from './executors/google-gmail-labels.executor';
import { GoogleCalendarListExecutor } from './executors/google-calendar-list.executor';
import { GoogleCalendarCreateExecutor } from './executors/google-calendar-create.executor';
import { GoogleCalendarUpdateExecutor } from './executors/google-calendar-update.executor';
import { GoogleCalendarAvailabilityExecutor } from './executors/google-calendar-availability.executor';
import { GoogleDriveSearchExecutor } from './executors/google-drive-search.executor';
import { GoogleDriveReadExecutor } from './executors/google-drive-read.executor';
import { GoogleDriveListExecutor } from './executors/google-drive-list.executor';
import { GoogleDriveUploadExecutor } from './executors/google-drive-upload.executor';
import { GoogleDriveCreateFolderExecutor } from './executors/google-drive-create-folder.executor';

const EXECUTORS = [
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
  WriteFileExecutor,
  ReadFileExecutor,
  ListDirectoryExecutor,
  RunCommandExecutor,
  GrepExecutor,
  GlobExecutor,
  ResumePlanExecutor,
  CreatePlanExecutor,
  SpawnSubagentExecutor,
  ReadWordExecutor,
  WriteWordExecutor,
  EditWordExecutor,
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
];

@Module({
  imports: [ScheduleTasksModule, ProvidersModule, KnowledgeModule, NotesModule, WorkspaceModule, PlansModule, WordModule, ConnectorModule],
  controllers: [ToolsController],
  providers: [ToolsService, ...EXECUTORS],
  exports: [ToolsService, ...EXECUTORS],
})
export class ToolsModule {}
