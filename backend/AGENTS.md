# Backend — Agent Context

Local-First AI Agent Workspace · NestJS backend service.

## What this is

REST API server for the AI Workspace. Handles task CRUD, agent stub chat, and health checks. Backed by SQLite via Prisma. Runs on port **3001** (internal); in production traffic comes through Nginx on port 3000.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| ORM | Prisma 5 (schema-first) |
| Database | SQLite — file at `./workspace_data/dev.db` |
| Validation | `class-validator` + `class-transformer` via `ValidationPipe` |
| Config | `@nestjs/config` — reads `.env` |
| Port | `process.env.PORT ?? 3001` |

---

## Module Map

```
src/
├── main.ts                  — bootstrap, global prefix /api, CORS, ValidationPipe, HttpExceptionFilter
├── app.module.ts            — root module: imports PrismaModule, TasksModule, AgentModule
├── app.controller.ts        — GET /api/health → { status, db, timestamp }
├── http-exception.filter.ts — global filter: returns { statusCode, message, timestamp }
│
├── prisma/
│   ├── prisma.module.ts     — @Global() module, exports PrismaService
│   └── prisma.service.ts    — extends PrismaClient, onModuleInit connects
│
├── tasks/
│   ├── tasks.module.ts
│   ├── tasks.controller.ts  — CRUD endpoints under /api/tasks
│   ├── tasks.service.ts     — Prisma queries (typed, no raw SQL)
│   ├── tasks.service.spec.ts
│   ├── tasks.controller.spec.ts
│   └── dto/
│       ├── create-task.dto.ts
│       └── update-task.dto.ts
│
└── agent/
    ├── agent.module.ts
    ├── agent.controller.ts  — POST /api/agent/chat
    ├── agent.service.ts     — mockReply() stub (real Ollama in Phase 2)
    ├── agent.service.spec.ts
    └── agent.controller.spec.ts
```

---

## API Endpoints

All routes are prefixed with `/api`.

| Method | Path | Description | Body |
|---|---|---|---|
| `GET` | `/api/health` | Health + DB check | — |
| `GET` | `/api/tasks` | List all tasks | — |
| `POST` | `/api/tasks` | Create task | `CreateTaskDto` |
| `PATCH` | `/api/tasks/:id` | Update task | `UpdateTaskDto` |
| `DELETE` | `/api/tasks/:id` | Delete task | — |
| `POST` | `/api/agent/chat` | Stub chat reply | `{ message: string }` |

**Health response:**
```json
{ "status": "ok", "db": "connected", "timestamp": "2026-06-07T..." }
```

**Agent chat response:**
```json
{ "reply": "...", "timestamp": "2026-06-07T..." }
```

---

## Prisma Schema

```prisma
model Task {
  id          Int       @id @default(autoincrement())
  title       String
  description String?
  status      String    @default("TODO")   // TODO | PROCESSING | DONE | FAILED
  priority    Int       @default(0)
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Run migrations:**
```bash
npx prisma migrate dev --name <name>
npx prisma generate
```

---

## DTOs

**`CreateTaskDto`** (all optional except title):
```ts
title: string
description?: string
status?: 'TODO' | 'PROCESSING' | 'DONE' | 'FAILED'
priority?: number
dueDate?: string  // ISO date string
```

**`UpdateTaskDto`** — same fields as CreateTaskDto, all optional (uses PartialType).

---

## Environment Variables

`.env` (git-ignored):
```
DATABASE_URL="file:../workspace_data/dev.db"
PORT=3001
```

`.env.example` — committed reference.

---

## Commands

```bash
# Development (hot reload)
npm run start:dev

# Production build
npm run build && npm run start:prod

# Tests
npx jest                    # all
npx jest --watch            # watch mode
npx jest src/tasks          # specific module

# Prisma
npx prisma studio           # GUI for SQLite
npx prisma migrate dev      # apply schema changes
npx prisma generate         # regenerate client after schema edit
```

---

## CORS Policy

Allowed origins (hardcoded in `main.ts`):
- `http://localhost:5173` — Vite dev server
- `http://localhost:3000` — Nginx production

Never add `origin: '*'`.

---

## Coding Rules

1. **ORM only** — all DB access through `PrismaService`. No `$queryRaw` except the health-check ping (`SELECT 1`).
2. **Typed DTOs** — every POST/PATCH body must use a DTO class with `class-validator` decorators.
3. **No `any`** — TypeScript strict. Use Prisma's generated types (`Prisma.TaskCreateInput`, etc.).
4. **TDD** — write the failing test first, then implement. Run `npx jest` before committing.
5. **No comments** unless the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant).

---

## Upcoming Phases (context for what NOT to break)

| Phase | Feature | Backend impact |
|---|---|---|
| 2 | Ollama integration | `AgentService` gains real SSE streaming, replaces `mockReply()` |
| 3 | Kanban (Socket.io) | Add `@nestjs/websockets`, Task status transitions via WS events |
| 4 | Settings panel | New `SettingsModule`, key-value store in SQLite |
| 5 | RAG / LanceDB | New `RagModule`, vector store alongside SQLite |
| 6 | Agent tool calls | AgentService orchestrates multi-step tool execution |
