# providers/ — Agent Context

LLM provider management module. CRUD for AI providers (Ollama, OpenAI-compatible, Gemini, etc.) and their models. Used by the agent module for model resolution at request time.

## Responsibility

- `ProvidersController` — REST endpoints under `/api/providers`. Manages both providers and their models.
- `ProvidersService` — Prisma queries for `Provider` + `ProviderModel`. Exposes `findModelWithProvider()` for agent context resolution.

## Files

```
providers/
├── providers.module.ts
├── providers.controller.ts
├── providers.controller.spec.ts
├── providers.service.ts
├── providers.service.spec.ts
└── dto/
    ├── create-provider.dto.ts
    ├── update-provider.dto.ts
    └── create-provider-model.dto.ts
```

## API Endpoints

Base path: `/api/providers`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/providers` | List all providers with their models |
| `POST` | `/api/providers` | Create a provider |
| `PATCH` | `/api/providers/:id` | Update a provider |
| `DELETE` | `/api/providers/:id` | Delete a provider |
| `GET` | `/api/providers/models` | List all models as flat list `{ id, name, providerId, providerName }` |
| `POST` | `/api/providers/:id/models` | Add model to provider |
| `DELETE` | `/api/providers/:id/models/:modelId` | Remove model from provider |
| `POST` | `/api/providers/:id/sync-models` | Fetch + sync available models from the provider API |

## Key Patterns

- **Model resolution**: `AgentService` calls `findModelWithProvider(id)` to get baseUrl, key, and model name for LLM calls
- **Flat model list**: `GET /api/providers/models` returns denormalized list used by `ModelSelector.vue` (frontend)
- **Security**: Provider `key` field is stored in plaintext (local-first, single-user)

## Dependencies

- PrismaService (Provider + ProviderModel CRUD)

## Testing

```bash
npx jest src/providers   # 4 suites
```
