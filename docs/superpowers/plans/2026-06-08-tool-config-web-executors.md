# Tool Config & Web Executors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-tool config storage, web_fetch and web_search executors, and config UI.

**Architecture:** Tool model gains `configSchema` + `config` fields. Executors read config from DB. UI renders dynamic config form from JSON Schema.

**Tech Stack:** Prisma, NestJS, Vue 3

---

## Files

| Type | File |
|------|------|
| Modify | `backend/prisma/schema.prisma` |
| Modify | `backend/prisma/seed.ts` |
| Modify | `backend/src/tools/tools.service.ts` |
| Modify | `backend/src/tools/tools.controller.ts` |
| Modify | `backend/src/tools/tools.module.ts` |
| Create | `backend/src/tools/executors/web-fetch.executor.ts` |
| Create | `backend/src/tools/executors/web-search.executor.ts` |
| Modify | `frontend/src/components/ToolsView.vue` |
| Create | `frontend/src/components/ToolConfigModal.vue` |
| Modify | `frontend/src/locales/vi.json` |
| Modify | `frontend/src/locales/en.json` |

---

### Task 1: Prisma migration — add configSchema + config

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Update Tool model**

Add fields to Tool model:
```prisma
model Tool {
  name         String   @id
  description  String
  parameters   String
  configSchema String?
  config       String?
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add_tool_config`
Run: `npx prisma generate`

---

### Task 2: Update seed with configSchema

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add configSchema to web_search and web_fetch**

Update the DEFAULT_TOOLS array — add `configSchema` to web_search:

```ts
  { name: 'web_fetch', description: 'Fetch content from a URL', parameters: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}', enabled: false },
  { name: 'web_search', description: 'Search the web for information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', enabled: false,
    configSchema: '{"type":"object","properties":{"apiKey":{"type":"string","title":"API Key","format":"password"},"provider":{"type":"string","title":"Provider","enum":["google","bing"],"default":"google"},"cx":{"type":"string","title":"Google CSE ID"}},"required":["apiKey"]}' },
```

---

### Task 3: ToolsService — findByName + updateConfig

**Files:**
- Modify: `backend/src/tools/tools.service.ts`

- [ ] **Step 1: Add two new methods**

After `toggle()`:
```ts
async findByName(name: string) {
  return this.prisma.tool.findUnique({ where: { name } });
}

async updateConfig(name: string, config: Record<string, unknown>) {
  return this.prisma.tool.update({
    where: { name },
    data: { config: JSON.stringify(config) },
  });
}
```

---

### Task 4: ToolsController — config endpoint

**Files:**
- Modify: `backend/src/tools/tools.controller.ts`

- [ ] **Step 1: Add PATCH /:name/config**

```ts
import { Body } from '@nestjs/common';

@Patch(':name/config')
async updateConfig(
  @Param('name') name: string,
  @Body() body: { config: Record<string, unknown> },
) {
  return this.toolsService.updateConfig(name, body.config);
}
```

---

### Task 5: Create web-fetch executor

**Files:**
- Create: `backend/src/tools/executors/web-fetch.executor.ts`

- [ ] **Step 1: Write executor**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';

@Injectable()
export class WebFetchExecutor implements ToolExecutor {
  readonly name = 'web_fetch';

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;
    if (!url) return 'Error: URL is required.';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`;
      const text = await res.text();
      return text.length > 5000 ? text.slice(0, 5000) + '\n...(truncated)' : text;
    } catch (e) {
      return `Error fetching URL: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

---

### Task 6: Create web-search executor

**Files:**
- Create: `backend/src/tools/executors/web-search.executor.ts`

- [ ] **Step 1: Write executor**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ToolsService } from '../tools.service';

@Injectable()
export class WebSearchExecutor implements ToolExecutor {
  readonly name = 'web_search';

  constructor(private readonly toolsService: ToolsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const query = args.query as string;
    if (!query) return 'Error: query is required.';

    const tool = await this.toolsService.findByName('web_search');
    if (!tool || !tool.config) return 'Error: web_search is not configured. Go to Tools page to set up API key.';

    const config = JSON.parse(tool.config);
    if (!config.apiKey) return 'Error: API key not configured. Go to Tools page to set up.';

    try {
      const cx = config.cx || '';
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${config.apiKey}&cx=${cx}`;
      const res = await fetch(url);
      const data = await res.json() as { items?: Array<{ title: string; link: string; snippet: string }>; error?: { message: string } };
      if (data.error) return `Search API error: ${data.error.message}`;
      if (!data.items?.length) return 'No search results found.';

      return data.items.map((item, i) =>
        `${i + 1}. ${item.title}\n   ${item.link}\n   ${item.snippet}`
      ).join('\n\n');
    } catch (e) {
      return `Search error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

---

### Task 7: Register new executors in ToolsModule

**Files:**
- Modify: `backend/src/tools/tools.module.ts`

- [ ] **Step 1: Add imports and register**

```ts
import { WebFetchExecutor } from './executors/web-fetch.executor';
import { WebSearchExecutor } from './executors/web-search.executor';

const EXECUTORS = [
  // ... existing
  WebFetchExecutor,
  WebSearchExecutor,
];
```

---

### Task 8: Create ToolConfigModal.vue

**Files:**
- Create: `frontend/src/components/ToolConfigModal.vue`

- [ ] **Step 1: Write component**

```vue
<template>
  <BaseModal v-model="modelValue" :closable="true" max-height="80vh">
    <template #header>
      <span class="text-cyber-text text-sm font-mono">{{ t('tools.config.title') }}: {{ tool?.name }}</span>
    </template>
    <div class="px-3 py-4 space-y-3">
      <div v-for="(schema, key) in schemaProps" :key="key" class="mb-2">
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ schema.title || key }}</label>
        <input
          v-if="!schema.enum"
          v-model="formData[key]"
          :type="schema.format === 'password' ? 'password' : 'text'"
          class="w-full bg-cyber-dark px-2 py-1.5 text-sm font-mono text-cyber-text outline-none"
        />
        <select
          v-else
          v-model="formData[key]"
          class="w-full bg-cyber-dark px-2 py-1.5 text-sm font-mono text-cyber-text outline-none"
        >
          <option v-for="opt in schema.enum" :key="opt" :value="opt" class="bg-cyber-dark">{{ opt }}</option>
        </select>
      </div>
      <p v-if="!schemaProps || Object.keys(schemaProps).length === 0" class="text-cyber-muted text-sm font-mono">{{ t('tools.config.noConfig') }}</p>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button @click="$emit('update:modelValue', false)" class="px-3 py-1.5 text-sm font-mono text-cyber-muted bg-cyber-dark hover:text-cyber-text transition-colors duration-150">{{ t('tools.form.cancel') }}</button>
        <button @click="onSave" class="px-3 py-1.5 text-sm font-mono text-black bg-cyber-accent hover:bg-cyber-accent/80 transition-colors duration-150">{{ t('tools.config.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

interface Tool {
  name: string
  description: string
  configSchema?: string | null
  config?: string | null
  enabled: boolean
}

const props = defineProps<{
  modelValue: boolean
  tool: Tool | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const formData = reactive<Record<string, string>>({})

const schemaProps = computed(() => {
  if (!props.tool?.configSchema) return {}
  try {
    const schema = JSON.parse(props.tool.configSchema)
    return schema.properties || {}
  } catch { return {} }
})

watch(() => props.modelValue, (open) => {
  if (open && props.tool) {
    const existing: Record<string, string> = {}
    try { Object.assign(existing, JSON.parse(props.tool.config || '{}')) } catch {}
    for (const key of Object.keys(schemaProps.value)) {
      formData[key] = existing[key] || ''
    }
  }
})

async function onSave() {
  if (!props.tool) return
  await fetch(`/api/tools/${props.tool.name}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: { ...formData } }),
  })
  emit('saved')
  emit('update:modelValue', false)
}
</script>
```

---

### Task 9: Update ToolsView.vue — add Config button

**Files:**
- Modify: `frontend/src/components/ToolsView.vue`

- [ ] **Step 1: Add config button + modal**

Add import:
```ts
import ToolConfigModal from './ToolConfigModal.vue'
```

Add state refs after existing refs:
```ts
const configTool = ref<Tool | null>(null)
const showConfigModal = ref(false)
```

Add `openConfig` function:
```ts
function openConfig(tool: Tool) {
  configTool.value = tool
  showConfigModal.value = true
}
```

Add a new `<th>` for "Config" column after Action:
```html
<th class="text-right py-2 px-2 w-24">{{ t('tools.config') }}</th>
```

Add a new `<td>` for the Config button, after the toggle button:
```html
<td class="py-2 px-2 text-right">
  <button
    v-if="tool.configSchema"
    @click="openConfig(tool)"
    class="text-sm font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150"
  >{{ t('tools.config.edit') }}</button>
</td>
```

Add the modal at bottom of template:
```html
<ToolConfigModal v-model="showConfigModal" :tool="configTool" @saved="fetchTools" />
```

---

### Task 10: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Vietnamese keys**

```json
  "tools.config": "Config",
  "tools.config.edit": "Cấu hình",
  "tools.config.title": "Cấu hình",
  "tools.config.save": "Lưu",
  "tools.config.noConfig": "Không có cấu hình",
  "tools.form.cancel": "Huỷ"
```

- [ ] **Step 2: English keys**

```json
  "tools.config": "Config",
  "tools.config.edit": "Configure",
  "tools.config.title": "Configure",
  "tools.config.save": "Save",
  "tools.config.noConfig": "No configuration needed",
  "tools.form.cancel": "Cancel"
```

---

### Task 11: Verify build + tests

- [ ] **Step 1: Run backend tests**

Run: `npx jest`
Expected: 85+ passes

- [ ] **Step 2: Run frontend build**

Run: `cd ../frontend && npm run build`
Expected: vue-tsc + vite build succeed
