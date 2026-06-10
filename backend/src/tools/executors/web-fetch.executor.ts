import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class WebFetchExecutor implements ToolExecutor {
  readonly name = 'web_fetch';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;
    if (!url) return 'Error: URL is required.';

    if (url.startsWith('file://')) {
      const filePath = url.slice(url.startsWith('file:///') ? 8 : 7);
      const resolved = path.resolve(filePath);
      if (!this.workspace.isPathAllowed(resolved)) {
        return `Error: path "${filePath}" is not allowed. Use read_file for local files.`;
      }
      try {
        const content = await fs.readFile(resolved, 'utf-8');
        return content.length > 5000 ? content.slice(0, 5000) + '\n...(truncated)' : content;
      } catch (e) {
        return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
      }
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`;
      const text = await res.text();
      return text.length > 5000 ? text.slice(0, 5000) + '\n...(truncated)' : text;
    } catch (e) {
      return `Error fetching URL: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
