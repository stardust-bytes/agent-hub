import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotionService } from '../../connector/providers/notion/notion.service';

@Injectable()
export class NotionSearchExecutor implements ToolExecutor {
  readonly name = 'notion_search';
  readonly description = 'Search Notion pages and databases by text query. Returns matching items with their IDs and titles.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search text' },
      pageSize: { type: 'number', description: 'Max results (default: 10)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly notion: NotionService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const results = await this.notion.search(args.query as string, (args.pageSize as number) ?? 10);
      if (results.length === 0) return 'No Notion results found.';
      return results.map(r => {
        const props = r.properties as Record<string, string> | undefined;
        const title = props ? Object.values(props).find(v => v) ?? '(untitled)' : '(untitled)';
        return `[${r.type}] ${title} — id: ${r.id} | url: ${r.url ?? 'N/A'}`;
      }).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
