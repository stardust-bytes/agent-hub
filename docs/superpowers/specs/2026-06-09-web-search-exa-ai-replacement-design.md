# Replace Google CSE with Exa AI for web_search — Design Spec

## Overview

Replace the current Google Custom Search API implementation in `web_search` executor with Exa AI (exa.ai). The Google CSE API key, provider selector, and CSE ID fields are replaced by a single Exa AI API key field in the tool config.

## 1. Config Schema Change (`seed.ts`)

Remove `provider` enum and `cx` field. Keep only `apiKey` with updated label.

**Before:**
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

**After:**
```json
{
  "type": "object",
  "properties": {
    "apiKey": { "type": "string", "title": "Exa AI API Key", "format": "password" }
  },
  "required": ["apiKey"]
}
```

## 2. Executor Logic Change (`web-search.executor.ts`)

Replace the Google CSE API call with Exa AI's search endpoint.

**Before (Google CSE):**
- Method: GET
- URL: `https://www.googleapis.com/customsearch/v1?q={query}&key={apiKey}&cx={cx}`
- Parse: `data.items[]` → `{ title, link, snippet }`
- Auth: query param `key`

**After (Exa AI):**
- Method: POST
- URL: `https://api.exa.ai/search`
- Headers: `x-api-key: {apiKey}`, `Content-Type: application/json`
- Body: `{ query, numResults: 10, contents: { highlights: true } }`
- Parse: `data.results[]` → `{ title, url, publishedDate, highlights[] }`
- Auth: header `x-api-key`

**Output format change:** If `publishedDate` is present, include it in the result line.

## 3. Files Changed

| File | Change |
|------|--------|
| `backend/prisma/seed.ts` | Remove `provider` and `cx` from `web_search` configSchema, relabel `apiKey` to "Exa AI API Key" |
| `backend/src/tools/executors/web-search.executor.ts` | Replace Google CSE fetch with Exa AI POST; update response parsing |
| `backend/AGENTS.md` | No change needed (no new modules/endpoints) |

No test changes needed: `agent-loop.service.spec.ts` mocks `WebSearchExecutor` entirely.
No frontend changes needed: `ToolConfigModal.vue` dynamically renders from configSchema.
No module/registration changes needed: executor class name, registration, and interface are unchanged.
