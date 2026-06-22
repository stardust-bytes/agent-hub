import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotionService } from '../../connector/providers/notion/notion.service';

@Injectable()
export class NotionUpdatePageExecutor implements ToolExecutor {
  readonly name = 'notion_update_page';
  readonly description = 'Update properties of an existing Notion page. Only provided properties are updated.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      pageId: { type: 'string', description: 'Page ID to update' },
      properties: {
        type: 'object',
        description: 'Property values to update. Same format as create_page.',
      },
    },
    required: ['pageId', 'properties'] as string[],
  };

  constructor(private readonly notion: NotionService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      await this.notion.updatePage(
        args.pageId as string,
        args.properties as Record<string, unknown>,
      );
      return `Updated Notion page ${args.pageId}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
