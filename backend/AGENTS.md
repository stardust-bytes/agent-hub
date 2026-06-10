# Backend — Agent Context

Local-First AI Agent Workspace · NestJS backend service.

## What this is

REST API server for the AI Workspace. Handles task CRUD, agent chat (Ollama ReAct loop), sessions, settings, LLM provider management, knowledge base indexing, and health checks. Backed by SQLite via Prisma. Runs on port **130596** (internal); in production traffic comes through Nginx on port 3000.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| ORM | Prisma 5 (schema-first) |
| Database | SQLite — file at `./workspace_data/dev.db` |
| Validation | `class-validator` + `class-transformer` via `ValidationPipe` |
| Config | `@nestjs/config` — reads `.env` |
| Vector DB | LanceDB (local file at `./workspace_data/lancedb`) |
| Port | `process.env.PORT ?? 130596` |

---

## Module Map

```
src/
├── main.ts                  — bootstrap, global prefix /api, CORS, ValidationPipe, HttpExceptionFilter
├── app.module.ts            — root module (ConfigModule, PrismaModule, TasksModule, NotesModule,
│                              AgentModule, SettingsModule, KnowledgeModule, SessionsModule,
│                              ProvidersModule, ToolsModule, PlansModule)
├── app.controller.ts        — GET /api/health → { status, db, timestamp }
├── http-exception.filter.ts — global filter: returns { statusCode, message, timestamp }
│
├── prisma/
│   ├── prisma.module.ts     — @Global() module, exports PrismaService
│   └── prisma.service.ts    — extends PrismaClient, onModuleInit connects
│
├── providers/
│   ├── providers.module.ts
│   ├── providers.controller.ts — CRUD under /api/providers + model management
│   ├── providers.service.ts    — Prisma queries for Provider + ProviderModel
│   ├── dto/ (create-provider.dto.ts, update-provider.dto.ts, create-provider-model.dto.ts)
│   └── *.spec.ts
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
│   ├── agent.service.ts       — thin orchestrator: context builder + AgentLoopService + persistence
│   ├── dto/ (chat.dto.ts, agent-run-state.ts, agent-action.dto.ts, agent-state.enum.ts)
│   ├── services/ (agent-loop.service.ts, llm-controller.service.ts, context-builder.service.ts)
│   ├── providers/ (llm-provider.interface.ts, ollama.provider.ts)
│   └── *.spec.ts
│
├── plans/
│   ├── plans.module.ts
│   ├── plans.controller.ts     — REST endpoints under /api/plans
│   ├── plans.service.ts        — CRUD for Plan + PlanStep tables
│   └── *.spec.ts
│
├── sessions/
│   ├── sessions.module.ts
│   ├── sessions.controller.ts — CRUD under /api/sessions
│   ├── sessions.service.ts    — chat history + auto-title
│   └── *.spec.ts
│
├── cowork/
│   ├── cowork.controller.ts      — REST endpoints under /api/cowork
│   ├── cowork.controller.spec.ts — 3 tests (setProject, getProject, clearProject)
│   ├── cowork.service.ts         — project directory management via SettingsService
│   ├── cowork.service.spec.ts    — 5 tests (setProject, getProject, clearProject, getStatus)
│   └── dto/
│       └── set-project.dto.ts    — validated path input
│
├── settings/
│   ├── settings.module.ts     — @Global()
│   ├── settings.controller.ts — GET /api/settings, PATCH /api/settings/:key
│   ├── settings.service.ts    — key-value store in Setting table (get, set, delete, upsert, findAll)
│   └── *.spec.ts
│
└── knowledge/
    ├── knowledge.module.ts
    ├── knowledge.controller.ts — file upload + search + delete under /api/knowledge
    ├── knowledge.service.ts    — LanceDB vector search + file indexing (text/docx/pdf)
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
| `GET` | `/api/providers` | List all providers with models |
| `POST` | `/api/providers` | Create provider |
| `PATCH` | `/api/providers/:id` | Update provider |
| `DELETE` | `/api/providers/:id` | Delete provider |
| `GET` | `/api/providers/models` | List all models as flat list |
| `POST` | `/api/providers/:id/models` | Add model to provider |
| `DELETE` | `/api/providers/:id/models/:modelId` | Remove model from provider |
| `GET` | `/api/settings` | Get all settings |
| `PATCH` | `/api/settings/:key` | Update setting |
| `POST` | `/api/cowork/project` | Set project path |
| `GET` | `/api/cowork/project` | Get current project status |
| `DELETE` | `/api/cowork/project` | Clear current project |
| `GET` | `/api/knowledge` | List knowledge files |
| `POST` | `/api/knowledge/upload` | Upload file for indexing |
| `POST` | `/api/knowledge/search` | Search indexed files |
| `DELETE` | `/api/knowledge/:id` | Delete file |

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
  toolName  String?
  isResult  Boolean  @default(false)
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

model Provider {
  id        Int             @id @default(autoincrement())
  name      String
  type      String          @default("ollama")
  baseUrl   String?
  key       String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  models    ProviderModel[]
}

model ProviderModel {
  id         Int      @id @default(autoincrement())
  providerId Int
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime @default(now())
}
```

Run: `npx prisma migrate dev --name <name>` then `npx prisma generate`.

---

## DTOs

**`CreateTaskDto`**: `title` (required), `description?`, `status?` (TODO|PROCESSING|DONE|FAILED), `priority?` (0|1|2), `dueDate?` (ISO string).

**`UpdateTaskDto`**: `PartialType(CreateTaskDto)` — all optional.

**`ChatDto`**: `message` (required), `providerModelId` (required, Int), `sessionId` (required, Int), `mode?` (optional, 'agent' | 'chat').

**`CreateProviderDto`**: `name` (required), `type?` (default 'ollama'), `baseUrl?`, `key?`.

**`UpdateProviderDto`**: `PartialType(CreateProviderDto)`.

**`SetProjectDto`**: `path` (required, string).

---

## Environment Variables

`.env` (git-ignored):
```
DATABASE_URL="file:../workspace_data/dev.db"
PORT=130596
OLLAMA_URL=http://localhost:11434
UPLOAD_DIR=./workspace_data/uploads
EMBED_MODEL=nomic-embed-text
```

---

## Commands

```bash
# Development
npm run start:dev

# Production
npm run build && npm run start:prod

# Tests
npx jest                    # all (15+ suites)
npx jest src/agent          # specific module

# Prisma
npx prisma studio           # GUI for SQLite
npx prisma migrate dev      # apply schema changes
npx prisma generate         # regenerate client after schema edit
```

---

## CORS Policy

Allowed origins (hardcoded in `main.ts`):
- `http://localhost:171305` — Vite dev server
- `http://localhost:3000` — Nginx production

Never add `origin: '*'`.

---

## Coding Rules

1. **ORM only** — all DB access through `PrismaService`. No `$queryRaw` except the health-check ping.
2. **Typed DTOs** — every POST/PATCH body must use a DTO class with `class-validator` decorators.
3. **No `any`** — TypeScript strict. Use Prisma's generated types.
4. **No comments** unless the WHY is non-obvious.
