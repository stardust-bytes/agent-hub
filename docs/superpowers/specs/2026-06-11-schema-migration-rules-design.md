# Schema Migration Global Rules — Design Spec

## Objective
Add a global rule set to `AGENTS.md` requiring that every database schema change preserves existing user data and includes a proper migration strategy.

## Motivation
- Current `AGENTS.md` only has a one-liner: "always run `prisma migrate dev --name <description>` for schema changes. Never edit migration files manually."
- This conflicts with real-world needs (SQLite limitations, backward compatibility, data preservation).
- No existing rule covers: column rename, drop, type change, required column addition, or testing migration against production data.

## Design Decision
Add new **Rule Set 5: Database Schema Migration** after existing Rule Set 4 in `AGENTS.md`.

## Key Rules
1. **Add column** — nullable or default only, never required on populated tables
2. **Rename** — use `--create-only` + manual SQL (`ALTER TABLE ... RENAME COLUMN`)
3. **Drop** — strictly prohibited on data-carrying columns; deprecated first
4. **Type change** — safe SQLite pattern: new table → SELECT + CAST → verify → swap
5. **Workflow** — `migrate dev` for safe changes, `--create-only` for risky ones
6. **Testing** — always test against production data copy before deploy
7. **Version control** — commit all migration files, use `migrate deploy` in prod

## Implementation Plan
Simply add the block to `AGENTS.md` between Rule Set 4 and the Commit Conventions section. No code changes needed.
