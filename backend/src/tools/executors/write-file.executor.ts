import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    const content = args.content as string | undefined;
    if (!filePath || content === undefined) return 'Error: path and content are required.';
    if (!this.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const resolved = path.resolve(filePath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return `Written ${Buffer.byteLength(content, 'utf-8')} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const allowed = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [path.resolve('./workspace_data'), os.tmpdir()];
    const resolved = path.resolve(filePath);
    return allowed.some(dir => resolved.startsWith(dir));
  }
}
