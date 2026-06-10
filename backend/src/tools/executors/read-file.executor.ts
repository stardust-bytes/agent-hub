import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const MAX_READ_SIZE = 100 * 1024;

@Injectable()
export class ReadFileExecutor implements ToolExecutor {
  readonly name = 'read_file';

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    if (!filePath) return 'Error: path is required.';
    if (!this.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const resolved = path.resolve(filePath);
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) return `Error: "${resolved}" is not a file.`;
      if (stat.size > MAX_READ_SIZE) return `Error: File too large (${stat.size} bytes, max ${MAX_READ_SIZE}).`;
      return await fs.readFile(resolved, 'utf-8');
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const allowed = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [path.resolve('./workspace_data'), path.resolve(os.tmpdir())];
    const resolved = path.resolve(filePath);
    return allowed.some(dir => resolved === dir || resolved.startsWith(dir + path.sep));
  }
}
