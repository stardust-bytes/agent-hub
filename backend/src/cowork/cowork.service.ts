import { Injectable, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceService } from '../workspace/workspace.service';
import * as path from 'path';

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
}
