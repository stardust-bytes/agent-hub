# Fix `npm run setup` Migration Error — Design Spec

## Problem
`npm run setup` fails with:
```
Error: P3018 — duplicate column name: mode
```
Migration `20260611085424_add_session_mode` tries to add `mode` column to `Session` table, but column already exists in the SQLite database. `prisma migrate deploy` cannot proceed.

## Root Cause
The `mode` column was added to the schema and migration file was created, but the `_prisma_migrations` tracking table doesn't have this migration recorded. Likely caused by running `prisma migrate dev` earlier (which auto-applies) and then the DB was committed without the tracking record.

## Approach 1: Immediate Fix
Run `prisma migrate resolve --applied 20260611085424_add_session_mode` to mark the migration as already applied in `_prisma_migrations`. This tells Prisma to skip it during `migrate deploy`. Zero data loss.

## Approach 2: Future-Proof Setup Script
Replace the inline `setup` script with a Node.js script (`scripts/setup.mjs`) that:
1. Runs `prisma generate`
2. Runs `prisma migrate deploy`
3. If deploy fails, reads the failing migration SQL, checks if changes are already applied against the live SQLite schema (using `PRAGMA table_info`), and auto-resolves via `prisma migrate resolve --applied`
4. Retries `prisma migrate deploy`
5. Runs `prisma db seed`

No extra npm dependencies needed — uses built-in `child_process` module and `PRAGMA` queries via a temporary Prisma query.

## Changes
- `backend/package.json` — change `"setup"` script to call `node scripts/setup.mjs`
- `backend/scripts/setup.mjs` — new file, the setup orchestrator
- Existing data in `dev.db` preserved throughout
