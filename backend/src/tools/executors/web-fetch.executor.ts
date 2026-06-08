import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';

@Injectable()
export class WebFetchExecutor implements ToolExecutor {
  readonly name = 'web_fetch';

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;
    if (!url) return 'Error: URL is required.';
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
