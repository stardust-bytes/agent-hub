# Model Configuration via Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make embedding and summary models configurable via Settings/ProviderModel instead of hardcoded env vars.

**Architecture:** Store `embed_model_id` and `summary_model_id` in the existing `Setting` table (key-value). KnowledgeService reads these via SettingsService, resolves to ProviderModel via ProvidersService, and falls back to env vars if unset.

**Tech Stack:** NestJS, Prisma, Vue 3, vue-i18n

---

### Task 1: Backend — SettingsService.findAll() returns DB data

**Files:**
- Modify: `backend/src/settings/settings.service.ts:8-10`
- Modify: `backend/src/settings/settings.service.spec.ts:26-30`

- [ ] **Step 1: Update `findAll()` to query all settings**

Edit `settings.service.ts`:

```typescript
async findAll(): Promise<Record<string, string>> {
  const rows = await this.prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}
```

- [ ] **Step 2: Update the existing `findAll` test**

Edit `settings.service.spec.ts` — add `findMany` to mock and update test:

```typescript
const mockPrisma = {
  setting: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

// Replace the existing findAll test:
it('findAll returns all settings', async () => {
  mockPrisma.setting.findMany.mockResolvedValue([
    { key: 'embed_model_id', value: '1' },
  ]);
  const result = await service.findAll();
  expect(result).toEqual({ embed_model_id: '1' });
});
```

- [ ] **Step 3: Run tests to verify**

Run: `npx jest src/settings/settings.service.spec.ts -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/settings/settings.service.ts backend/src/settings/settings.service.spec.ts
git commit -m "feat: SettingsService.findAll() reads from DB"
```

---

### Task 2: Backend — KnowledgeService model config from settings

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`
- Modify: `backend/src/knowledge/knowledge.service.spec.ts`

- [ ] **Step 1: Inject SettingsService + ProvidersService into KnowledgeService**

Add imports to `knowledge.service.ts`:

```typescript
import { SettingsService } from '../settings/settings.service';
import { ProvidersService } from '../providers/providers.service';
```

Add to constructor params:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly config: ConfigService,
  private readonly settings: SettingsService,
  private readonly providers: ProvidersService,
) {
  // existing body
}
```

- [ ] **Step 2: Add helper to resolve model config from settings**

Add private method to `KnowledgeService`:

```typescript
private async resolveModelConfig(
  settingKey: string,
  defaultModel: string,
): Promise<{ model: string; baseUrl: string; key?: string }> {
  const modelName = this.config.get<string>(defaultModel, 'nomic-embed-text');
  const baseUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');

  const settingsId = await this.settings.get(settingKey, '');
  if (settingsId) {
    const pm = await this.providers.findModelWithProvider(Number(settingsId));
    if (pm) {
      return {
        model: pm.name,
        baseUrl: pm.provider.baseUrl ?? baseUrl,
        key: pm.provider.key ?? undefined,
      };
    }
  }
  return { model: modelName, baseUrl };
}
```

- [ ] **Step 3: Update `embed()` method to use config**

Replace the first two lines of `embed()`:

```typescript
private async embed(text: string): Promise<number[]> {
  const cfg = await this.resolveModelConfig('embed_model_id', 'EMBED_MODEL');
  const res = await fetch(`${cfg.baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.model, prompt: text }),
  });
  // rest unchanged
```

- [ ] **Step 4: Update `generateSummary()` method to use config**

Replace the first two lines of `generateSummary()`:

```typescript
private async generateSummary(text: string): Promise<string | null> {
  const cfg = await this.resolveModelConfig('summary_model_id', 'SUMMARY_MODEL');
  try {
    const res = await fetch(`${cfg.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        prompt: `Write a 2-3 sentence summary...${text.substring(0, 6000)}`,
        stream: false,
        options: { num_predict: 200 },
      }),
    });
    // rest unchanged
```

- [ ] **Step 5: Run tests to verify they still pass**

Run: `npx jest src/knowledge/knowledge.service.spec.ts -v`
Expected: PASS (tests don't exercise embed/generateSummary — verified in next step)

- [ ] **Step 6: Update KnowledgeService test to provide SettingsService + ProvidersService**

Edit `knowledge.service.spec.ts` — add mocks and module providers:

```typescript
import { SettingsService } from '../settings/settings.service';
import { ProvidersService } from '../providers/providers.service';

const mockSettings = {
  get: jest.fn().mockResolvedValue(''),
};

const mockProviders = {
  findModelWithProvider: jest.fn().mockResolvedValue(null),
};

// In TestingModule providers array, add:
{ provide: SettingsService, useValue: mockSettings },
{ provide: ProvidersService, useValue: mockProviders },
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/knowledge/knowledge.service.ts backend/src/knowledge/knowledge.service.spec.ts
git commit -m "feat: KnowledgeService reads embed/summary model from settings"
```

---

### Task 3: Frontend — i18n keys for model settings

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

Add to `frontend/src/locales/vi.json`:

```json
"settings.embedModel": "Model Embedding",
"settings.summaryModel": "Model Tóm tắt",
"settings.defaultOption": "Mặc định (env)"
```

- [ ] **Step 2: Add English keys**

Add to `frontend/src/locales/en.json`:

```json
"settings.embedModel": "Embedding Model",
"settings.summaryModel": "Summary Model",
"settings.defaultOption": "Default (env)"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add i18n keys for model settings"
```

---

### Task 4: Frontend — SettingsView model selection dropdowns

**Files:**
- Modify: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Add model selection UI to SettingsView**

Add reactive state and fetch logic:

```typescript
interface ProviderModelOption {
  id: number;
  label: string;
}

const providers = ref<ProviderModelOption[]>([])
const embedModelId = ref<string>('')
const summaryModelId = ref<string>('')
const saved = ref(false)

onMounted(async () => {
  // existing health check...
  try {
    const [provRes, settingsRes] = await Promise.all([
      fetch('/api/providers/models'),
      fetch('/api/settings'),
    ])
    if (provRes.ok) {
      const models = await provRes.json() as Array<{ id: number; name: string; providerName: string }>
      providers.value = models.map(m => ({ id: m.id, label: `${m.providerName} / ${m.name}` }))
    }
    if (settingsRes.ok) {
      const settingsData = await settingsRes.json() as Record<string, string>
      embedModelId.value = settingsData['embed_model_id'] ?? ''
      summaryModelId.value = settingsData['summary_model_id'] ?? ''
    }
  } catch { /* ignore */ }
})

async function saveSetting(key: string, value: string) {
  saved.value = false
  try {
    await fetch(`/api/settings/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch { /* ignore */ }
}
```

Add template after the health section:

```html
<div class="border-t border-cyber-accent/10 pt-4 mt-4">
  <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.info') }}</div>
  <div class="space-y-3">
    <div>
      <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('settings.embedModel') }}</label>
      <select v-model="embedModelId" @change="saveSetting('embed_model_id', embedModelId)"
        class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent">
        <option value="">{{ t('settings.defaultOption') }}</option>
        <option v-for="p in providers" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
      </select>
    </div>
    <div>
      <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('settings.summaryModel') }}</label>
      <select v-model="summaryModelId" @change="saveSetting('summary_model_id', summaryModelId)"
        class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent">
        <option value="">{{ t('settings.defaultOption') }}</option>
        <option v-for="p in providers" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
      </select>
    </div>
    <div v-if="saved" class="text-cyber-green text-xs font-mono">{{ t('settings.saved') }}</div>
  </div>
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SettingsView.vue
git commit -m "feat: add model selection dropdowns to SettingsView"
```
