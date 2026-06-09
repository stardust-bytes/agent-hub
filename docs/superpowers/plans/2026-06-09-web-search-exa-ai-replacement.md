# web_search Exa AI Replacement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google Custom Search API in web_search executor with Exa AI API.

**Architecture:** Simple in-place replacement — executor class stays the same (`WebSearchExecutor`, `name = 'web_search'`), only the HTTP call and config schema change. No new files, no module/registration changes.

**Tech Stack:** NestJS (TypeScript), Prisma (seed), Exa AI REST API (POST `https://api.exa.ai/search`)

---

### Task 1: Update seed config schema

**Files:**
- Modify: `backend/prisma/seed.ts:13-14`

- [ ] **Step 1: Change the configSchema for web_search**

Current:
```ts
{ name: 'web_search', description: 'Search the web for information',
  parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}',
  enabled: false,
  configSchema: '{"type":"object","properties":{"apiKey":{"type":"string","title":"API Key","format":"password"},"provider":{"type":"string","title":"Provider","enum":["google","bing"],"default":"google"},"cx":{"type":"string","title":"Google CSE ID"}},"required":["apiKey"]}' },
```

Replace with:
```ts
{ name: 'web_search', description: 'Search the web for information',
  parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}',
  enabled: false,
  configSchema: '{"type":"object","properties":{"apiKey":{"type":"string","title":"Exa AI API Key","format":"password"}},"required":["apiKey"]}' },
```

- [ ] **Step 2: Verify the seed file is syntactically valid**

Run: `npx tsc --noEmit backend/prisma/seed.ts`
Expected: no errors (or skip if tsconfig doesn't cover this file — this file uses `ts-node` at runtime)

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: update web_search seed configSchema for Exa AI"
```

---

### Task 2: Rewrite web-search executor

**Files:**
- Modify: `backend/src/tools/executors/web-search.executor.ts` (entire file)

- [ ] **Step 1: Replace executor implementation**

Current file content (41 lines):
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
      const params = new URLSearchParams({ q: query, key: config.apiKey });
      if (config.cx) params.set('cx', config.cx);
      const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`; console.log('Web search URL:', url);
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        return `Search API error (HTTP ${res.status}): ${text.slice(0, 300)}`;
      }
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

Replace with:
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
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
          query,
          numResults: 10,
          contents: { highlights: true },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return `Search API error (HTTP ${res.status}): ${text.slice(0, 300)}`;
      }
      const data = await res.json() as {
        results?: Array<{ title: string; url: string; publishedDate?: string; highlights?: string[] }>;
      };
      if (!data.results?.length) return 'No search results found.';

      return data.results.map((item, i) => {
        const date = item.publishedDate
          ? `\n   Published: ${new Date(item.publishedDate).toLocaleDateString('vi-VN')}`
          : '';
        const highlights = item.highlights?.length
          ? `\n   ${item.highlights[0]}`
          : '';
        return `${i + 1}. ${item.title}\n   ${item.url}${date}${highlights}`;
      }).join('\n\n');
    } catch (e) {
      return `Search error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit` (from `backend/`)
Expected: no errors

- [ ] **Step 3: Verify existing tests still pass**

Run: `npx jest src/agent/services/agent-loop.service.spec.ts`
Expected: all tests pass (they mock `WebSearchExecutor` entirely)

- [ ] **Step 4: Commit**

```bash
git add backend/src/tools/executors/web-search.executor.ts
git commit -m "feat: replace Google CSE with Exa AI in web_search executor"
```
