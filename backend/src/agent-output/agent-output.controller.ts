import { Controller, Get, Param, NotFoundException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { WorkspaceService } from '../workspace/workspace.service';
import * as fs from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
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
      const entries = await fs.readdir(agentOutputDir, { withFileTypes: true });
      const files: AgentOutputFile[] = [];
      for (const entry of entries) {
        if (entry.isFile()) {
          const fullPath = path.join(agentOutputDir, entry.name);
          const stat = await fs.stat(fullPath);
          files.push({
            filename: entry.name,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }
      files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
      return files;
    } catch {
      return [];
    }
  }

  @Get(':filename/download')
  download(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const agentOutputDir = path.join(this.workspace.getWorkspaceRoot(), 'agent-output');
    const resolved = path.resolve(path.join(agentOutputDir, filename));
    if (!resolved.startsWith(path.resolve(agentOutputDir))) {
      throw new NotFoundException('File not found');
    }
    if (!existsSync(resolved)) {
      throw new NotFoundException('File not found');
    }
    const stat = statSync(resolved);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stat.size,
    });
    return new StreamableFile(createReadStream(resolved));
  }
}
