import { Injectable } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';

const SUPPORTED_EXTS = ['.ts', '.js', '.py', '.md', '.txt', '.json', '.yaml', '.yml'];
const DEBOUNCE_MS = 300;

@Injectable()
export class WorkspaceWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private watching = false;
  private directory = '';
  private indexedCount = 0;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly workspace: WorkspaceService,
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

    this.watcher.on('add', (filePath: string) => this.handleFileChange(filePath, 'add'));
    this.watcher.on('change', (filePath: string) => this.handleFileChange(filePath, 'change'));
    this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));

    this.watching = true;
  }

  async stopWatch(): Promise<void> {
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
    this.watching = false;
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  getStatus(): { watching: boolean; directory: string; indexedCount: number } {
    return { watching: this.watching, directory: this.directory, indexedCount: this.indexedCount };
  }

  private async handleFileChange(filePath: string, _event: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) return;

    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(filePath, setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      try {
        const existingFiles = await this.knowledge.findAll();
        const known = existingFiles.find((f: { filepath: string }) => f.filepath === filePath);
        if (known) {
          await this.knowledge.processFile(known.id);
        } else {
          const stats = await fs.stat(filePath);
          const mimeType = this.inferMimeType(ext);
          const record = await this.knowledge.createWithPath(
            path.basename(filePath), filePath, stats.size, mimeType,
          );
          await this.knowledge.processFile(record.id);
        }
        this.indexedCount++;
      } catch { /* file may have been deleted between timer and execution */ }
    }, DEBOUNCE_MS));
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    const existingFiles = await this.knowledge.findAll();
    const known = existingFiles.find((f: { filepath: string }) => f.filepath === filePath);
    if (known) {
      await this.knowledge.remove(known.id);
    }
  }

  private inferMimeType(ext: string): string {
    const mimeMap: Record<string, string> = {
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.py': 'text/x-python',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeMap[ext] || 'text/plain';
  }
}
