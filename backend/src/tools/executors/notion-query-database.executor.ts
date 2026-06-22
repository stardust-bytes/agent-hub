import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotionService } from '../../connector/providers/notion/notion.service';

@Injectable()
export class NotionQueryDatabaseExecutor implements ToolExecutor {
  readonly name = 'notion_query_database';
  readonly description = 'Query a Notion database with optional filters and sorts. Returns matching pages with their property values.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      databaseId: { type: 'string', description: 'Notion database ID' },
      filter: {
        type: 'object',
        description: 'Optional filter object. Example: {"property":"Status","status":{"equals":"Done"}}',
      },
      sorts: {
        type: 'array',
        description: 'Optional sort array. Example: [{"property":"Created","direction":"descending"}]',
        items: { type: 'object' },
      },
      pageSize: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['databaseId'] as string[],
  };

  constructor(private readonly notion: NotionService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const results = await this.notion.queryDatabase(
        args.databaseId as string,
        args.filter as Record<string, unknown> | undefined,
        args.sorts as Record<string, unknown>[] | undefined,
        (args.pageSize as number) ?? 20,
      );
      if (results.length === 0) return 'No matching pages found.';
      return results.map(r => {
        const props = r.properties as Record<string, string> | undefined;
        const line = props
          ? Object.entries(props).map(([k, v]) => `${k}: ${v}`).join(' | ')
          : `id: ${r.id}`;
        return `— ${line}`;
      }).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
