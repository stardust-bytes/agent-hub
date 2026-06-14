# README Update Design — Equal-Tier Provider Messaging

**Date:** 2026-06-14
**Scope:** README.md at repo root

---

## Problem

The current README contains a messaging contradiction:

- Tagline says: *"All local — no cloud dependency."*
- Tech Stack table lists: `Ollama / OpenAI / DeepSeek (OpenAI-compatible)`
- Configuration section shows OpenAI and DeepSeek as supported providers

This misleads users who want to use cloud AI providers and understates the product's flexibility.

---

## Goal

Position Ollama (local) and cloud providers (OpenAI, DeepSeek, OpenAI-compatible) as equal-tier options. Keep the emphasis that **data storage is always local** — only AI inference is flexible.

Also document Google Sheets connector, which is implemented but missing from the README.

---

## Changes

### 1. Hero Tagline

**Before:**
```
All local — no cloud dependency.
```

**After:**
```
Run local with Ollama or connect to the cloud — your choice.
```

### 2. Badges

Add two badges after the existing Ollama badge:

```
[OpenAI] [DeepSeek]
```

Shields.io format:
- `https://img.shields.io/badge/AI-OpenAI-412991?logo=openai`
- `https://img.shields.io/badge/AI-DeepSeek-4D6BFE`

Keep all existing badges unchanged, including `Local_First-Privacy_First` (still accurate: data storage is local).

### 3. Connectors Section

Add Google Sheets to the connector list:

```markdown
- **Google Sheets** — Read, update, append, create spreadsheets, format cells, add charts
```

### 4. "100% Local First" Section

**Rename:** `🔒 100% Local First` → `🔒 Your Data, Your Choice`

**Rewrite body:** Split into two tables — one for data storage (always local), one for AI inference (user's choice).

Remove the line: *"No accounts, no cloud services, no data sharing."* — no longer accurate when using cloud providers.

**New content:**

```markdown
## 🔒 Your Data, Your Choice

Your files, chat history, and documents never leave your machine:

| Component | Data Store |
|---|---|
| **Chat History** | SQLite via Prisma |
| **Vector Index** | LanceDB (local file) |
| **File Storage** | Local workspace directory |
| **Telemetry** | None — zero data leaves your machine |

AI inference runs wherever you prefer:

| Provider | Where It Runs |
|---|---|
| **Ollama** | Fully local — your GPU, your data |
| **OpenAI** | Cloud — requires API key |
| **DeepSeek** | Cloud — requires API key |
| **Any OpenAI-compatible API** | Local or cloud — custom `baseUrl` |
```

---

## What Does NOT Change

- Project structure section
- Quick Start section
- Tech Stack table (already accurate)
- Configuration section (already shows cloud providers)
- All other "What's Inside" sections
- License

---

## Success Criteria

- No contradiction between tagline and feature list
- A new user reading the README understands: data is always local, AI inference is flexible
- Google Sheets connector is documented
- Cloud providers are visually represented in badges
