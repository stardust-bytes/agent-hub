import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceService } from '../workspace/workspace.service';
import * as path from 'path';
import * as fs from 'fs/promises';

const PROJECT_KEY = 'cowork_project_path';

export interface SavedProject {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

@Injectable()
export class CoworkService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
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

  async getProjectsList(): Promise<SavedProject[]> {
    const projects = await this.prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    return projects.map(p => ({ id: p.id, name: p.name, path: p.path, createdAt: p.createdAt.toISOString() }));
  }

  async saveProject(name: string, projectPath: string): Promise<SavedProject> {
    const resolved = path.resolve(projectPath);
    const existing = await this.prisma.project.findUnique({ where: { path: resolved } });
    if (existing) return { id: existing.id, name: existing.name, path: existing.path, createdAt: existing.createdAt.toISOString() };

    const project = await this.prisma.project.create({
      data: { name, path: resolved },
    });
    return { id: project.id, name: project.name, path: project.path, createdAt: project.createdAt.toISOString() };
  }

  async deleteProject(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
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

  async readFile(filePath: string, projectPath: string): Promise<{ content: string; filename: string; size: number }> {
    const resolved = path.resolve(filePath);
    const project = path.resolve(projectPath);

    if (!resolved.startsWith(project)) {
      throw new Error('Path is outside the project directory');
    }

    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new Error('Path is not a file');
    }

    const content = await fs.readFile(resolved, 'utf-8');
    return {
      content,
      filename: path.basename(resolved),
      size: stat.size,
    };
  }

  async browseDirectory(dirPath: string): Promise<{ path: string; entries: Array<{ name: string; isDirectory: boolean }> }> {
    const resolved = path.resolve(dirPath);
    const dirents = await fs.readdir(resolved, { withFileTypes: true });
    const entries = dirents
      .map(d => ({ name: d.name, isDirectory: d.isDirectory() }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    return { path: resolved, entries };
  }
}
