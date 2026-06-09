# Seed Providers & Models

## Design

Add `DEFAULT_PROVIDERS` array to `backend/prisma/seed.ts` with existing data extracted from the dev database, excluding `key` fields.

## Data

- **Ollama** (`ollama`, `https://api.ollama.com`)
  - Models: `deepseek-v4-flash:cloud`, `gemma4:31b-cloud`

## Pattern

Follow the existing `DEFAULT_TOOLS` pattern — `prisma.provider.upsert` by `name`, then `prisma.providerModel.upsert` by `providerId + name`. Idempotent seed.

## Constraints

- No `key` field in seed data (user instruction)
- Provider models cascade on delete of provider
