# 171305 — AI Workspace

Local-first AI Agent Workspace for developers. Chat, task management, codebase interaction, and more.

## Quick Start

### Option 1: Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:3000

### Option 2: Native (Windows)

Double-click `run.ps1` or run:

```powershell
.\run.ps1
```

Open http://localhost:17135

**Prerequisites:** Node.js 20+, Ollama (optional, for local AI)

## Configuration

Copy `backend/.env.example` to `backend/.env` and edit:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `13596` | Backend port |
| `DATABASE_URL` | `file:./workspace_data/dev.db` | SQLite database path |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama endpoint |

## Project Structure

```
├── frontend/          Vue 3 + Vite SPA (port 17135 dev / 80 Docker)
├── backend/           NestJS API server (port 13596)
├── workspace_data/    SQLite DB + uploads (persisted, gitignored)
├── docker-compose.yml Production orchestration
├── run.ps1            Windows native quick start
└── README.md
```

## Development

```bash
# Terminal 1: Backend
cd backend
npm install
npx prisma generate
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```
