# Phase 4 — Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings panel to configure Ollama URL and default model via UI, persisted in SQLite.

**Architecture:** New `Setting` Prisma model, `SettingsModule` (service + controller) with GET/PATCH endpoints. `OllamaProvider` reads `ollama.baseUrl` from settings instead of ConfigService. Frontend `SettingsView.vue` renders full-width when ⚙️ clicked.

**Tech Stack:** Prisma 5, NestJS 10, Vue 3, `vue-i18n` v9.

---

## File Map

**Backend — Add to Prisma schema:**
- `backend/prisma/schema.prisma` — add `Setting` model

**Backend — Create:**
- `backend/src/settings/settings.module.ts`
- `backend/src/settings/settings.service.ts`
- `backend/src/settings/settings.service.spec.ts`
- `backend/src/settings/settings.controller.ts`
- `backend/src/settings/settings.controller.spec.ts`

**Backend — Modify:**
- `backend/src/app.module.ts` — add `SettingsModule`
- `backend/src/agent/providers/ollama.provider.ts` — use `SettingsService` for URL

**Frontend — Create:**
- `frontend/src/components/SettingsView.vue`

**Frontend — Modify:**
- `frontend/src/locales/vi.json`
- `frontend/src/locales/en.json`
- `frontend/src/components/AppShell.vue` — conditional SettingsView render
- `frontend/src/components/SidebarNav.vue` — wire ⚙️ to navigate

---

## Task 1: Prisma Migration — Add Setting Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add Setting model to schema**

Append to `backend/prisma/schema.prisma` after the `Task` model:

```prisma
model Setting {
  key   String @id
  value String
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_settings
```

Expected: Migration applied, `Setting` table created in SQLite.

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verify backend tests still pass**

```bash
npx jest --no-coverage
```

Expected: All tests pass (existing tests unaffected by schema change).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Setting model to Prisma schema"
```

---

## Task 2: SettingsService TDD

**Files:**
- Create: `backend/src/settings/settings.service.spec.ts`
- Create: `backend/src/settings/settings.service.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/settings/settings.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  setting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  it('findAll returns merged object with env defaults', async () => {
    mockPrisma.setting.findUnique.mockImplementation(({ where: { key } }: { where: { key: string } }) => {
      if (key === 'ollama.baseUrl') return null;
      if (key === 'ollama.defaultModel') return { key, value: 'codestral' };
      return null;
    });

    const result = await service.findAll();
    expect(result).toEqual({
      ollama: {
        baseUrl: 'http://localhost:11434',
        defaultModel: 'codestral',
      },
    });
  });

  it('upsert creates or updates a setting', async () => {
    mockPrisma.setting.upsert.mockResolvedValue({ key: 'ollama.baseUrl', value: 'http://192.168.1.100:11434' });

    await service.upsert('ollama.baseUrl', 'http://192.168.1.100:11434');

    expect(mockPrisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'ollama.baseUrl' },
      update: { value: 'http://192.168.1.100:11434' },
      create: { key: 'ollama.baseUrl', value: 'http://192.168.1.100:11434' },
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest src/settings/settings.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './settings.service'`

- [ ] **Step 3: Implement SettingsService**

```typescript
// backend/src/settings/settings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<{ ollama: { baseUrl: string; defaultModel: string } }> {
    const baseUrl = await this.get('ollama.baseUrl', 'http://localhost:11434');
    const defaultModel = await this.get('ollama.defaultModel', 'llama3.2');
    return { ollama: { baseUrl, defaultModel } };
  }

  async get(key: string, fallback: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? fallback;
  }

  async upsert(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/settings/settings.service.spec.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/settings/settings.service.ts backend/src/settings/settings.service.spec.ts
git commit -m "feat: add SettingsService with TDD"
```

---

## Task 3: SettingsController TDD

**Files:**
- Create: `backend/src/settings/settings.controller.spec.ts`
- Create: `backend/src/settings/settings.controller.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/settings/settings.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  const mockService = {
    findAll: jest.fn(),
    upsert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: mockService }],
    }).compile();
    controller = module.get<SettingsController>(SettingsController);
    jest.clearAllMocks();
  });

  it('getAll returns settings from service', async () => {
    const expected = { ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2' } };
    mockService.findAll.mockResolvedValue(expected);
    const result = await controller.getAll();
    expect(result).toEqual(expected);
  });

  it('updateSettings calls upsert with correct params', async () => {
    await controller.updateSettings('ollama.baseUrl', { value: 'http://192.168.1.100:11434' });
    expect(mockService.upsert).toHaveBeenCalledWith('ollama.baseUrl', 'http://192.168.1.100:11434');
  });

  it('updateSettings returns success object', async () => {
    const result = await controller.updateSettings('ollama.baseUrl', { value: 'http://x:11434' });
    expect(result).toEqual({ ok: true, key: 'ollama.baseUrl' });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/settings/settings.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './settings.controller'`

- [ ] **Step 3: Create SettingsController**

```typescript
// backend/src/settings/settings.controller.ts
import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { IsString } from 'class-validator';
import { SettingsService } from './settings.service';

class UpdateSettingDto {
  @IsString()
  value: string;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  async updateSettings(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<{ ok: boolean; key: string }> {
    await this.settingsService.upsert(key, dto.value);
    return { ok: true, key };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/settings/ --no-coverage
```

Expected: PASS (5 tests — 2 service + 3 controller)

- [ ] **Step 5: Commit**

```bash
git add backend/src/settings/settings.controller.ts backend/src/settings/settings.controller.spec.ts
git commit -m "feat: add SettingsController with GET/PATCH endpoints TDD"
```

---

## Task 4: SettingsModule + Register in AppModule

**Files:**
- Create: `backend/src/settings/settings.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create SettingsModule**

```typescript
// backend/src/settings/settings.module.ts
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 2: Register in AppModule**

Add import to `backend/src/app.module.ts`:

```typescript
import { SettingsModule } from './settings/settings.module';
```

Add to `imports` array: `SettingsModule,`

- [ ] **Step 3: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (~10–11 suites, ~38 tests)

- [ ] **Step 4: Commit**

```bash
git add backend/src/settings/settings.module.ts backend/src/app.module.ts
git commit -m "chore: add SettingsModule to AppModule"
```

---

## Task 5: Update OllamaProvider to Use Dynamic URL

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`

- [ ] **Step 1: Replace ConfigService with SettingsService**

Replace entire content of `backend/src/agent/providers/ollama.provider.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LLMProvider } from './llm-provider.interface';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class OllamaProvider implements LLMProvider {
  constructor(private readonly settings: SettingsService) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;

    const ollamaUrl = await this.settings.get('ollama.baseUrl', 'http://localhost:11434');

    let ollamaRes: globalThis.Response;
    try {
      ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: message }],
          stream: true,
        }),
        signal,
      });
    } catch {
      if (signal.aborted) return;
      res.write('data: {"error":"ollama_unreachable"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

    if (!ollamaRes.ok) {
      let detail = `ollama_error_${ollamaRes.status}`;
      try {
        const errBody = (await ollamaRes.json()) as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch { /* ignore parse error */ }
      res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
      res.write('data: [DONE]\n\n');
      return;
    }

    const reader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (parsed.message?.content) {
            res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
          }
        } catch {
          // skip malformed line
        }
      }
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  }
}
```

- [ ] **Step 2: Update OllamaProvider spec to use SettingsService mock**

The spec at `backend/src/agent/providers/ollama.provider.spec.ts` currently uses `ConfigService`. Replace the mock:

Change `provide: ConfigService` to `provide: SettingsService` and update the mock:

```typescript
import { SettingsService } from '../../settings/settings.service';
```

Replace the provider in `beforeEach`:
```typescript
{ provide: SettingsService, useValue: { get: jest.fn().mockResolvedValue('http://localhost:11434') } },
```

And at the top, remove the `ConfigService` import.

- [ ] **Step 3: Update AgentModule to export SettingsService**

Add `SettingsModule` import to `backend/src/agent/agent.module.ts`:

```typescript
import { SettingsModule } from '../settings/settings.module';
```

Add to `imports`: `SettingsModule,`

Or simpler: make SettingsModule `@Global()` and export SettingsService. Actually, the simplest is to import SettingsModule in AgentModule.

Wait — SettingsModule needs to be imported by AgentModule for OllamaProvider to resolve SettingsService. Let me add an import.

Actually, looking at the codebase pattern, PrismaModule is `@Global()`. I should make SettingsModule `@Global()` too so it's available everywhere without explicit imports.

Let me update SettingsModule:

```typescript
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 4: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS. If SettingsModule is @Global(), it's available to AgentModule without explicit import.

- [ ] **Step 5: Commit**

```bash
git add backend/src/settings/settings.module.ts backend/src/agent/providers/ollama.provider.ts backend/src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: OllamaProvider reads dynamic URL from SettingsService"
```

---

## Task 6: Frontend Locale Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add settings keys to vi.json**

Append before closing `}`:

```json
  "settings.header": "CÀI ĐẶT",
  "settings.ollamaUrl": "Ollama Base URL",
  "settings.defaultModel": "Model mặc định",
  "settings.save": "Lưu",
  "settings.saved": "✓ Đã lưu",
  "settings.version": "Phiên bản",
  "settings.info": "THÔNG TIN"
```

- [ ] **Step 2: Add settings keys to en.json**

Append before closing `}`:

```json
  "settings.header": "SETTINGS",
  "settings.ollamaUrl": "Ollama Base URL",
  "settings.defaultModel": "Default Model",
  "settings.save": "Save",
  "settings.saved": "✓ Saved",
  "settings.version": "Version",
  "settings.info": "INFO"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add settings panel i18n keys"
```

---

## Task 7: SettingsView Component

**Files:**
- Create: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Create SettingsView.vue**

```vue
<!-- frontend/src/components/SettingsView.vue -->
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiCog class="w-3 h-3 inline" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="mb-4">
          <label class="text-[#888888] text-[10px] font-mono block mb-1">{{ t('settings.ollamaUrl') }}</label>
          <div class="flex gap-2">
            <input
              v-model="ollamaUrl"
              class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none"
              :disabled="saving === 'ollama.baseUrl'"
            />
            <button
              @click="save('ollama.baseUrl', ollamaUrl)"
              :disabled="saving === 'ollama.baseUrl'"
              class="px-3 py-1.5 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150"
            >{{ saved === 'ollama.baseUrl' ? t('settings.saved') : t('settings.save') }}</button>
          </div>
        </div>

        <div class="mb-6">
          <label class="text-[#888888] text-[10px] font-mono block mb-1">{{ t('settings.defaultModel') }}</label>
          <div class="flex gap-2 items-center">
            <input
              v-model="defaultModel"
              class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none"
              :disabled="saving === 'ollama.defaultModel'"
            />
            <button
              @click="save('ollama.defaultModel', defaultModel)"
              :disabled="saving === 'ollama.defaultModel'"
              class="px-3 py-1.5 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150"
            >{{ saved === 'ollama.defaultModel' ? t('settings.saved') : t('settings.save') }}</button>
          </div>
        </div>

        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-[#888888] text-[10px] font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-xs font-mono text-[#888888] space-y-1">
            <div>{{ t('settings.version') }}: 0.1.0</div>
            <div :class="healthy ? 'text-cyber-green' : 'text-red-400'">
              ● {{ healthy ? t('health.ok') : t('health.error') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiCog } from 'vue-icons-plus/hi'

const { t } = useI18n()

const ollamaUrl = ref('')
const defaultModel = ref('')
const saving = ref<string | null>(null)
const saved = ref<string | null>(null)
const healthy = ref(false)

async function save(key: string, value: string) {
  saving.value = key
  try {
    const res = await fetch(`/api/settings/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    saved.value = key
    setTimeout(() => { if (saved.value === key) saved.value = null }, 2000)
  } catch { /* ignore */ }
  saving.value = null
}

onMounted(async () => {
  try {
    const [settingsRes, healthRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/health'),
    ])
    if (settingsRes.ok) {
      const data = await settingsRes.json() as { ollama: { baseUrl: string; defaultModel: string } }
      ollamaUrl.value = data.ollama.baseUrl
      defaultModel.value = data.ollama.defaultModel
    }
    if (healthRes.ok) {
      const h = await healthRes.json() as { status: string }
      healthy.value = h.status === 'ok'
    }
  } catch { /* ignore */ }
})
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SettingsView.vue
git commit -m "feat: add SettingsView component"
```

---

## Task 8: Wire SidebarNav ⚙️ + AppShell

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Wire settings button to navigate**

In `frontend/src/components/SidebarNav.vue`, the settings button currently does nothing (`@click` is missing). Change:

```vue
    <button
      :title="t('nav.settings')"
      @click="$emit('navigate', 'settings')"
      class="w-9 h-9 rounded flex items-center justify-center text-base text-[#888888] hover:text-cyber-accent"
    >
      <HiCog class="w-4 h-4" />
    </button>
```

- [ ] **Step 2: Add SettingsView to AppShell**

Update `frontend/src/components/AppShell.vue`:

```vue
<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <SettingsView v-if="activeView === 'settings'" class="flex-1 overflow-hidden" />
      <TasksView v-else-if="activeView === 'tasks'" class="flex-1 overflow-hidden" />
      <ChatPanel v-else class="flex-1 overflow-hidden" />
    </div>
    <StatusBar
      :model-name="modelName"
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'tasks' | 'files' | 'settings'>('chat')
const modelName = ref('llama3.2')
const dbConnected = ref(true)
const wsConnected = ref(false)
</script>
```

- [ ] **Step 3: Update SidebarNav props type**

In `frontend/src/components/SidebarNav.vue`, update the type from `'chat' | 'tasks' | 'files'` to include `'settings'`:

```typescript
defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings'] }>()
```

And update the `NavItem` view type and `navItems` array — add settings if needed. Actually, settings already has its own button. The navItems array doesn't need settings. Just update the prop types.

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AppShell.vue frontend/src/components/SidebarNav.vue
git commit -m "feat: wire SettingsView into AppShell, enable settings navigation"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full frontend build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS. Should show approximately 11 suites, ~38 tests.

- [ ] **Step 3: Full git log**

```bash
git log --oneline -10
```

Expected: Clean commit history.
