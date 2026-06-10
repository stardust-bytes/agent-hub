<p align="center">
  <img src="/logo.png" alt="171305" width="80" />
</p>

<h1 align="center">171305 — AI Workspace</h1>

<p align="center">
  <strong>Local-first, self-hosted AI agent workspace for developers.</strong>
  <br />
  Chat with AI · Manage tasks · Browse code · Automate workflows
  <br />
  All local — no cloud dependency.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vue_3-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/AI-Ollama-000000?logo=ollama" alt="Ollama" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT" />
</p>

---

## Overview

**171305** is a privacy-first AI agent workspace that runs entirely on your machine. It combines a ChatGPT-like chat interface with developer tools — file browsing, task management, code execution — powered by local AI models via Ollama or external providers like OpenAI, DeepSeek, Gemini.


### Key Features

- **💬 AI Chat** — SSE streaming chat with markdown rendering, tool calls, and plan execution
- **📋 Task Kanban** — Drag-and-drop task management with real-time WebSocket sync
- **📁 Cowork Mode** — Claude Code-inspired workspace with file tree, code preview, and AI pair programming
- **🧠 Plan & Execute** — AI autonomously plans multi-step tasks, shows progress, resumes after interruption
- **🔌 Multiple Providers** — Ollama (local), OpenAI, DeepSeek, or any OpenAI-compatible API
- **🌐 i18n** — Vietnamese + English UI
- **🔒 100% Local** — SQLite database, LanceDB vectors, no telemetry, no cloud required

---

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:17135

### Native (Windows)

```powershell
.\run.ps1
```

Open http://localhost:17135

**Prerequisites:** Node.js 20+, [Ollama](https://ollama.ai) (optional, for local AI models)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vue 3 + TypeScript + TailwindCSS + Vite |
| **Backend** | NestJS 10 + TypeScript |
| **Database** | SQLite via Prisma 5 |
| **Vector DB** | LanceDB (local file-based) |
| **AI** | Ollama / OpenAI / DeepSeek (OpenAI-compatible) |
| **Streaming** | SSE (Server-Sent Events) |
| **Real-time** | Socket.io (task sync) |
| **Auth** | None (local-first, no user system) |
| **Container** | Docker Compose + Nginx |

### Architecture

```
Browser ──► Nginx (:17135) ──► Frontend (Vue SPA)
               │
               └──► /api/* ──► Backend (NestJS :13596)
                                    │
                                    ├── SQLite (Prisma)
                                    ├── LanceDB (vectors)
                                    └── Ollama (AI)
```

---

## Configuration

Copy `backend/.env.example` → `backend/.env`:

```env
DATABASE_URL=file:./workspace_data/dev.db
PORT=13596
OLLAMA_URL=http://localhost:11434
ACTIVE_PROVIDER=ollama
EMBED_MODEL=nomic-embed-text
SUMMARY_MODEL=llama3.2
```

### LLM Providers

Add providers via the UI (Settings → Providers) or seed them manually:

| Provider | Type | Notes |
|---|---|---|
| Ollama | `ollama` | Local, requires Ollama running |
| OpenAI | `openai` | Set `baseUrl` to `https://api.openai.com/v1` |
| DeepSeek | `openai` | Set `baseUrl` to `https://api.deepseek.com/v1` |
| Any OpenAI-compatible | `openai` | Custom `baseUrl` |

---

## Project Structure

```
├── frontend/              Vue 3 SPA
│   ├── src/components/    UI components
│   ├── src/locales/       i18n (vi/en)
│   └── Dockerfile         Nginx production build
├── backend/               NestJS API
│   ├── src/               Module-based architecture
│   ├── prisma/            Schema + migrations
│   └── Dockerfile         Node production build
├── workspace_data/        SQLite + LanceDB + uploads (gitignored)
├── docker-compose.yml     One-command deploy
├── run.ps1                Windows native runner
└── docs/                  Specs, plans, design docs
```

---

## Development

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run start:dev          # http://localhost:13596

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                # http://localhost:17135
```

### Testing

```bash
cd backend
npx jest                  # 40 suites, 240+ tests
npx jest src/tools        # Tool executor tests
npx jest src/cowork       # Cowork module tests
```

---

## Screenshots

*(Add screenshots here)*

| Chat | Cowork | Tasks |
|---|---|---|
| SSE streaming chat | File tree + preview | Kanban board |

---

## Roadmap

- [x] Basic chat (Chat/Agent modes)
- [x] Task Kanban with WebSocket
- [x] Cowork mode (file tree + code preview)
- [x] Auto-plan with create_plan tool
- [x] Plan step execution with stop/resume
- [x] Multiple AI provider support
- [ ] Knowledge base RAG (file upload + semantic search)
- [ ] MCP tool integration
- [ ] Dark/light theme toggle
- [ ] Linux/macOS native scripts

---

## License

MIT
