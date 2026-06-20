import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpClientService } from './mcp-client.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

interface McpServerEntry {
  id: string;
  client: McpClientService;
}

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private servers = new Map<string, McpServerEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly workspace: WorkspaceService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.startPlaywrightServer();
  }

  private async ensurePlaywrightBrowsers(): Promise<void> {
    try {
      const result = execSync('npx playwright install chromium 2>&1', {
        timeout: 120_000,
        stdio: 'pipe',
        windowsHide: true,
      });
      this.logger.log('Playwright Chromium installed/verified');
    } catch (e) {
      this.logger.warn('Could not install Playwright browsers:', (e as Error).message);
    }
  }

  private getCustomChromeUserDataDir(): string | null {
    const dir = this.config.get<string>('CHROME_USER_DATA_DIR');
    return dir ? path.resolve(dir) : null;
  }

  private async startPlaywrightServer(): Promise<void> {
    try {
      await this.ensurePlaywrightBrowsers();

      const root = this.workspace.getWorkspaceRoot();
      const snapshotDir = path.resolve(root, 'mcp_data');
      fs.mkdirSync(snapshotDir, { recursive: true });

      const args: string[] = [
        '@playwright/mcp',
        `--user-data-dir=${path.resolve(root, 'playwright-profile')}`,
        `--output-dir=${snapshotDir}`,
        '--output-mode=file',
      ];

      const customDataDir = this.getCustomChromeUserDataDir();
      if (customDataDir) {
        const isolatedDir = path.join(customDataDir, 'AgentWorkspace');
        fs.mkdirSync(isolatedDir, { recursive: true });
        args[1] = `--user-data-dir=${isolatedDir}`;
        this.logger.log(`Using Chrome profile at: ${isolatedDir}`);
      }

      this.logger.log('Starting Playwright MCP server...');
      const client = new McpClientService();
      await client.connectStdio('npx', args);
      this.servers.set('playwright', { id: 'playwright', client });
      this.logger.log('Playwright MCP server started');
    } catch (e) {
      this.logger.warn('Playwright MCP not available:', (e as Error).message);
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
