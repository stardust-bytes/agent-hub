import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { IndexerService } from './indexer.service';
import { WorkspaceController } from './workspace.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceWatcherService, IndexerService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
