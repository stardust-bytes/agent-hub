# Tool Registry & Tools View — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract tool management into a standalone feature with Prisma-backed persistence and a Tools UI page.

**Architecture:** New `Tool` Prisma model + `ToolsModule` (service/controller) on backend. Frontend `ToolsView.vue` fetches and toggles tools via REST. `context-builder.service.ts` reads enabled tools from DB.

**Tech Stack:** NestJS, Prisma, SQLite, Vue 3, TailwindCSS

---

## Files

| Type | File |
|------|------|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/src/tools/tools.module.ts` |
| Create | `backend/src/tools/tools.service.ts` |
| Create | `backend/src/tools/tools.controller.ts` |
| Modify | `backend/src/app.module.ts` |
| Modify | `backend/src/agent/services/context-builder.service.ts` |
| Create | `frontend/src/components/ToolsView.vue` |
| Modify | `frontend/src/components/AppShell.vue` |
| Modify | `frontend/src/locales/vi.json` |
| Modify | `frontend/src/locales/en.json` |

---

### Task 1: Add Tool Prisma model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add Tool model to schema**

Add before the closing `}` or after `ProviderModel`:
```prisma
model Tool {
  name        String   @id
  description String
  parameters  String
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration + generate**

Run: `npx prisma migrate dev --name add_tools`
Run: `npx prisma generate`

---

### Task 2: Create ToolsModule (service + controller)

**Files:**
- Create: `backend/src/tools/tools.module.ts`
- Create: `backend/src/tools/tools.service.ts`
- Create: `backend/src/tools/tools.controller.ts`

- [ ] **Step 1: Create tools.service.ts**

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TOOLS = [
  { name: 'create_task', description: 'Create a new task in the task board', parameters: '{"type":"object","properties":{"title":{"type":"string"},"priority":{"type":"number","enum":[0,1,2]},"description":{"type":"string"}},"required":["title"]}' },
  { name: 'update_task', description: 'Update a task (title, description, status, priority, dueDate)', parameters: '{"type":"object","properties":{"id":{"type":"number"},"title":{"type":"string"},"description":{"type":"string"},"status":{"type":"string","enum":["TODO","PROCESSING","DONE","FAILED"]},"priority":{"type":"number","enum":[0,1,2]},"dueDate":{"type":"string"}},"required":["id"]}' },
  { name: 'list_tasks', description: 'List all tasks, optionally filter by status', parameters: '{"type":"object","properties":{"status":{"type":"string","enum":["TODO","PROCESSING","DONE","FAILED"]}}}' },
  { name: 'get_task', description: 'Get details of a specific task by ID', parameters: '{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}' },
  { name: 'delete_tasks', description: 'Delete one or more tasks by their IDs', parameters: '{"type":"object","properties":{"ids":{"type":"array","items":{"type":"number"}}},"required":["ids"]}' },
  { name: 'search_knowledge', description: 'Search the knowledge base for relevant information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}' },
  { name: 'web_fetch', description: 'Fetch content from a URL', parameters: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}', enabled: false },
  { name: 'web_search', description: 'Search the web for information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', enabled: false },
];

@Injectable()
export class ToolsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const tool of DEFAULT_TOOLS) {
      await this.prisma.tool.upsert({
        where: { name: tool.name },
        update: { description: tool.description, parameters: tool.parameters },
        create: { name: tool.name, description: tool.description, parameters: tool.parameters, enabled: tool.enabled ?? true },
      });
    }
  }

  async findAll() {
    return this.prisma.tool.findMany({ orderBy: { name: 'asc' } });
  }

  async findEnabled() {
    return this.prisma.tool.findMany({ where: { enabled: true } });
  }

  async toggle(name: string) {
    const tool = await this.prisma.tool.findUnique({ where: { name } });
    if (!tool) throw new Error(`Tool ${name} not found`);
    return this.prisma.tool.update({
      where: { name },
      data: { enabled: !tool.enabled },
    });
  }
}
```

- [ ] **Step 2: Create tools.controller.ts**

```ts
import { Controller, Get, Param, Patch, NotFoundException } from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  findAll() {
    return this.toolsService.findAll();
  }

  @Patch(':name/toggle')
  async toggle(@Param('name') name: string) {
    try {
      return await this.toolsService.toggle(name);
    } catch {
      throw new NotFoundException(`Tool '${name}' not found`);
    }
  }
}
```

- [ ] **Step 3: Create tools.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
```

---

### Task 3: Register ToolsModule in AppModule

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Import ToolsModule**

Add `ToolsModule` to the imports array in `AppModule`:
```ts
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    // ... existing imports
    ToolsModule,
  ],
})
```

---

### Task 4: Update context-builder to read enabled tools from DB

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Inject ToolsService and replace getDefaultTools**

Add import:
```ts
import { ToolsService } from '../../tools/tools.service';
```

Inject in constructor:
```ts
constructor(
  private readonly settingsService: SettingsService,
  private readonly toolsService: ToolsService,
) {}
```

Replace `getDefaultTools()`:
```ts
private async getEnabledTools(): Promise<ToolDefinition[]> {
  const dbTools = await this.toolsService.findEnabled();
  return dbTools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: JSON.parse(t.parameters),
    },
  }));
}
```

Update `getContext` / any method that calls `getDefaultTools` to use `await this.getEnabledTools()` instead.

---

### Task 5: Create ToolsView.vue

**Files:**
- Create: `frontend/src/components/ToolsView.vue`

- [ ] **Step 1: Create component**

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        ⚡ {{ t('tools.header') }}
      </span>
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="loading" class="text-cyber-muted text-sm font-mono">{{ t('tools.loading') }}</div>
      <table v-else class="w-full border-collapse font-mono text-sm">
        <thead>
          <tr class="border-b border-cyber-code-border text-cyber-muted">
            <th class="text-left py-2 px-2 w-20">{{ t('tools.status') }}</th>
            <th class="text-left py-2 px-2 w-40">{{ t('tools.name') }}</th>
            <th class="text-left py-2 px-2">{{ t('tools.description') }}</th>
            <th class="text-right py-2 px-2 w-24">{{ t('tools.action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tool in tools" :key="tool.name" class="border-b border-cyber-code-border/50 hover:bg-cyber-dark/40 transition-colors duration-150">
            <td class="py-2 px-2">
              <span :class="tool.enabled ? 'text-cyber-green' : 'text-cyber-muted'" class="font-mono text-sm">
                {{ tool.enabled ? '●' : '○' }}
              </span>
            </td>
            <td class="py-2 px-2 text-cyber-text font-mono">{{ tool.name }}</td>
            <td class="py-2 px-2 text-cyber-muted/80 font-mono text-xs">{{ tool.description }}</td>
            <td class="py-2 px-2 text-right">
              <button
                @click="toggle(tool.name)"
                :class="tool.enabled ? 'text-cyber-orange hover:text-cyber-orange/80' : 'text-cyber-accent hover:text-cyber-accent/80'"
                class="text-sm font-mono transition-colors duration-150"
              >{{ tool.enabled ? t('tools.disable') : t('tools.enable') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface Tool {
  name: string
  description: string
  enabled: boolean
}

const { t } = useI18n()
const tools = ref<Tool[]>([])
const loading = ref(true)

async function fetchTools() {
  try {
    const res = await fetch('/api/tools')
    if (res.ok) tools.value = await res.json() as Tool[]
  } catch { /* ignore */ }
  loading.value = false
}

async function toggle(name: string) {
  const tool = tools.value.find(t => t.name === name)
  if (!tool) return
  tool.enabled = !tool.enabled
  try {
    const res = await fetch(`/api/tools/${name}/toggle`, { method: 'PATCH' })
    if (!res.ok) tool.enabled = !tool.enabled
  } catch {
    tool.enabled = !tool.enabled
  }
}

onMounted(fetchTools)
</script>
```

---

### Task 6: Add ToolsView to AppShell + nav

**Files:**
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Add tools to activeView type and conditional rendering**

Find the `activeView` type definition and add `'tools'`:
```ts
const activeView = ref<'chat' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools'>('chat')
```

Find the conditional rendering section and add:
```html
<ToolsView v-if="activeView === 'tools'" @ws-status="(v: boolean) => wsConnected = v" />
```

Add import:
```ts
import ToolsView from './ToolsView.vue'
```

Find the sidebar nav items and add a tools button (with a suitable Hero Icon like HiLightningBolt or HiCog):

Add the Tools nav item to `SidebarNav.vue`:
```html
<button @click="$emit('navigate', 'tools')" :class="activeView === 'tools' ? 'text-cyber-accent' : 'text-cyber-muted'" class="...">
  <HiLightningBolt class="w-4 h-4" />
</button>
```

---

### Task 7: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

Insert after `"nav.providers"` line:
```json
  "nav.tools": "Tools",
  "tools.header": "TOOLS",
  "tools.loading": "Đang tải...",
  "tools.status": "Status",
  "tools.name": "Tool",
  "tools.description": "Mô tả",
  "tools.action": "Hành động",
  "tools.enable": "Bật",
  "tools.disable": "Tắt"
```

- [ ] **Step 2: Add English keys**

```json
  "nav.tools": "Tools",
  "tools.header": "TOOLS",
  "tools.loading": "Loading...",
  "tools.status": "Status",
  "tools.name": "Tool",
  "tools.description": "Description",
  "tools.action": "Action",
  "tools.enable": "Enable",
  "tools.disable": "Disable"
```

- [ ] **Step 3: Verify JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('frontend/src/locales/vi.json','utf8')); JSON.parse(require('fs').readFileSync('frontend/src/locales/en.json','utf8')); console.log('OK')"`

---

### Task 8: Verify build + tests

- [ ] **Step 1: Run backend tests**

Run: `npx jest`
Expected: Test suites pass

- [ ] **Step 2: Run frontend build**

Run: `cd ../frontend && npm run build`
Expected: vue-tsc passes, vite build succeeds
