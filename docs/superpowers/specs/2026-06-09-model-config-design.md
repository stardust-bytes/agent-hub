# Model Configuration via Settings

Replace hardcoded env-var-based model selection in KnowledgeService with DB-backed settings that reference ProviderModel IDs.

## Approach

**Approach 2** (user-approved): Store `embed_model_id` and `summary_model_id` as key-value pairs in the `Setting` table. KnowledgeService reads these via SettingsService, resolves to ProviderModel + Provider for baseUrl/name/key, and falls back to env vars if unset.

## Backend Changes

### 1. Settings keys

| Key | Value | Example |
|---|---|---|
| `embed_model_id` | providerModelId (string) | `"1"` |
| `summary_model_id` | providerModelId (string) | `"2"` |

### 2. KnowledgeService modifications

Inject `SettingsService` and `ProvidersService`.

**`embed()` method — resolve model config:**
```typescript
let model = this.config.get<string>('EMBED_MODEL', 'nomic-embed-text');
let baseUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
let key: string | undefined;

const settingsId = await this.settings.get('embed_model_id', '');
if (settingsId) {
  const pm = await this.providers.findModelWithProvider(Number(settingsId));
  if (pm) {
    model = pm.name;
    baseUrl = pm.provider.baseUrl ?? baseUrl;
    key = pm.provider.key ?? undefined;
  }
}
```

**`generateSummary()` method — same pattern with `summary_model_id`.**

Fallback: if setting not found or model not in DB, use env vars as before.

### 3. SettingsService.findAll()

Currently returns `{}`. Update to query all `Setting` rows from DB.

### 4. Settings frontend page

Add two dropdowns in `SettingsView.vue`:
- "Embedding Model" — reads `GET /api/providers` for options, `GET /api/settings` for current value, `PATCH /api/settings/embed_model_id` to save
- "Summary Model" — same pattern with `summary_model_id`
- Each dropdown includes a "Default (env)" option (empty string)

## No schema changes

`Setting` table already exists. `Provider`/`ProviderModel` tables already exist. No Prisma migration needed.

## No API changes

Existing endpoints `GET /api/settings`, `PATCH /api/settings/:key`, `GET /api/providers` suffice.
