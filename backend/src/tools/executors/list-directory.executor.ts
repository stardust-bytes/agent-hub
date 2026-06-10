import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

@Injectable()
export class ListDirectoryExecutor implements ToolExecutor {
  readonly name = 'list_directory';

  async execute(args: Record<string, unknown>): Promise<string> {
    const dirPath = args.path as string | undefined;
    if (!dirPath) return 'Error: path is required.';
    if (!this.isPathAllowed(dirPath)) return `Error: path "${dirPath}" is not allowed.`;
    try {
      const resolved = path.resolve(dirPath);
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const lines = entries.map(e => {
        const isDir = e.isDirectory() ? 'd' : '-';
        return `${isDir} ${e.name}`;
      });
      return lines.join('\n');
    } catch (e) {
      return `Error listing directory: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const allowed = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [
          path.resolve('./workspace_data'),
          path.resolve(os.tmpdir()),
          ...(process.env.USERPROFILE ? [path.resolve(process.env.USERPROFILE)] : []),
          ...(process.env.HOME ? [path.resolve(process.env.HOME)] : []),
          process.cwd(),
        ];
    const resolved = path.resolve(filePath);
    return allowed.some(dir => resolved === dir || resolved.startsWith(dir + path.sep));
  }
}
