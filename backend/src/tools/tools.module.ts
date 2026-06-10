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
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { NotesModule } from '../notes/notes.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PlansModule } from '../plans/plans.module';

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
];

@Module({
  imports: [TasksModule, KnowledgeModule, NotesModule, WorkspaceModule, PlansModule],
  controllers: [ToolsController],
  providers: [ToolsService, ...EXECUTORS],
  exports: [ToolsService, ...EXECUTORS],
})
export class ToolsModule {}
