import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';
import { ConnectorService } from '../../connector.service';

@Injectable()
export class NotionService {
  constructor(private readonly connector: ConnectorService) {}

  async getClient(type: string = 'notion'): Promise<Client | null> {
    const conn = await this.connector.findByType(type);
    if (!conn?.enabled) return null;
    const config = JSON.parse(conn.config);
    if (!config.token) return null;
    return new Client({ auth: config.token });
  }

  async search(query: string, pageSize = 10) {
    const client = await this.getClient();
    if (!client) throw new Error('Notion connector not configured');
    const results = await client.search({ query, page_size: pageSize });
    return results.results.map(r => this.formatResult(r));
  }

  async getPage(pageId: string) {
    const client = await this.getClient();
    if (!client) throw new Error('Notion connector not configured');
    const [page, blocks] = await Promise.all([
      client.pages.retrieve({ page_id: pageId }),
      client.blocks.children.list({ block_id: pageId }),
    ]);
    return {
      id: page.id,
      properties: this.formatProperties(page),
      content: blocks.results.map(b => this.formatBlock(b)).filter(Boolean).join('\n'),
    };
  }

  async createPage(parentDatabaseId: string, properties: Record<string, unknown>) {
    const client = await this.getClient();
    if (!client) throw new Error('Notion connector not configured');
    const page = await client.pages.create({
      parent: { database_id: parentDatabaseId },
      properties: properties as any,
    });
    return { id: page.id, url: (page as any).url };
  }

  async updatePage(pageId: string, properties: Record<string, unknown>) {
    const client = await this.getClient();
    if (!client) throw new Error('Notion connector not configured');
    await client.pages.update({ page_id: pageId, properties: properties as any });
    return { ok: true };
  }

  async queryDatabase(databaseId: string, filter?: Record<string, unknown>, sorts?: Record<string, unknown>[], pageSize = 20) {
    const client = await this.getClient();
    if (!client) throw new Error('Notion connector not configured');
    const results = await (client.databases as any).query({
      database_id: databaseId,
      filter: filter as any,
      sorts: sorts as any,
      page_size: pageSize,
    });
    return results.results.map(r => this.formatResult(r));
  }

  private formatResult(r: any) {
    const base: Record<string, unknown> = {
      id: r.id, type: r.object, url: (r as any).url,
      createdTime: r.created_time, lastEditedTime: r.last_edited_time,
    };
    if (r.object === 'page') base.properties = this.formatProperties(r);
    if (r.object === 'database') {
      base.title = r.title?.[0]?.plain_text ?? '';
      base.properties = Object.keys(r.properties ?? {});
    }
    return base;
  }

  private formatProperties(page: any): Record<string, string> {
    const props: Record<string, string> = {};
    if (!page.properties) return props;
    for (const [key, val] of Object.entries(page.properties)) {
      const v = val as any;
      if (v.type === 'title') props[key] = v.title?.[0]?.plain_text ?? '';
      else if (v.type === 'rich_text') props[key] = v.rich_text?.[0]?.plain_text ?? '';
      else if (v.type === 'select') props[key] = v.select?.name ?? '';
      else if (v.type === 'status') props[key] = v.status?.name ?? '';
      else if (v.type === 'multi_select') props[key] = (v.multi_select ?? []).map((s: any) => s.name).join(', ');
      else if (v.type === 'date') props[key] = v.date?.start ?? '';
      else if (v.type === 'number') props[key] = String(v.number ?? '');
      else if (v.type === 'checkbox') props[key] = String(v.checkbox ?? false);
      else if (v.type === 'url') props[key] = v.url ?? '';
      else if (v.type === 'email') props[key] = v.email ?? '';
      else if (v.type === 'phone_number') props[key] = v.phone_number ?? '';
      else if (v.type === 'created_time') props[key] = v.created_time ?? '';
      else if (v.type === 'last_edited_time') props[key] = v.last_edited_time ?? '';
      else if (v.type === 'created_by') props[key] = v.created_by?.name ?? '';
      else if (v.type === 'last_edited_by') props[key] = v.last_edited_by?.name ?? '';
      else if (v.type === 'people') props[key] = (v.people ?? []).map((p: any) => p.name ?? p.id).join(', ');
    }
    return props;
  }

  private formatBlock(block: any): string | null {
    const type = block.type;
    const content = block[type];
    if (!content) return null;
    if (type === 'paragraph') return content.rich_text?.map((t: any) => t.plain_text).join('') ?? '';
    if (type === 'heading_1') return '# ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'heading_2') return '## ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'heading_3') return '### ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'bulleted_list_item') return '- ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'numbered_list_item') return '1. ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'to_do') {
      const checked = content.checked ? '[x]' : '[ ]';
      return `${checked} ` + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    }
    if (type === 'code') return '```' + (content.language ?? '') + '\n' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '') + '\n```';
    if (type === 'quote') return '> ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'callout') return '> 💡 ' + (content.rich_text?.map((t: any) => t.plain_text).join('') ?? '');
    if (type === 'divider') return '---';
    if (type === 'bookmark') return content.url ?? '';
    if (type === 'image') return content.external?.url ?? content.file?.url ?? '';
    return `[${type} block]`;
  }
}
