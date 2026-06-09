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
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
          query,
          numResults: 10,
          contents: { highlights: true },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return `Search API error (HTTP ${res.status}): ${text.slice(0, 300)}`;
      }
      const data = await res.json() as {
        results?: Array<{ title: string; url: string; publishedDate?: string; highlights?: string[] }>;
      };
      if (!data.results?.length) return 'No search results found.';

      return data.results.map((item, i) => {
        const date = item.publishedDate
          ? `\n   Published: ${new Date(item.publishedDate).toLocaleDateString('vi-VN')}`
          : '';
        const highlights = item.highlights?.length
          ? `\n   ${item.highlights[0]}`
          : '';
        return `${i + 1}. ${item.title}\n   ${item.url}${date}${highlights}`;
      }).join('\n\n');
    } catch (e) {
      return `Search error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
