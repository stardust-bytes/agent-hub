<h1 align="center">Agent Hub</h1>

<p align="center">
  <strong>Local-first AI Agent Workspace — open source, runs on your machine.</strong>
  <br />
  Chat with AI · Manage files · Automate tasks
  <br />
  Use Ollama, OpenAI, DeepSeek, or Google Gemini — your choice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vue_3-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/AI-Ollama-000000?logo=ollama" alt="Ollama" />
  <img src="https://img.shields.io/badge/AI-Gemini-4285F4?logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/stardust-bytes/agent-hub/main/media/screenshot-01.png" alt="Agent Hub - Chat" width="49%" />
  <img src="https://raw.githubusercontent.com/stardust-bytes/agent-hub/main/media/screenshot-02.png" alt="Agent Hub - Tasks" width="49%" />
  <br />
  <img src="https://raw.githubusercontent.com/stardust-bytes/agent-hub/main/media/screenshot-03.png" alt="Agent Hub - Providers" width="49%" />
  <img src="https://raw.githubusercontent.com/stardust-bytes/agent-hub/main/media/screenshot-04.png" alt="Agent Hub - Memory" width="49%" />
</p>

---

## Features

### AI Agent Loop

A custom state-machine ReAct loop (PLANNING → EXECUTING → EVALUATING → CORRECTING → DONE) with iteration limits and SSE streaming for real-time token-by-token responses with inline tool calls, results, and thinking indicators. Provider-agnostic — route through local Ollama, OpenAI, DeepSeek, or **Google Gemini** via the unified streaming provider interface.

**Sub-agents** can be spawned at runtime with their own profiles, system prompts, and scoped tool sets. A real-time **Sub-agent Monitor Panel** shows live logs, tool calls, and completion status for every spawned worker.

**MCP servers** plug in external tools via the Model Context Protocol — browser automation, databases, and custom APIs.

### Security & Permissions

A multi-layered safety stack built for autonomous agents:

- **Permission modes** — Default, Accept Edits, Bypass All, Don't Ask, Auto (YOLO), Plan
- **Danger pattern blocking** — Fast-path detection of interpreters, package runners, shells, network tools, destructive git operations
- **2-stage LLM safety classifier** — A secondary LLM gate evaluates dangerous tool calls before execution, with denial tracking (fail-closed after 3 consecutive or 20 total denials)
- **Per-tool approval** — Require manual confirmation for sensitive tools via an approval queue

### Tools Registry

Over 40 built-in tools, each with a Prisma-backed record for enable/disable toggle and per-tool configuration:

| Category | Tools |
|---|---|
| **File operations** | Read, write, list, grep, search (path-sandboxed) |
| **Office (Excel)** | Read, write, list sheets, add sheets, create charts |
| **Office (Word)** | Read, write, round-trip editing |
| **Google Gmail** | Search, read, send, draft, list labels |
| **Google Calendar** | List, create, update events, check availability |
| **Google Drive** | Search, read, list, upload, create folders |
| **Google Sheets** | Read, update, append, create, format cells, add charts |
| **GitHub** | Search repos, issue CRUD, PR listing, commits |
| **Slack** | Send messages, list channels, history, search |
| **Notion** | Search, get/create/update pages, query databases |
| **Notes** | Full markdown CRUD |
| **Planning** | Create and resume multi-step plans |
| **Skills** | Reusable capabilities via `/skill` commands |
| **Web** | Fetch URLs, web search |

### Google Connectors

Full OAuth integration with Google Workspace. Connect once via the UI, and the agent gains access to Gmail, Calendar, Drive, and Sheets. Tokens are stored in your local SQLite database — nothing leaves your machine.

### External Platform Connectors

Connect to **GitHub** (search repos, issue CRUD, PR listing, commits), **Slack** (send messages, list channels, history, search), and **Notion** (search, get/create/update pages, query databases). Each uses token-based authentication managed through the UI.

### Skills

A native skills module with slash-command access (`/skill:<name>`) lets you define reusable capabilities. Skills appear in the sidebar and in the chat input autocomplete.

### Scheduled Tasks

Cron-based recurring AI automation. A `ScheduleTask` is a named prompt that runs on a schedule (hourly, daily, weekly, or custom cron) and produces a `ScheduleTaskLog` per execution. The agent can create tasks autonomously via `create_task` and `convert_note_to_task` tools. Run any task manually on demand.

### Memory System

Long-term memory with auto-extraction. Four types — User, Feedback, Project, Reference — are automatically classified from conversations using keyword patterns when the agent is idle. Memories are injected into the LLM system prompt on every chat request, giving the agent persistent context across sessions. SHA256-based dedup prevents duplicates.

### Plans

The agent can autonomously generate multi-step execution plans from your requests. Each step has status tracking (PENDING → APPROVED → EXECUTING → DONE/INTERRUPTED). Interrupted plans can be resumed. Individual steps can be approved or rejected before execution.

### Agent Profiles

Named, reusable agent configurations — each with its own system prompt, allowed tools, and default model. Switch between profiles at chat time. Built-in profiles are protected from deletion.

### Agent Outputs

All files generated by the agent during a session are organised per session with metadata. Browse, preview, and download generated artifacts from the UI.

### Mintlify-Style UI

A clean, semantic design system with light/dark mode support. Features a grouped sidebar navigation, ⌘K command palette, status bar with live clock and sub-agent count, and seamless page headers. Built with semantic CSS token utilities — no raw colors in components. Interactive primitives use Headless UI (modal, select, switch, radio group, checkbox).

---

## Installation

### Prerequisites

- **Docker Desktop** — [download](https://www.docker.com/products/docker-desktop/)
- **Ollama** (optional, for local AI) — [ollama.ai](https://ollama.ai)

### Docker (recommended)

```bash
docker compose up --build
```

Open **http://localhost:17135**. First run auto-creates `workspace_data/` with SQLite and LanceDB.

### Development

```bash
# Backend
cd backend
npm install && npm run setup && npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install && npm run dev
```

### CLI / One-Command

**Quick start (no install needed):**
```bash
npx @stardust-bytes/agent-hub
```

This runs `agent-hub studio` — starts the server, runs first-time setup, and opens your browser. Data is stored in `./workspace_data` or `%APPDATA%/agent-hub`.

**Global install (use `agent-hub` directly):**
```bash
npm install -g @stardust-bytes/agent-hub
agent-hub studio
```

Once installed globally, you can run `agent-hub` from anywhere. Data dir is auto-detected: existing `workspace_data` in the current dir, then `%APPDATA%/agent-hub` (or `~/.agent-hub` on Linux/Mac).

### CLI Commands

| Command | Description |
|---|---|
| `agent-hub` / `agent-hub studio` | Start Studio (server + dashboard, auto-opens browser) |
| `agent-hub studio --no-browser` | Start server without opening browser |
| `agent-hub init` | One-time setup (data dir, .env, database migrations, seed) |
| `agent-hub migrate` | Apply pending database migrations only (safe update) |
| `agent-hub auto-start enable` | Register Windows auto-start (runs hidden, no cmd window) |
| `agent-hub auto-start disable` | Remove Windows auto-start |
| `agent-hub auto-start status` | Check auto-start status |
| `agent-hub --help` | Show help |

**Flags:**
| Flag | Description |
|---|---|
| `--data-dir <path>` | Override workspace data directory |
| `AGENT_HUB_DATA_DIR` | Environment variable alternative to `--data-dir` |

### Data Directory

Agent Hub auto-detects where to store data (SQLite DB, LanceDB vectors, uploads):

1. `--data-dir <path>` or `AGENT_HUB_DATA_DIR` — explicit override
2. `./workspace_data` — if it already exists (project-local mode)
3. `%APPDATA%/agent-hub` — default for global install (Windows)
4. `~/.agent-hub` — default for global install (Linux/Mac)

Run `agent-hub init` to see which data dir is being used.

### Safe Update

When upgrading to a newer version, data is preserved automatically:

```bash
npm install -g @stardust-bytes/agent-hub@latest
agent-hub migrate    # apply DB schema changes (safe, non-destructive)
agent-hub studio     # start as usual
```

`agent-hub migrate` only runs pending database migrations — it never re-inits or resets your `.env`.

### Windows Auto-Start (Hidden)

```bash
agent-hub auto-start enable
```

Registers Agent Hub in Windows Registry (`HKCU\Run`). The server starts automatically on every boot **completely hidden** — no cmd window appears. Uses PowerShell `-WindowStyle Hidden` with Base64-encoded launch script. Auto-creates `workspace_data` if it doesn't exist yet.

---

## Tech Stack

| Layer | Technology |
|---|---|---|
| Frontend | Vue 3 + TS + TailwindCSS + Vite + Pinia |
| Backend | NestJS 10 + TypeScript |
| Database | SQLite via Prisma |
| Vector DB | LanceDB |
| AI | Ollama / OpenAI / DeepSeek / Google Gemini |
| Streaming | SSE + Socket.io |
| Container | Docker Compose + Nginx |
| UI Toolkit | Headless UI + Hero Icons |

---

## Project Structure

```
├── bin/                   CLI entry point (workspace-cli.js)
├── scripts/               Build/setup orchestration
├── frontend/              Vue 3 SPA + Nginx config
├── backend/               NestJS API (modules, prisma) — port 13596
├── workspace_data/        SQLite + LanceDB + uploads (gitignored)
├── docker-compose.yml     One-command deploy (port 17135)
└── docs/                  Landing page + superpowers specs & plans
```

---

## License

MIT
