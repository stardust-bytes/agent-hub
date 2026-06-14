# README Update — Equal-Tier Provider Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `README.md` to fix the messaging contradiction between "no cloud dependency" and the actual support for OpenAI/DeepSeek cloud providers, and document the missing Google Sheets connector.

**Architecture:** Four targeted edits to `README.md` — hero tagline, badge row, Connectors list entry, and the "Local First" section rename + rewrite. No code changes, no tests required. Single file, single commit.

**Tech Stack:** Markdown, shields.io badge syntax.

**Spec:** `docs/superpowers/specs/2026-06-14-readme-update-design.md`

---

### Task 1: Update hero tagline

**Files:**
- Modify: `README.md` (lines 8–13)

- [ ] **Step 1: Replace the tagline line**

Find this exact block in `README.md`:

```html
<p align="center">
  <strong>Local-first AI workspace for Office staff — developers and power users welcome.</strong>
  <br />
  Chat with AI · Manage files · Automate tasks
  <br />
  All local — no cloud dependency.
</p>
```

Replace with:

```html
<p align="center">
  <strong>Local-first AI workspace for Office staff — developers and power users welcome.</strong>
  <br />
  Chat with AI · Manage files · Automate tasks
  <br />
  Run local with Ollama or connect to the cloud — your choice.
</p>
```

- [ ] **Step 2: Verify change visually**

Open `README.md` and confirm line 12 now reads `Run local with Ollama or connect to the cloud — your choice.`

---

### Task 2: Add OpenAI and DeepSeek badges

**Files:**
- Modify: `README.md` (badges block, lines 15–23)

- [ ] **Step 1: Insert two new badges after the Ollama badge**

Find this line in the badges `<p>` block:

```html
  <img src="https://img.shields.io/badge/AI-Ollama-000000?logo=ollama" alt="Ollama" />
```

Replace with:

```html
  <img src="https://img.shields.io/badge/AI-Ollama-000000?logo=ollama" alt="Ollama" />
  <img src="https://img.shields.io/badge/AI-OpenAI-412991?logo=openai" alt="OpenAI" />
  <img src="https://img.shields.io/badge/AI-DeepSeek-4D6BFE" alt="DeepSeek" />
```

- [ ] **Step 2: Verify badge block**

The full badge `<p>` block should now contain 9 `<img>` tags (7 original + 2 new).

---

### Task 3: Add Google Sheets to Connectors section

**Files:**
- Modify: `README.md` (Connectors bullet list, ~line 46–53)

- [ ] **Step 1: Add Google Sheets entry**

Find this block:

```markdown
### 🔌 Connectors

Connect external services via OAuth:

- **Gmail** — Search, read, send, draft emails
- **Google Calendar** — List, create, update, check availability
- **Google Drive** — Search, read, list, upload files
```

Replace with:

```markdown
### 🔌 Connectors

Connect external services via OAuth:

- **Gmail** — Search, read, send, draft emails
- **Google Calendar** — List, create, update, check availability
- **Google Drive** — Search, read, list, upload files
- **Google Sheets** — Read, update, append, create spreadsheets, format cells, add charts
```

---

### Task 4: Rename and rewrite "100% Local First" section

**Files:**
- Modify: `README.md` (~lines 105–118)

- [ ] **Step 1: Replace the entire section**

Find this block:

```markdown
## 🔒 100% Local First

Everything stays on your machine:

| Component | Data Store |
|---|---|
| **Chat History** | SQLite via Prisma |
| **Vector Index** | LanceDB (local file) |
| **AI Inference** | Ollama (localhost:11434) |
| **File Storage** | Local workspace directory |
| **Telemetry** | None — zero data leaves your machine |

No accounts, no cloud services, no data sharing. Your code and conversations never leave your network.
```

Replace with:

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

- [ ] **Step 2: Verify the old "AI Inference | Ollama" row is gone**

Confirm the first table no longer mentions "AI Inference" or "Ollama". That row moved to the second table.

---

### Task 5: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add README.md
git commit -m "docs: update README for equal-tier Ollama and cloud provider support"
```

Expected output: 1 file changed.
