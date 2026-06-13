import { Controller, Get, Delete, Param, NotFoundException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { WorkspaceService } from '../workspace/workspace.service';
import * as fs from 'fs/promises';
import { existsSync, statSync, createReadStream, readdirSync } from 'fs';
import * as path from 'path';

interface AgentOutputFile {
  filename: string;
  size: number;
  modifiedAt: string;
}

@Controller('agent-output')
export class AgentOutputController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get()
  async listFiles(): Promise<AgentOutputFile[]> {
    const agentOutputDir = path.join(this.workspace.getWorkspaceRoot(), 'agent-output');
    try {
      const files: AgentOutputFile[] = [];
      const entries = await this.scanAgentOutputDir(agentOutputDir, files);
      return entries;
    } catch {
      return [];
    }
  }

  private async scanAgentOutputDir(dir: string, files: AgentOutputFile[]): Promise<AgentOutputFile[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name.startsWith('session_')) {
          await this.scanAgentOutputDir(fullPath, files);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          files.push({
            filename: entry.name,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }
    } catch { /* skip unreadable dirs */ }
    files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    return files;
  }

  @Get(':filename/download')
  download(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const agentOutputDir = path.join(this.workspace.getWorkspaceRoot(), 'agent-output');
    const resolved = this.resolveFile(agentOutputDir, filename);
    if (!resolved) throw new NotFoundException('File not found');

    const stat = statSync(resolved);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stat.size,
    });
    return new StreamableFile(createReadStream(resolved));
  }

  private resolveFile(dir: string, filename: string): string | null {
    const flatPath = path.resolve(path.join(dir, filename));
    if (flatPath.startsWith(path.resolve(dir)) && existsSync(flatPath)) return flatPath;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('session_')) {
          const found = this.resolveFile(path.join(dir, entry.name), filename);
          if (found) return found;
        }
      }
    } catch { /* skip */ }
    return null;
  }

  @Delete(':filename')
  async remove(@Param('filename') filename: string): Promise<{ success: boolean }> {
    const agentOutputDir = path.join(this.workspace.getWorkspaceRoot(), 'agent-output');
    const resolved = this.resolveFile(agentOutputDir, filename);
    if (!resolved) throw new NotFoundException('File not found');
    await fs.unlink(resolved);
    return { success: true };
  }
}
