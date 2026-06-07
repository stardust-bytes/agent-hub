# Backend — Agent Context

Local-First AI Agent Workspace · NestJS backend service.

## What this is

REST API server for the AI Workspace. Handles task CRUD, agent chat (Ollama ReAct loop), sessions, settings, knowledge base indexing, and health checks. Backed by SQLite via Prisma. Runs on port **3001** (internal); in production traffic comes through Nginx on port 3000.

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
├── app.module.ts            — root module
├── app.controller.ts        — GET /api/health → { status, db, timestamp }
├── http-exception.filter.ts — global filter: returns { statusCode, message, timestamp }
│
├── prisma/
│   ├── prisma.module.ts     — @Global() module, exports PrismaService
│   └── prisma.service.ts    — extends PrismaClient, onModuleInit connects
│
├── tasks/
│   ├── tasks.module.ts
│   ├── tasks.controller.ts    — CRUD endpoints under /api/tasks
│   ├── tasks.service.ts       — Prisma queries (typed, no raw SQL)
│   ├── tasks.gateway.ts       — Socket.io gateway (namespace /tasks)
│   ├── tasks.service.spec.ts, tasks.controller.spec.ts, tasks.gateway.spec.ts
│   └── dto/ (create-task.dto.ts, update-task.dto.ts)
│
├── agent/
│   ├── agent.module.ts
│   ├── agent.controller.ts    — POST /api/agent/chat (SSE streaming)
│   ├── agent.service.ts       — orchestrator: context builder + provider + persistence
│   ├── dto/ (chat.dto.ts, agent-run-state.ts, agent-action.dto.ts)
│   ├── services/ (context-builder.service.ts, llm-caller.service.ts)
│   ├── providers/ (llm-provider.interface.ts, ollama.provider.ts)
│   └── *.spec.ts
│
├── sessions/
│   ├── sessions.module.ts
│   ├── sessions.controller.ts — CRUD under /api/sessions
│   ├── sessions.service.ts    — chat history + auto-title
│   └── *.spec.ts
│
├── settings/
│   ├── settings.module.ts     — @Global()
│   ├── settings.controller.ts — GET /api/settings
│   ├── settings.service.ts    — key-value store in Setting table
│   └── *.spec.ts
│
├── knowledge/
│   ├── knowledge.module.ts
│   ├── knowledge.controller.ts — file upload + search under /api/knowledge
│   ├── knowledge.service.ts    — LanceDB vector search + file indexing
│   └── *.spec.ts
│
└── ollama/
    ├── ollama.module.ts
    ├── ollama.controller.ts   — GET /api/ollama/models
    ├── ollama.service.ts      — lists available Ollama models
    └── *.spec.ts
```

---

## API Endpoints

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health + DB check |
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `POST` | `/api/agent/chat` | Agent chat (SSE stream) |
| `GET` | `/api/sessions` | List sessions |
| `POST` | `/api/sessions` | Create session |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `GET` | `/api/sessions/:id/messages` | Get session messages |
| `GET` | `/api/ollama/models` | List Ollama models |
| `GET` | `/api/settings` | Get settings |
| `GET` | `/api/knowledge` | List knowledge files |
| `POST` | `/api/knowledge/upload` | Upload file for indexing |

**Agent chat response:** SSE stream (`text/event-stream`)
```
data: {"token":"..."}
data: {"toolCall":{"name":"...","args":{...}}}
data: {"toolResult":{"name":"...","result":"..."}}
data: {"thinking":"..."}
data: [DONE]
```

---

## Prisma Schema

```prisma
model Setting {
  key   String @id
  value String
}

model KnowledgeFile {
  id         Int      @id @default(autoincrement())
  filename   String
  filepath   String
  size       Int
  mimeType   String
  status     String   @default("indexing")
  chunkCount Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Session {
  id        Int           @id @default(autoincrement())
  title     String        @default("New Session")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
}

model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String
  content   String
  createdAt DateTime @default(now())
}

model Task {
  id          Int       @id @default(autoincrement())
  title       String
  description String?
  status      String    @default("TODO")
  priority    Int       @default(0)
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

Run: `npx prisma migrate dev --name <name>` then `npx prisma generate`.

---

## DTOs

**`CreateTaskDto`**: `title` (required), `description?`, `status?` (TODO|PROCESSING|DONE|FAILED), `priority?` (0|1|2), `dueDate?` (ISO string).

**`UpdateTaskDto`**: `PartialType(CreateTaskDto)` — all optional.

**`ChatDto`**: `message` (required), `model?` (default `llama3.2`), `sessionId` (required).

---

## Environment Variables

`.env` (git-ignored):
```
DATABASE_URL="file:../workspace_data/dev.db"
PORT=3001
OLLAMA_URL=http://localhost:11434
```

---

## Commands

```bash
# Development
npm run start:dev

# Production
npm run build && npm run start:prod

# Tests
npx jest                    # all (15 suites, 61 tests)
npx jest src/agent          # specific module

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

1. **ORM only** — all DB access through `PrismaService`. No `$queryRaw` except the health-check ping.
2. **Typed DTOs** — every POST/PATCH body must use a DTO class with `class-validator` decorators.
3. **No `any`** — TypeScript strict. Use Prisma's generated types.
4. **No comments** unless the WHY is non-obvious.
