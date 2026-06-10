import { Injectable } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

@Injectable()
export class McpClientService {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;

  isConnected(): boolean {
    return this.client !== null;
  }

  async connectStdio(command: string, args: string[] = []): Promise<void> {
    this.transport = new StdioClientTransport({ command, args });
    this.client = new Client(
      { name: 'workspace-agent', version: '0.1.0' },
      { capabilities: {} },
    );
    await this.client.connect(this.transport);
  }

  async connectSSE(url: string): Promise<void> {
    this.transport = new SSEClientTransport(new URL(url));
    this.client = new Client(
      { name: 'workspace-agent', version: '0.1.0' },
      { capabilities: {} },
    );
    await this.client.connect(this.transport);
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.client) return [];
    const result = await this.client.listTools();
    return result.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) return 'Error: MCP client not connected.';
    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });
      const content = (result.content ?? []) as { text?: string }[];
      return content
        .map(c => (c.text ?? JSON.stringify(c)))
        .join('\n');
    } catch (e) {
      return `Error: MCP tool "${name}" failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.client = null;
  }
}
