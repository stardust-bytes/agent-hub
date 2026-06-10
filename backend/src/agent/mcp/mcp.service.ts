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
      // Playwright MCP may not be available in all environments
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
