import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotionService } from '../../connector/providers/notion/notion.service';

@Injectable()
export class NotionCreatePageExecutor implements ToolExecutor {
  readonly name = 'notion_create_page';
  readonly description = 'Create a new page inside a Notion database. Properties must match the database schema (title, select, status, etc.).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      databaseId: { type: 'string', description: 'Parent database ID' },
      properties: {
        type: 'object',
        description: 'Page property values. Format depends on database schema. Example: {"Name": {"title":[{"text":{"content":"My Page"}}]}, "Status": {"status":{"name":"Todo"}}}',
      },
    },
    required: ['databaseId', 'properties'] as string[],
  };

  constructor(private readonly notion: NotionService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const page = await this.notion.createPage(
        args.databaseId as string,
        args.properties as Record<string, unknown>,
      );
      return `Created Notion page: ${page.id}\n${page.url}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
