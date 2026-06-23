import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GrepExecutor implements ToolExecutor {
  readonly name = 'grep';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const pattern = args.pattern as string | undefined;
    const searchPath = (args.path as string) || context?.projectPath;
    const include = args.include as string | undefined;
    if (!pattern) return 'Error: pattern is required.';
    if (!searchPath) return 'Error: path is required. Specify a path or set a project path first.';
    const resolved = path.resolve(searchPath);
    if (!this.workspace.isPathAllowed(resolved)) {
      const allowed = this.workspace.getAllowedPaths().join(', ');
      return `Error: path "${searchPath}" is not allowed. Allowed paths: ${allowed}`;
    }

    const results: string[] = [];
    try {
      this.searchDir(resolved, pattern, include, results);
      if (results.length === 0) return 'No matches found.';
      return results.slice(0, 50).join('\n');
    } catch (e) {
      return `Error during search: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private searchDir(dir: string, pattern: string, include: string | undefined, results: string[]): void {
    const re = new RegExp(pattern, 'i');
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        this.searchDir(fullPath, pattern, include, results);
      } else if (entry.isFile()) {
        if (include && !entry.name.endsWith(include)) continue;
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              results.push(`${fullPath}:${i + 1}:${lines[i].trim().substring(0, 200)}`);
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }
}
