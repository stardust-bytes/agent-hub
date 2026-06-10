import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

@Injectable()
export class WorkspaceService {
  private readonly workspaceRoot: string;
  private readonly allowedPaths: string[];

  constructor(private readonly config: ConfigService) {
    this.workspaceRoot = path.resolve(this.config.get<string>('WORKSPACE_ROOT', './workspace_data'));
    const envPaths = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [];
    this.allowedPaths = [
      this.workspaceRoot,
      path.resolve(os.tmpdir()),
      path.resolve(process.cwd()),
      ...(process.env.USERPROFILE ? [path.resolve(process.env.USERPROFILE)] : []),
      ...(process.env.HOME ? [path.resolve(process.env.HOME)] : []),
      ...envPaths,
    ];
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  isPathAllowed(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return this.allowedPaths.some(dir => resolved === dir || resolved.startsWith(dir + path.sep));
  }

  addAllowedPath(_path: string): void {
    const resolved = path.resolve(_path);
    if (!this.allowedPaths.includes(resolved)) {
      this.allowedPaths.push(resolved);
    }
  }

  async writeFile(filePath: string, content: string): Promise<{ bytesWritten: number; resolved: string }> {
    if (!this.isPathAllowed(filePath)) throw new Error(`Path "${filePath}" is not allowed.`);
    const resolved = path.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    return { bytesWritten: Buffer.byteLength(content, 'utf-8'), resolved };
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.isPathAllowed(filePath)) throw new Error(`Path "${filePath}" is not allowed.`);
    return fs.readFile(path.resolve(filePath), 'utf-8');
  }

  async listDirectory(dirPath: string): Promise<string> {
    if (!this.isPathAllowed(dirPath)) throw new Error(`Path "${dirPath}" is not allowed.`);
    const resolved = path.resolve(dirPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? 'd' : '-'} ${e.name}`).join('\n');
  }
}
