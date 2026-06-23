import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GlobExecutor implements ToolExecutor {
  readonly name = 'glob';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const pattern = args.pattern as string | undefined;
    const searchPath = (args.path as string) || context?.projectPath;
    if (!pattern) return 'Error: pattern is required.';
    if (!searchPath) return 'Error: path is required. Specify a path or set a project path first.';
    const resolved = path.resolve(searchPath);
    if (!this.workspace.isPathAllowed(resolved)) {
      const allowed = this.workspace.getAllowedPaths().join(', ');
      return `Error: path "${searchPath}" is not allowed. Allowed paths: ${allowed}`;
    }

    const results: string[] = [];
    const re = this.patternToRegex(pattern);

    try {
      this.walkDir(resolved, '', re, results);
      if (results.length === 0) return 'No files found.';
      return results.join('\n');
    } catch (e) {
      return `Error during glob: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private patternToRegex(pattern: string): RegExp {
    const re = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*\/?/g, (match) => match.endsWith('/') ? '___GLOBSTAR_SLASH___' : '___GLOBSTAR___')
      .replace(/\*/g, '[^/\\\\]*')
      .replace(/___GLOBSTAR_SLASH___/g, '(?:.+/)?')
      .replace(/___GLOBSTAR___/g, '.*');
    return new RegExp(`^${re}$`, 'i');
  }

  private walkDir(baseDir: string, relative: string, re: RegExp, results: string[]): void {
    const dirPath = path.join(baseDir, relative);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        this.walkDir(baseDir, relPath, re, results);
      } else if (entry.isFile()) {
        if (re.test(relPath) || re.test(entry.name)) {
          results.push(path.join(baseDir, relPath));
        }
      }
    }
  }
}
