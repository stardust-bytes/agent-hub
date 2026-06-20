# settings/ — Agent Context

Global key-value settings store. Uses the `Setting` SQLite table. `@Global()` module — injectable everywhere without importing.

## Responsibility

- `SettingsController` — REST endpoints under `/api/settings`.
- `SettingsService` — key-value `findAll()`, `get(key, fallback)`, `set(key, value)`, `upsert(key, value)`, `delete(key)`. Used by KnowledgeService for embed/summary model configuration and by CoworkService for the active project path, among others.

## Files

```
settings/
├── settings.module.ts     — @Global()
├── settings.controller.ts
├── settings.controller.spec.ts
├── settings.service.ts
├── settings.service.spec.ts
```

## API Endpoints

Base path: `/api/settings`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/settings` | Get all settings as key-value map |
| `PATCH` | `/api/settings/:key` | Upsert a setting value (`{ value: string }`) |

## Key Patterns

- **Global module**: Marked `@Global()` so any service can inject `SettingsService` without importing `SettingsModule`
- **Type safety**: Returns `Record<string, string>`. Consumers parse values as needed.
- **Used by**: KnowledgeService (embed_model_id, summary_model_id), can be extended for any runtime config

## Dependencies

- PrismaService (Setting CRUD)

## Testing

```bash
npx jest src/settings    # 2 suites
```
