import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ToolsService } from '../tools.service';

@Injectable()
export class WebSearchExecutor implements ToolExecutor {
  readonly name = 'web_search';

  constructor(private readonly toolsService: ToolsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const query = args.query as string;
    if (!query) return 'Error: query is required.';

    const tool = await this.toolsService.findByName('web_search');
    if (!tool || !tool.config) return 'Error: web_search is not configured. Go to Tools page to set up API key.';

    const config = JSON.parse(tool.config);
    if (!config.apiKey) return 'Error: API key not configured. Go to Tools page to set up.';

    try {
      const params = new URLSearchParams({
        q: query,
        key: config.apiKey,
        cx: config.cx || '',
      });
      const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json() as { items?: Array<{ title: string; link: string; snippet: string }>; error?: { message: string } };
      if (data.error) return `Search API error: ${data.error.message}`;
      if (!data.items?.length) return 'No search results found.';

      return data.items.map((item, i) =>
        `${i + 1}. ${item.title}\n   ${item.link}\n   ${item.snippet}`
      ).join('\n\n');
    } catch (e) {
      return `Search error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
