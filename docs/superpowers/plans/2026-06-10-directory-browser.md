# Directory Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken browser `webkitdirectory` file picker with a backend-driven directory tree browser for cowork project selection.

**Architecture:** Add `GET /api/cowork/drives` and `GET /api/cowork/browse?path=X` endpoints to CoworkController. Build a new DirectoryBrowser Vue component that navigates the filesystem through these APIs. Integrate into FilesView replacing the old hidden-input browse flow.

**Tech Stack:** NestJS, Vue 3, TailwindCSS, BaseModal

---

## File Structure

### Backend — Modify:
- `backend/src/cowork/cowork.service.ts` — add `getDrives()`, `browseDirectory()`
- `backend/src/cowork/cowork.service.spec.ts` — tests for new methods
- `backend/src/cowork/cowork.controller.ts` — add `GET /drives`, `GET /browse`
- `backend/src/cowork/cowork.controller.spec.ts` — tests for new endpoints

### Frontend — Create:
- `frontend/src/components/DirectoryBrowser.vue` — directory tree modal

### Frontend — Modify:
- `frontend/src/components/FilesView.vue` — replace webkitdirectory flow with DirectoryBrowser
- `frontend/src/locales/vi.json` — add i18n keys
- `frontend/src/locales/en.json` — add i18n keys

---

### Task 1: Add getDrives and browseDirectory to CoworkService

**Files:**
- Modify: `backend/src/cowork/cowork.service.ts`

- [ ] **Step 1: Write the failing test**

In `backend/src/cowork/cowork.service.spec.ts`, add to the existing `mockWorkspace`:

```ts
const mockWorkspace = {
  addAllowedPath: jest.fn(),
  isPathAllowed: jest.fn().mockReturnValue(true),
};
```

Then add these tests inside `describe('CoworkService', ...)`:

```ts
describe('getDrives', () => {
  it('returns an array of drive strings', async () => {
    const drives = await service.getDrives();
    expect(Array.isArray(drives)).toBe(true);
    expect(drives.length).toBeGreaterThan(0);
    expect(drives[0]).toMatch(/^[a-zA-Z]:\\$|^\/$/);
  });
});

describe('browseDirectory', () => {
  it('returns entries for a valid directory', async () => {
    const result = await service.browseDirectory(process.cwd());
    expect(result.path).toBe(process.cwd());
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries[0]).toHaveProperty('name');
    expect(result.entries[0]).toHaveProperty('isDirectory');
  });

  it('throws for non-existent path', async () => {
    await expect(service.browseDirectory('Z:\\__nonexistent__')).rejects.toThrow();
  });

  it('only returns directories', async () => {
    const result = await service.browseDirectory(process.cwd());
    for (const entry of result.entries) {
      expect(entry.isDirectory).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest backend/src/cowork/cowork.service.spec.ts --testNamePattern="getDrives|browseDirectory" -v`
Expected: 4 failures

- [ ] **Step 3: Add getDrives and browseDirectory**

In `backend/src/cowork/cowork.service.ts`, add after the existing methods:

```ts
async getDrives(): Promise<string[]> {
  if (process.platform === 'win32') {
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      try {
        await fs.access(letter + ':\\');
        drives.push(letter + ':\\');
      } catch { /* skip unavailable drives */ }
    }
    return drives;
  }
  return ['/'];
}

async browseDirectory(dirPath: string): Promise<{ path: string; entries: Array<{ name: string; isDirectory: boolean }> }> {
  const resolved = path.resolve(dirPath);
  const dirents = await fs.readdir(resolved, { withFileTypes: true });
  const entries = dirents
    .filter(d => d.isDirectory())
    .map(d => ({ name: d.name, isDirectory: true }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return { path: resolved, entries };
}
```

Add the import at the top:
```ts
import * as fs from 'fs/promises';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest backend/src/cowork/cowork.service.spec.ts --testNamePattern="getDrives|browseDirectory" -v`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/cowork/cowork.service.ts backend/src/cowork/cowork.service.spec.ts
git commit -m "feat: add getDrives and browseDirectory to CoworkService"
```

---

### Task 2: Add GET /drives and GET /browse endpoints

**Files:**
- Modify: `backend/src/cowork/cowork.controller.ts`
- Modify: `backend/src/cowork/cowork.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

In `backend/src/cowork/cowork.controller.spec.ts`, add to the existing `mockService`:

```ts
const mockService = {
  setProject: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockResolvedValue({ projectPath: '/test', isActive: true }),
  clearProject: jest.fn().mockResolvedValue(undefined),
  getDrives: jest.fn().mockResolvedValue(['C:\\', 'D:\\']),
  browseDirectory: jest.fn().mockResolvedValue({ path: '/test', entries: [{ name: 'subdir', isDirectory: true }] }),
};
```

Add these tests inside `describe('CoworkController', ...)`:

```ts
it('getDrives returns drives from service', async () => {
  const result = await controller.getDrives();
  expect(mockService.getDrives).toHaveBeenCalled();
  expect(result).toEqual(['C:\\', 'D:\\']);
});

it('browse delegates to service.browseDirectory', async () => {
  const result = await controller.browse('/test');
  expect(mockService.browseDirectory).toHaveBeenCalledWith('/test');
  expect(result.entries[0].name).toBe('subdir');
});
```

- [ ] **Step 2: Run test**

Run: `npx jest backend/src/cowork/cowork.controller.spec.ts --testNamePattern="drives|browse" -v`
Expected: 2 failures

- [ ] **Step 3: Add controller methods**

In `backend/src/cowork/cowork.controller.ts`, add after existing methods:

```ts
import { Query } from '@nestjs/common';

@Get('drives')
async getDrives() {
  return this.cowork.getDrives();
}

@Get('browse')
async browse(@Query('path') path: string) {
  return this.cowork.browseDirectory(path);
}
```

- [ ] **Step 4: Run test**

Run: `npx jest backend/src/cowork/cowork.controller.spec.ts --testNamePattern="drives|browse" -v`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/cowork/cowork.controller.ts backend/src/cowork/cowork.controller.spec.ts
git commit -m "feat: add GET /api/cowork/drives and GET /api/cowork/browse endpoints"
```

---

### Task 3: Create DirectoryBrowser component

**Files:**
- Create: `frontend/src/components/DirectoryBrowser.vue`

- [ ] **Step 1: Create DirectoryBrowser.vue**

```vue
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 bg-cyber-dark/80 z-50 flex items-center justify-center" @click.self="emit('update:modelValue', false)">
      <div class="w-120 bg-cyber-modal-bg border border-cyber-border flex flex-col" style="max-height: 80vh; max-width: 90vw">
        <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0 border-b border-cyber-border">
          <span class="text-cyber-text text-sm font-mono truncate flex-1">{{ currentPath || t('cowork.browse.title') }}</span>
          <button @click="emit('update:modelValue', false)" class="text-cyber-muted text-sm font-mono hover:text-cyber-accent shrink-0 ml-2">✕</button>
        </div>
        <div class="overflow-y-auto flex-1 px-3 py-3">
          <div v-if="loading" class="text-cyber-muted text-sm font-mono text-center py-4">⟳ {{ t('cowork.browse.loading') }}</div>
          <div v-else-if="error" class="text-red-400 text-sm font-mono text-center py-4">{{ t('cowork.browse.error') }}</div>
          <div v-else-if="entries.length === 0 && !currentPath" class="text-cyber-muted text-sm font-mono text-center py-4">{{ t('cowork.browse.loading') }}</div>
          <div v-else-if="entries.length === 0" class="text-cyber-muted text-sm font-mono text-center py-4">{{ t('cowork.browse.empty') }}</div>
          <div v-else class="space-y-0.5">
            <div v-if="canGoUp"
              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-cyber-accent/10 transition-colors duration-150 text-cyber-accent text-sm font-mono"
              @click="goUp">
              <span>..</span>
              <span class="text-cyber-muted text-xs">{{ t('cowork.browse.parent') }}</span>
            </div>
            <div v-for="entry in entries" :key="entry.name"
              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-cyber-accent/10 transition-colors duration-150 text-cyber-text text-sm font-mono"
              @click="navigate(entry.name)">
              <HiFolder class="w-4 h-4 text-cyber-accent/60 shrink-0" />
              <span class="truncate">{{ entry.name }}</span>
            </div>
          </div>
        </div>
        <div class="px-3 py-2 border-t border-cyber-border shrink-0">
          <button
            :disabled="!currentPath"
            @click="emit('select', currentPath)"
            class="w-full bg-cyber-accent text-black text-xs font-bold px-3 py-1.5 transition-colors duration-150 hover:bg-cyber-accent/80 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          >{{ t('cowork.browse.select') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiFolder } from 'vue-icons-plus/hi'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [path: string] }>()

const { t } = useI18n()

interface DirEntry {
  name: string
  isDirectory: boolean
}

const currentPath = ref('')
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const error = ref(false)
const canGoUp = ref(false)
const pathStack = ref<string[]>([])

async function loadDrives() {
  loading.value = true
  error.value = false
  currentPath.value = ''
  canGoUp.value = false
  pathStack.value = []
  try {
    const res = await fetch('/api/cowork/drives')
    if (res.ok) {
      const drives = await res.json() as string[]
      entries.value = drives.map(d => ({ name: d, isDirectory: true }))
    }
  } catch { error.value = true }
  loading.value = false
}

async function loadDirectory(dirPath: string) {
  loading.value = true
  error.value = false
  try {
    const res = await fetch(`/api/cowork/browse?path=${encodeURIComponent(dirPath)}`)
    if (res.ok) {
      const data = await res.json() as { path: string; entries: DirEntry[] }
      currentPath.value = data.path
      entries.value = data.entries
    } else {
      error.value = true
    }
  } catch { error.value = true }
  loading.value = false
}

function navigate(name: string) {
  const target = currentPath.value
    ? currentPath.value.endsWith('\\') || currentPath.value.endsWith('/')
      ? currentPath.value + name
      : currentPath.value + (currentPath.value.includes('\\') ? '\\' : '/') + name
    : name
  pathStack.value.push(currentPath.value)
  canGoUp.value = true
  loadDirectory(target)
}

function goUp() {
  const prev = pathStack.value.pop()
  if (prev === '') {
    canGoUp.value = false
    loadDrives()
  } else if (prev) {
    loadDirectory(prev)
  }
}

watch(() => props.modelValue, (val) => {
  if (val) loadDrives()
})
</script>
```

- [ ] **Step 2: Verify type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DirectoryBrowser.vue
git commit -m "feat: add DirectoryBrowser component for filesystem navigation"
```

---

### Task 4: Integrate DirectoryBrowser into FilesView

**Files:**
- Modify: `frontend/src/components/FilesView.vue`

- [ ] **Step 1: Replace browse flow**

In `<script setup>`, add the import and new ref:

```ts
import DirectoryBrowser from './DirectoryBrowser.vue'

const showDirBrowser = ref(false)
```

Replace these template lines:
```html
            <input ref="projectDirInput" type="file" webkitdirectory class="hidden" @change="onProjectDirChange" />
            <button @click="browseProjectDir" :disabled="!!connectedProject || isBrowsing"
```

With:
```html
            <button @click="showDirBrowser = true" :disabled="!!connectedProject"
```

Replace the `v-if` lines for `isBrowsing` and `browseMessage` with nothing (remove them entirely):
```html
          <div v-if="isBrowsing" class="text-cyber-orange text-[10px] font-mono mt-1">⟳ {{ t('cowork.scanning') }}</div>
          <div v-if="browseMessage" class="text-cyber-orange text-[10px] font-mono mt-1">{{ browseMessage }}</div>
```
→ remove both entire lines.

Remove these variables and functions from the script:
- `projectDirInput`
- `isBrowsing`
- `browseMessage`
- `onWindowFocus()`
- `browseProjectDir()`
- `onProjectDirChange()`

Add this function:
```ts
function onDirSelected(path: string) {
  showDirBrowser.value = false
  projectPath.value = path
  toggleProject()
}
```

Update the `disabled` binding on input:
```html
<input v-model="projectPath" :disabled="!!connectedProject" placeholder="/path/to/project"
```

Update the `disabled` binding on toggle button:
```html
<button @click="toggleProject"
```

Add the DirectoryBrowser component in template (after the workspace section's closing `</div>`):

```html
        <DirectoryBrowser v-model="showDirBrowser" @select="onDirSelected" />
```

- [ ] **Step 2: Verify type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FilesView.vue
git commit -m "feat: integrate DirectoryBrowser into FilesView, remove broken webkitdirectory"
```

---

### Task 5: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

In `frontend/src/locales/vi.json`, add after existing `cowork.*` keys:

```json
  "cowork.browse.title": "Chọn thư mục dự án",
  "cowork.browse.parent": "(thư mục cha)",
  "cowork.browse.select": "Chọn thư mục này",
  "cowork.browse.loading": "Đang tải...",
  "cowork.browse.error": "Không thể truy cập thư mục này",
  "cowork.browse.empty": "Không có thư mục con",
```

Remove the `cowork.scanning` key (no longer used).

- [ ] **Step 2: Add English keys**

In `frontend/src/locales/en.json`, add after existing `cowork.*` keys:

```json
  "cowork.browse.title": "Select Project Directory",
  "cowork.browse.parent": "(parent directory)",
  "cowork.browse.select": "Select this folder",
  "cowork.browse.loading": "Loading...",
  "cowork.browse.error": "Cannot access this directory",
  "cowork.browse.empty": "No subdirectories",
```

Remove the `cowork.scanning` key (no longer used).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add i18n keys for DirectoryBrowser"
```

---

### Task 6: Update AGENTS.md

**Files:**
- Modify: `backend/src/cowork/AGENTS.md`
- Modify: `frontend/src/components/AGENTS.md`

- [ ] **Step 1: Update coworks AGENTS.md**

Add to API endpoints table:
```
| `GET` | `/api/cowork/drives` | List available drive roots |
| `GET` | `/api/cowork/browse?path=` | List subdirectories at path |
```

Add to services section:
```
- `getDrives()` — returns array of drive root paths
- `browseDirectory(path)` — returns `{ path, entries: [{name, isDirectory}] }`
```

- [ ] **Step 2: Update frontend components AGENTS.md**

Add DirectoryBrowser to the component map.

- [ ] **Step 3: Commit**

```bash
git add backend/src/cowork/AGENTS.md frontend/src/components/AGENTS.md
git commit -m "docs: update AGENTS.md with directory browser APIs and component"
```
