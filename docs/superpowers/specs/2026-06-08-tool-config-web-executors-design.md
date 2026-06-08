# Tool Config System & Web Executors — Design Spec

## Overview

Add per-tool configuration storage (API keys, credentials) and implement web_fetch + web_search executors.

## 1. Tool Model Changes

Add to `backend/prisma/schema.prisma`:
```prisma
model Tool {
  name         String   @id
  description  String
  parameters   String
  configSchema String?  // JSON Schema defining required config fields
  config       String?  // JSON string of user-provided config values
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Migration: `npx prisma migrate dev --name add_tool_config`

Seed update: add `configSchema` to `web_fetch` and `web_search` in `DEFAULT_TOOLS`.

## 2. ToolsService — new methods

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

## 3. New endpoint

`PATCH /api/tools/:name/config` — body: `{ config: {...} }`
Updates tool config. Returns updated tool.

## 4. web_fetch executor

**Config schema:** none (basic HTTP GET with no auth needed)

**Behavior:** Fetch URL content, return as text (with truncation for large responses).

```ts
@Injectable()
export class WebFetchExecutor implements ToolExecutor {
  readonly name = 'web_fetch'

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const text = await res.text()
    return text.length > 5000 ? text.slice(0, 5000) + '\n...(truncated)' : text
  }
}
```

## 5. web_search executor

**Config schema:**
```json
{
  "type": "object",
  "properties": {
    "apiKey": { "type": "string", "title": "API Key", "format": "password" },
    "provider": { "type": "string", "title": "Provider", "enum": ["google", "bing"], "default": "google" },
    "cx": { "type": "string", "title": "Google CSE ID" }
  },
  "required": ["apiKey"]
}
```

**Behavior:** Search via Google Custom Search API, return top results as formatted text.

```ts
@Injectable()
export class WebSearchExecutor implements ToolExecutor {
  readonly name = 'web_search'

  constructor(private readonly toolsService: ToolsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const tool = await this.toolsService.findByName('web_search')
    const config = JSON.parse(tool.config || '{}')
    const query = args.query as string

    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${config.apiKey}&cx=${config.cx || ''}`
    const res = await fetch(url)
    const data = await res.json() as { items?: Array<{ title: string; link: string; snippet: string }> }
    if (!data.items?.length) return 'No search results found.'

    return data.items.map((item, i) =>
      `${i + 1}. ${item.title}\n   ${item.link}\n   ${item.snippet}`
    ).join('\n\n')
  }
}
```

## 6. Tool Config UI

ToolsView.vue update:
- Each tool row: add "Config" button if `configSchema` is not null
- Click opens `ToolConfigModal.vue` (new component)
- Modal renders fields dynamically from `configSchema`:
  - `type: "string"` → `<input>`
  - `format: "password"` → `<input type="password">`
  - `enum: [...]` → `<select>`
- Save → `PATCH /api/tools/:name/config`

## Files Changed

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `configSchema`, `config` to Tool |
| `backend/prisma/seed.ts` | Update DEFAULT_TOOLS with configSchema |
| `backend/src/tools/tools.service.ts` | Add `findByName`, `updateConfig` |
| `backend/src/tools/tools.controller.ts` | Add `PATCH /:name/config` |
| `backend/src/tools/tools.module.ts` | Register new executors |
| `backend/src/tools/executors/web-fetch.executor.ts` | New |
| `backend/src/tools/executors/web-search.executor.ts` | New |
| `frontend/src/components/ToolsView.vue` | Add Config button per tool |
| `frontend/src/components/ToolConfigModal.vue` | New — dynamic form from configSchema |
| `frontend/src/locales/*.json` | i18n keys for config |
