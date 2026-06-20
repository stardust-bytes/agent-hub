<h1 align="center">Agent Hub</h1>

<p align="center">
  <strong>Local-first AI Agent Workspace — open source, runs on your machine.</strong>
  <br />
  Chat with AI · Manage files · Automate tasks
  <br />
  Use Ollama locally or connect to OpenAI/DeepSeek — your choice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vue_3-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/AI-Ollama-000000?logo=ollama" alt="Ollama" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT" />
</p>

---

## Features

- **AI Agent** — Real-time chat via SSE streaming, supports Ollama, OpenAI, DeepSeek
- **File Management** — Preview PDF, DOCX, XLSX, source code in the browser
- **Scheduled Tasks** — Cron-based recurring AI automation
- **Google Connectors** — Gmail, Calendar, Drive, Sheets via OAuth
- **Tools Registry** — Granular enable/disable for every AI tool
- **RAG** — Index documents and source code with LanceDB
- **Memory** — Long-term memory, auto-extracted from conversations
- **Permissions** — Per-tool approval, YOLO mode, danger blocking
- **MCP Servers** — Extend via Model Context Protocol

## Installation

### Prerequisites

- **Docker Desktop** — [download](https://www.docker.com/products/docker-desktop/)
- **Ollama** (optional) — [ollama.ai](https://ollama.ai)

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

### Windows

```powershell
.\run.ps1
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + TS + TailwindCSS + Vite |
| Backend | NestJS 10 + TypeScript |
| Database | SQLite via Prisma |
| Vector DB | LanceDB |
| AI | Ollama / OpenAI / DeepSeek |
| Container | Docker Compose + Nginx |

---

## Project Structure

```
├── frontend/              Vue 3 SPA
├── backend/               NestJS API (modules, prisma)
├── workspace_data/        SQLite + LanceDB + uploads (gitignored)
├── docker-compose.yml     One-command deploy
├── run.ps1                Windows runner
└── docs/                  Specs & plans
```

---

## License

MIT
