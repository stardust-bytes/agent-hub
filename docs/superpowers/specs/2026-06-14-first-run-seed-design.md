# First-Run Seed Data Wiring

## Problem

Seed file (`backend/prisma/seed.ts`) exists with 28 default tools + MCP server config, but is **never called** on first run. Both CLI (`npx workspace-hub`) and Docker skip `prisma db seed`, leaving every DB table empty. User must manually configure providers before workspace is usable.

## Scope

Wire seed execution into first-run paths. Add default Ollama provider to seed data. Convert seed to JS (no ts-node dependency) so it runs in Docker production image.

## Changes

### 1. Convert `seed.ts` → `seed.cjs`

- Rewrite in CommonJS (no TypeScript, no ts-node needed)
- Keep existing logic: upsert 28 tools, clean stale tools, create MCP setting
- **Add**: seed default Ollama provider + 2 models (summary + embed) if none exists
- Provider reads `OLLAMA_URL`, `SUMMARY_MODEL`, `EMBED_MODEL` from env with fallbacks

### 2. Update `backend/package.json`

- Change `prisma.seed` from `"ts-node prisma/seed.ts"` to `"node prisma/seed.cjs"`

### 3. Wire into CLI (`bin/workspace-cli.js`)

- After `npx prisma migrate deploy` on first run (when `dev.db` is freshly created):
  ```js
  execSync('npx prisma db seed', {
    cwd: path.join(ROOT, 'backend'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });
  ```

### 4. Wire into Docker (`backend/Dockerfile`)

- Change CMD from:
  ```sh
  CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
  ```
  to:
  ```sh
  CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]
  ```

### 5. No changes needed

- `backend/scripts/setup.mjs` — already calls `npx prisma db seed`, will continue working
- `schema.prisma`, migrations, UI — untouched

## Files changed

| File | Change |
|---|---|
| `backend/prisma/seed.ts` | Delete, replace with `seed.cjs` |
| `backend/package.json` | Update `prisma.seed` path |
| `bin/workspace-cli.js` | Add seed call after migrate |
| `backend/Dockerfile` | Add seed call in CMD |
