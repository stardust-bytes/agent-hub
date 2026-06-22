import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotionService } from '../../connector/providers/notion/notion.service';

@Injectable()
export class NotionGetPageExecutor implements ToolExecutor {
  readonly name = 'notion_get_page';
  readonly description = 'Read the full content of a Notion page by its ID. Returns all properties and block content.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      pageId: { type: 'string', description: 'Notion page ID (32-char hex or URL with hyphens)' },
    },
    required: ['pageId'] as string[],
  };

  constructor(private readonly notion: NotionService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const page = await this.notion.getPage(args.pageId as string);
      const propsStr = Object.entries(page.properties)
        .map(([k, v]) => `${k}: ${v}`).join('\n');
      return `Properties:\n${propsStr}\n\nContent:\n${page.content}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
