# Agent Execution Tools — Phase 2 (MCP Adapter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MCP adapter layer with McpService, McpClientService, and Playwright MCP browser automation server.

**Architecture:** `McpClientService` wraps `@modelcontextprotocol/sdk` Client. `McpService` manages server registry (Playwright MCP auto-started + user-configured servers). MCP tools prefixed `mcp__{serverId}__{toolName}`, discovered dynamically. `AgentLoopService.executeTool()` falls back to McpService if not found in executorMap.

**Tech Stack:** `@modelcontextprotocol/sdk`, `@playwright/mcp`, NestJS 10, child_process (stdio transport).

---

## File Structure

```
backend/src/agent/mcp/
├── mcp.module.ts              — Create
├── mcp.service.ts             — Create (server registry + lifecycle)
├── mcp.service.spec.ts        — Create
├── mcp-client.service.ts      — Create (MCP SDK wrapper)
├── mcp-client.service.spec.ts — Create

backend/src/agent/services/agent-loop.service.ts — Modify (MCP fallback)
backend/src/agent/agent.module.ts                — Modify (import McpModule)
backend/package.json                              — Modify (add deps)
backend/Dockerfile                                 — Modify (add playwright deps)
backend/prisma/seed.ts                            — Modify (add MCP config seed)
backend/src/tools/tools.module.ts                 — Modify (export McpModule tools if needed)
```

---

### Task 1: Install MCP Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Add dependencies to package.json**

```bash
cd backend; npm install @modelcontextprotocol/sdk @playwright/mcp
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require('@modelcontextprotocol/sdk'); console.log('SDK OK')"`
Expected: `SDK OK`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add @modelcontextprotocol/sdk and @playwright/mcp dependencies"
```

---

### Task 2: McpClientService (MCP SDK Wrapper)

**Files:**
- Create: `backend/src/agent/mcp/mcp-client.service.ts`
- Create: `backend/src/agent/mcp/mcp-client.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/agent/mcp/mcp-client.service.spec.ts
import { Test } from '@nestjs/testing';
import { McpClientService } from './mcp-client.service';

describe('McpClientService', () => {
  let service: McpClientService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [McpClientService],
    }).compile();
    service = module.get(McpClientService);
  });

  it('returns false for isConnected when not connected', () => {
    expect(service.isConnected()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/agent/mcp/mcp-client.service.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/agent/mcp/mcp-client.service.ts
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
    this.client = new Client({ name: 'workspace-agent', version: '0.1.0' });
    await this.client.connect(this.transport);
  }

  async connectSSE(url: string): Promise<void> {
    this.transport = new SSEClientTransport(new URL(url));
    this.client = new Client({ name: 'workspace-agent', version: '0.1.0' });
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
      const result = await this.client.callTool({ name, arguments: args });
      const content = result.content || [];
      return content
        .map((c: any) => (c.text ?? JSON.stringify(c)))
        .join('\n');
    } catch (e) {
      return `Error calling MCP tool "${name}": ${e instanceof Error ? e.message : 'Unknown error'}`;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/agent/mcp/mcp-client.service.spec.ts --no-coverage`
Expected: PASS (1 test)

- [ ] **Step 5: Add more tests**

```ts
// Add to mcp-client.service.spec.ts
  it('returns error string when calling tool without connection', async () => {
    const result = await service.callTool('test', {});
    expect(result).toMatch(/Error/);
  });
```

- [ ] **Step 6: Run tests**

Run: `npx jest src/agent/mcp/mcp-client.service.spec.ts --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent/mcp/mcp-client.service.ts backend/src/agent/mcp/mcp-client.service.spec.ts
git commit -m "feat: add McpClientService wrapping MCP SDK Client"
```

---

### Task 3: McpService (Server Registry + Lifecycle)

**Files:**
- Create: `backend/src/agent/mcp/mcp.service.ts`
- Create: `backend/src/agent/mcp/mcp.service.spec.ts`
- Create: `backend/src/agent/mcp/mcp.module.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/agent/mcp/mcp.service.spec.ts
import { Test } from '@nestjs/testing';
import { McpService } from './mcp.service';
import { McpClientService } from './mcp-client.service';

describe('McpService', () => {
  let service: McpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        McpService,
        { provide: McpClientService, useValue: {} },
      ],
    }).compile();
    service = module.get(McpService);
  });

  it('returns null for unknown tool', async () => {
    const result = await service.tryExecute('unknown_tool', {});
    expect(result).toBeNull();
  });

  it('returns null for non-MCP tool name', async () => {
    const result = await service.tryExecute('create_task', {});
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/agent/mcp/mcp.service.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/agent/mcp/mcp.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';

interface McpServerEntry {
  id: string;
  client: McpClientService;
}

@Injectable()
export class McpService implements OnModuleInit {
  private servers = new Map<string, McpServerEntry>();

  constructor() {}

  async onModuleInit(): Promise<void> {
    // Auto-start Playwright MCP server
    await this.startPlaywrightServer();
  }

  private async startPlaywrightServer(): Promise<void> {
    try {
      const client = new McpClientService();
      await client.connectStdio('npx', [
        '@playwright/mcp',
        '--headless',
      ]);
      this.servers.set('playwright', { id: 'playwright', client });
    } catch (e) {
      console.error('Failed to start Playwright MCP server:', e);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/agent/mcp/mcp.service.spec.ts --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 5: Create McpModule**

```ts
// backend/src/agent/mcp/mcp.module.ts
import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpClientService } from './mcp-client.service';

@Module({
  providers: [McpService, McpClientService],
  exports: [McpService, McpClientService],
})
export class McpModule {}
```

- [ ] **Step 6: Run both MCP tests**

Run: `npx jest src/agent/mcp/ --no-coverage`
Expected: PASS (4 tests across 2 suites)

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent/mcp/
git commit -m "feat: add McpService with Playwright MCP auto-start and server registry"
```

---

### Task 4: Wire McpModule into Agent Module + AgentLoopService

**Files:**
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts`

- [ ] **Step 1: Update agent.module.ts to import McpModule**

```ts
// backend/src/agent/agent.module.ts
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule, ProvidersModule, ToolsModule, NotesModule, PlansModule, McpModule],
  ...
})
```

- [ ] **Step 2: Update AgentLoopService to inject McpService and add MCP fallback**

Add import:
```ts
import { McpService } from '../mcp/mcp.service';
```

Add constructor param:
```ts
    private readonly mcpService: McpService,
```

Update `executeTool()` method to add MCP fallback:
```ts
  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const executor = this.executorMap.get(name);
    if (executor) return executor.execute(args);
    const mcpResult = await this.mcpService.tryExecute(name, args);
    if (mcpResult !== null) return mcpResult;
    return `Error: Unknown tool: ${name}`;
  }
```

- [ ] **Step 3: Update agent-loop.service.spec.ts**

Add mock provider for McpService in the test module setup:
```ts
import { McpService } from '../mcp/mcp.service';
```
Add to providers mock:
```ts
        { provide: McpService, useValue: { tryExecute: jest.fn().mockResolvedValue(null) } },
```

- [ ] **Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: PASS (all 27+ suites, now with MCP tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/agent.module.ts backend/src/agent/services/agent-loop.service.ts backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "feat: wire McpModule into agent loop with MCP tool fallback"
```

---

### Task 5: Update Dockerfile + Seed Config

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Update Dockerfile to add Playwright browser deps**

Add to Stage 2 (production) after `RUN mkdir -p /app/data`:
```dockerfile
RUN npx playwright install chromium --with-deps
RUN npx playwright install-deps chromium
```

- [ ] **Step 2: Add MCP default config to seed**

In `backend/prisma/seed.ts`, add a function to seed default MCP server config in Setting table if not exists:
```ts
  // Seed default MCP servers config
  const mcpConfig = await prisma.setting.findUnique({ where: { key: 'mcp.servers' } });
  if (!mcpConfig) {
    await prisma.setting.create({
      data: {
        key: 'mcp.servers',
        value: JSON.stringify([
          {
            id: 'playwright',
            name: 'Playwright Browser',
            type: 'stdio',
            command: 'npx',
            args: ['@playwright/mcp', '--headless'],
            enabled: true,
          },
        ]),
      },
    });
    console.log('Seeded default MCP server: playwright');
  }
```

- [ ] **Step 3: Run seed**

Run: `cd backend; npx prisma db seed`
Expected: "Seeded 17 tools" + "Seeded default MCP server: playwright"

- [ ] **Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/prisma/seed.ts
git commit -m "feat: add Playwright MCP to Dockerfile and seed default MCP config"
```

---

### Task 6: Frontend — MCP Servers Section in Settings

**Files:**
- Modify: `frontend/src/components/SettingsView.vue`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/vi.json`

- [ ] **Step 1: Add MCP section to SettingsView.vue**

Add after the models section in `frontend/src/components/SettingsView.vue`:

```vue
        <!-- MCP Servers -->
        <div class="border-t border-cyber-accent/10 pt-4 mt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.mcpServers') }}</div>
          <div v-if="mcpServers.length === 0" class="text-cyber-muted/50 text-xs font-mono">
            {{ t('settings.noMcpServers') }}
          </div>
          <div v-for="server in mcpServers" :key="server.id"
            class="flex items-center justify-between py-1.5 px-2 bg-cyber-dark border border-cyber-code-border rounded mb-1">
            <div>
              <div class="text-cyber-text text-xs font-mono">{{ server.name }}</div>
              <div class="text-cyber-muted/50 text-2xs font-mono">{{ server.type }} · {{ server.id }}</div>
            </div>
            <span :class="server.enabled ? 'text-cyber-green' : 'text-cyber-muted/50'"
              class="text-xs font-mono">{{ server.enabled ? 'ON' : 'OFF' }}</span>
          </div>
        </div>
```

Add script section in `<script setup lang="ts">`:
```ts
const mcpServers = ref<Array<{ id: string; name: string; type: string; enabled: boolean }>>([])

onMounted(async () => {
  // ... existing health check
  try {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const settings = await res.json()
      const mcpCfg = settings.find((s: any) => s.key === 'mcp.servers')
      if (mcpCfg) {
        mcpServers.value = JSON.parse(mcpCfg.value)
      }
    }
  } catch { /* ignore */ }
})
```

- [ ] **Step 2: Add i18n keys**

In `frontend/src/locales/en.json`:
```json
  "settings.mcpServers": "MCP Servers",
  "settings.noMcpServers": "No MCP servers configured",
```

In `frontend/src/locales/vi.json`:
```json
  "settings.mcpServers": "MCP Servers",
  "settings.noMcpServers": "Chưa có MCP server nào",
```

- [ ] **Step 3: Typescript check**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SettingsView.vue frontend/src/locales/en.json frontend/src/locales/vi.json
git commit -m "feat: add MCP Servers section to settings view"
```

---

## Verification

After all tasks complete:

1. Run `npx jest --no-coverage` — all suites pass
2. Start backend: `npm run start:dev` — McpService auto-starts Playwright MCP
3. Agent can now use tools like `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`
4. Settings UI shows MCP Servers section with Playwright listed as ON
5. Docker build: `docker build -t workspace-backend backend/` — includes Playwright browser
