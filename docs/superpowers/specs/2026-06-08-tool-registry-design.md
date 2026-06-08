# Tool Registry & Tools View — Design Spec (Phase 1)

## Overview

Extract tool management from the agent module into a standalone feature. Add a Prisma `Tool` model for persistence, a REST API for tool CRUD, and a frontend page to view/toggle tools.

## Backend

### 1. Prisma Model

Add to `backend/prisma/schema.prisma`:
```prisma
model Tool {
  name        String   @id
  description String
  parameters  String   // JSON string of the parameters schema
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 2. Tool Module

New module at `backend/src/tools/`:
- `tools.module.ts` — registers ToolsService + ToolsController
- `tools.service.ts` — CRUD: `findAll()`, `toggle(name)`
- `tools.controller.ts` — `GET /api/tools`, `PATCH /api/tools/:name/toggle`
- `seed.ts` — seed default tools on app init

### 3. Seed on startup

On `ToolsModule.onModuleInit()`, upsert all known tool definitions:
- create_task, update_task, list_tasks, get_task, delete_tasks, search_knowledge
- web_fetch (disabled by default, placeholder for Phase 2)
- web_search (disabled by default, placeholder for Phase 2)

### 4. Context Builder Integration

`context-builder.service.ts`:
- Inject `ToolsService`
- `getDefaultTools()` → `getEnabledTools()` — fetch only enabled tools from DB
- Fallback to hardcoded list if DB not seeded yet

## Frontend

### 1. ToolsView.vue (new)

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        ⚡ {{ t('tools.header') }}
      </span>
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <table class="w-full border-collapse font-mono text-sm">
        <thead>
          <tr class="border-b border-cyber-code-border text-cyber-muted">
            <th class="text-left py-2 px-2">Status</th>
            <th class="text-left py-2 px-2">Tool</th>
            <th class="text-left py-2 px-2">Description</th>
            <th class="text-right py-2 px-2">Toggle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tool in tools" :key="tool.name" class="border-b border-cyber-code-border/50">
            <td class="py-2 px-2">
              <span :class="tool.enabled ? 'text-cyber-green' : 'text-cyber-muted'">
                {{ tool.enabled ? '● ON' : '○ OFF' }}
              </span>
            </td>
            <td class="py-2 px-2 text-cyber-text">{{ tool.name }}</td>
            <td class="py-2 px-2 text-cyber-muted">{{ tool.description }}</td>
            <td class="py-2 px-2 text-right">
              <button @click="toggle(tool.name)" :class="tool.enabled ? 'text-cyber-orange' : 'text-cyber-accent'"
                class="text-sm font-mono transition-colors duration-150">
                {{ tool.enabled ? 'Disable' : 'Enable' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

### 2. AppShell Integration

- Add `'tools'` to `activeView` type
- Sidebar: add Tools icon button
- i18n keys: `nav.tools`, `tools.header`

## Files Changed

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `Tool` model |
| `backend/src/tools/` (new) | Module, service, controller |
| `backend/src/app.module.ts` | Import ToolsModule |
| `backend/src/agent/services/context-builder.service.ts` | Inject ToolsService, filter enabled |
| `frontend/src/components/ToolsView.vue` | New component |
| `frontend/src/components/AppShell.vue` | Add tools view + nav |
| `frontend/src/locales/vi.json` | `nav.tools`, `tools.header` |
| `frontend/src/locales/en.json` | `nav.tools`, `tools.header` |

## Migration

Run: `npx prisma migrate dev --name add_tools`
Run: `npx prisma generate`
