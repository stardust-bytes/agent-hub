import { Injectable } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { IndexerService } from './indexer.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as chokidar from 'chokidar';
import * as path from 'path';

@Injectable()
export class WorkspaceWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private watching = false;
  private directory = '';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly indexer: IndexerService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async startWatch(directory?: string): Promise<void> {
    if (this.watching) return;
    this.directory = directory
      ? path.resolve(directory)
      : this.workspace.getWorkspaceRoot();

    if (!this.workspace.isPathAllowed(this.directory)) {
      throw new Error(`Directory "${this.directory}" is not allowed.`);
    }

    this.watcher = chokidar.watch(this.directory, {
      ignored: /(node_modules|\.git|dist|\.lancedb|dev\.db|dev\.db-journal)/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('add', (filePath: string) => this.indexer.enqueue(filePath));
    this.watcher.on('change', (filePath: string) => this.indexer.enqueue(filePath));
    this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));

    this.watching = true;
  }

  async stopWatch(): Promise<void> {
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
    this.watching = false;
  }

  getStatus(): { watching: boolean; directory: string; indexedCount: number } {
    const s = this.indexer.getStatus();
    return { watching: this.watching, directory: this.directory, indexedCount: s.done };
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    try {
      const known = await this.knowledge.findByFilepath(filePath);
      if (known) await this.knowledge.remove(known.id);
    } catch { /* ignore */ }
  }
}
