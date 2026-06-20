# usage/ — Agent Context

Token usage tracking module. Records LLM token consumption per request and aggregates totals + per-session breakdowns. `@Global()` so any module can inject `UsageService` to record usage.

## Responsibility

- `UsageController` — REST endpoints under `/api/usage`.
- `UsageService` — writes `UsageRecord` rows and aggregates them via Prisma (`aggregate`, `groupBy`). Exported globally.

## Files

```
usage/
├── usage.module.ts            — @Global(), provides + exports UsageService
├── usage.controller.ts
├── usage.controller.spec.ts
├── usage.service.ts
├── usage.service.spec.ts
└── dto/
    └── create-usage.dto.ts
```

## API Endpoints

Base path: `/api/usage`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/usage` | Total token usage `{ promptTokens, completionTokens, totalTokens, requestCount }` |
| `GET` | `/api/usage/sessions` | Per-session + per-model token breakdown |

## Service Methods

- `record(dto)` — create a `UsageRecord`.
- `getTotal()` — summed prompt/completion/total tokens + request count.
- `getPerSession()` — grouped by `sessionId` + `modelName`, joined to session titles.

## DTOs

**`CreateUsageDto`**: `sessionId?` (Int), `modelName` (required), `providerType` (required), `promptTokens` (required, ≥0), `completionTokens` (required, ≥0), `totalTokens` (required, ≥0).

## Dependencies

- PrismaService (UsageRecord aggregation; joins Session for titles)

## Testing

```bash
npx jest src/usage     # controller + service unit tests
```
