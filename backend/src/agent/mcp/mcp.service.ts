import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';

interface McpServerEntry {
  id: string;
  client: McpClientService;
}

@Injectable()
export class McpService implements OnModuleInit {
  private servers = new Map<string, McpServerEntry>();

  async onModuleInit(): Promise<void> {
    await this.startPlaywrightServer();
  }

  private async startPlaywrightServer(): Promise<void> {
    try {
      const client = new McpClientService();
      await client.connectStdio('npx', [
        '@playwright/mcp',
      ]);
      this.servers.set('playwright', { id: 'playwright', client });
    } catch (e) {
      console.warn('Playwright MCP not available:', e instanceof Error ? e.message : e);
    }
  }

  async tryExecute(name: string, args: Record<string, unknown>): Promise<string | null> {
    const match = name.match(/^mcp__(.+)__(.+)$/);
    if (!match) return null;
    const [, serverId, toolName] = match;
    const server = this.servers.get(serverId);
    if (!server) return null;
    return server.client.callTool(toolName, args);
  }

  getServers(): string[] {
    return Array.from(this.servers.keys());
  }

  async getAllTools(): Promise<Array<{ name: string; description?: string; parameters: Record<string, unknown> }>> {
    const tools: Array<{ name: string; description?: string; parameters: Record<string, unknown> }> = [];
    for (const [serverId, entry] of this.servers) {
      const mcpTools = await entry.client.listTools();
      for (const t of mcpTools) {
        tools.push({
          name: `mcp__${serverId}__${t.name}`,
          description: t.description,
          parameters: t.inputSchema ?? {},
        });
      }
    }
    return tools;
  }

  async addServer(id: string, command: string, args: string[]): Promise<void> {
    const client = new McpClientService();
    await client.connectStdio(command, args);
    this.servers.set(id, { id, client });
  }

  async removeServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      await server.client.disconnect();
      this.servers.delete(id);
    }
  }
}
