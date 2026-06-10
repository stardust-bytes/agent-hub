import { Injectable, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceService } from '../workspace/workspace.service';
import * as path from 'path';
import * as fs from 'fs/promises';

const PROJECT_KEY = 'cowork_project_path';

@Injectable()
export class CoworkService implements OnModuleInit {
  constructor(
    private readonly settings: SettingsService,
    private readonly workspace: WorkspaceService,
  ) {}

  async onModuleInit(): Promise<void> {
    const savedPath = await this.getProject();
    if (savedPath) {
      this.workspace.addAllowedPath(savedPath);
    }
  }

  async setProject(projectPath: string): Promise<void> {
    const resolved = path.resolve(projectPath);
    await this.settings.set(PROJECT_KEY, resolved);
    this.workspace.addAllowedPath(resolved);
  }

  async getProject(): Promise<string | null> {
    return this.settings.get(PROJECT_KEY, null);
  }

  async clearProject(): Promise<void> {
    await this.settings.delete(PROJECT_KEY);
  }

  async getStatus(): Promise<{ projectPath: string | null; isActive: boolean }> {
    const projectPath = await this.getProject();
    return { projectPath, isActive: projectPath !== null };
  }

  async getDrives(): Promise<string[]> {
    if (process.platform === 'win32') {
      const drives: string[] = [];
      for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i);
        try {
          await fs.access(letter + ':\\');
          drives.push(letter + ':\\');
        } catch { /* skip unavailable drives */ }
      }
      return drives;
    }
    return ['/'];
  }

  async browseDirectory(dirPath: string): Promise<{ path: string; entries: Array<{ name: string; isDirectory: boolean }> }> {
    const resolved = path.resolve(dirPath);
    const dirents = await fs.readdir(resolved, { withFileTypes: true });
    const entries = dirents
      .filter(d => d.isDirectory())
      .map(d => ({ name: d.name, isDirectory: true }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return { path: resolved, entries };
  }
}
