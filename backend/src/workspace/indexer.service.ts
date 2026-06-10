import { Injectable } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { WorkspaceService } from './workspace.service';
import * as path from 'path';
import * as fs from 'fs/promises';

const DEFAULT_CONCURRENCY = 3;
const SUPPORTED_EXTS = ['.ts', '.js', '.py', '.md', '.txt', '.json', '.yaml', '.yml'];

export interface IndexerStatus {
  pending: number;
  processing: number;
  done: number;
  errors: number;
}

@Injectable()
export class IndexerService {
  private queue: string[] = [];
  private processing = new Set<string>();
  private done = 0;
  private errors = 0;
  private concurrency = DEFAULT_CONCURRENCY;
  private running = false;

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly workspace: WorkspaceService,
  ) {}

  enqueue(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) return;
    const resolved = path.resolve(filePath);
    if (this.queue.includes(resolved) || this.processing.has(resolved)) return;
    this.queue.push(resolved);
    if (!this.running) {
      this.running = true;
      setTimeout(() => this.processNext(), 0);
    }
  }

  getStatus(): IndexerStatus {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      done: this.done,
      errors: this.errors,
    };
  }

  private async processNext(): Promise<void> {
    while (this.processing.size < this.concurrency && this.queue.length > 0) {
      const filePath = this.queue.shift()!;
      this.processing.add(filePath);
      this.processFile(filePath).finally(() => {
        this.processing.delete(filePath);
        this.processNext();
      });
    }
    if (this.processing.size === 0) {
      this.running = false;
    }
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      const known = await this.knowledge.findByFilepath(filePath);
      if (known) {
        await this.knowledge.processFile(known.id);
      } else {
        let size = 0;
        try {
          const stats = await fs.stat(filePath);
          size = stats.size;
        } catch {
          // file may not exist on disk yet (e.g. test fixture)
        }
        const mimeType = this.inferMimeType(path.extname(filePath).toLowerCase());
        const record = await this.knowledge.createWithPath(
          path.basename(filePath), filePath, size, mimeType,
        );
        await this.knowledge.processFile(record.id);
      }
      this.done++;
    } catch {
      this.errors++;
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
