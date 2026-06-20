# Backend — Agent Context

Local-First AI Agent Workspace · NestJS backend service.

## File

- `scripts/setup.mjs` — custom setup orchestrator: generate → deploy (with auto-resolve) → seed

## What this is

REST API server for the AI Workspace. Handles agent chat (multi-provider ReAct loop with native tool calling), notes/plans CRUD, sessions, settings, LLM provider management, knowledge base indexing, scheduled tasks, external connectors (Google), and health checks. "Tasks" are scheduled jobs (`ScheduleTask` model) exposed at `/api/schedule-tasks` and created by the agent's `create_task`/`convert_note_to_task` tools — there is no standalone `Task` model or REST tasks module. Backed by SQLite via Prisma. Runs on port **13596** (internal); in production traffic comes through Nginx on port 17135.

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
| Port | `process.env.PORT ?? 17135` (set to `13596` via `.env`/Docker) |

---

## Module Map

```
src/
├── main.ts                  — bootstrap, global prefix /api, CORS, ValidationPipe, HttpExceptionFilter
├── app.module.ts            — root module (ConfigModule, EventEmitterModule, PrismaModule, NotesModule,
│                              AgentModule, AgentOutputModule, SettingsModule, KnowledgeModule,
│                              SessionsModule, ProvidersModule, ToolsModule, PlansModule,
│                              WorkspaceModule, CoworkModule, FilesModule, ModePolicyModule, MemoryModule,
│                              ExcelModule, WordModule, UsageModule, ConnectorModule, ScheduleTasksModule)
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
├── notes/
│   ├── notes.module.ts
│   ├── notes.controller.ts    — CRUD endpoints under /api/notes
│   ├── notes.service.ts       — Prisma queries (typed, no raw SQL)
│   ├── notes.gateway.ts       — Socket.io gateway (namespace /notes)
│   └── dto/ (create-note.dto.ts, update-note.dto.ts)
│
├── tools/
│   ├── tools.module.ts
│   ├── tools.controller.ts    — GET /api/tools, PATCH /api/tools/:name/toggle, PATCH /api/tools/:name/config
│   ├── tools.service.ts       — Tool registry CRUD; returns enabled tools for context
│   └── executors/             — one class per agent tool (task/note CRUD, file ops, grep, web, plan, subagent, Google)
│
├── workspace/
│   ├── workspace.module.ts
│   ├── workspace.controller.ts    — /api/workspace/watch (start/status/stop), /api/workspace/indexer/status
│   ├── workspace.service.ts
│   ├── workspace-watcher.service.ts — chokidar file watcher
│   └── indexer.service.ts          — code chunking + embeddings into LanceDB
│
├── files/
│   ├── files.module.ts
│   └── files.controller.ts    — GET /api/files/agent/:id/download
│
├── mode-policy/
│   ├── mode-policy.module.ts      — @Global()
│   ├── mode-policy.service.ts     — filters tool set per agent mode
│   └── mode-policy.config.ts      — per-mode allow/deny tool lists
│
├── schedule-tasks/
│   ├── schedule-tasks.module.ts
│   ├── schedule-tasks.controller.ts — CRUD under /api/schedule-tasks + :id/logs, :id/run
│   ├── schedule-tasks.service.ts    — ScheduleTask + ScheduleTaskLog CRUD
│   ├── schedule-cron.service.ts     — registers cron jobs from enabled tasks
│   ├── schedule-runner.service.ts   — runs a task prompt through the agent loop
│   └── dto/ (create-schedule-task.dto.ts, update-schedule-task.dto.ts)
│
├── agent/
│   ├── agent.module.ts
│   ├── agent.controller.ts    — /api/agent/chat (SSE), approve-tool, permissions, yolo-config
│   ├── agent.service.ts       — thin orchestrator: context builder + AgentLoopService + persistence
│   ├── dto/ (chat.dto.ts, agent-run-state.ts, agent-action.dto.ts, agent-state.enum.ts,
│   │         approve-tool.dto.ts, permissions-config.ts, update-permissions.dto.ts,
│   │         yolo-config.dto.ts, execute-plan.dto.ts, write-stream.interface.ts)
│   ├── services/ (agent-loop, llm-controller, context-builder, permissions, approval-manager,
│   │              yolo-classifier, danger-patterns.config, denial-tracking)
│   ├── providers/ (llm-provider.interface.ts, ollama.provider.ts, openai.provider.ts)
│   ├── mcp/ (mcp.module.ts, mcp.service.ts, mcp-client.service.ts)
│   ├── subagent/ (subagent.service.ts)
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
├── memory/
│   ├── memory.module.ts
│   ├── memory.controller.ts    — CRUD under /api/memories + GET /api/memories/context
│   ├── memory.service.ts       — CRUD + dedup(SHA256) + context query for prompt injection
│   ├── memory.gateway.ts       — Socket.io gateway (namespace /memories)
│   ├── memory-extraction.service.ts — background auto-extraction on agent.idle event
│   ├── memory.service.spec.ts, memory.controller.spec.ts, memory.gateway.spec.ts, memory-extraction.service.spec.ts
│   └── dto/ (create-memory.dto.ts, update-memory.dto.ts, search-memory.dto.ts)
│
├── usage/
│   ├── usage.module.ts        — @Global(), provides+exports UsageService
│   ├── usage.controller.ts    — GET /api/usage, GET /api/usage/sessions
│   ├── usage.service.ts       — record(), getTotal(), getPerSession()
│   ├── dto/ (create-usage.dto.ts)
│   └── *.spec.ts
│
├── word/
│   ├── word.module.ts
│   ├── word.service.ts        — .docx read (mammoth) / write (docx lib) / edit
│   ├── word.service.spec.ts
│   └── executors/
│       ├── read-word.executor.ts   — Agent tool: read .docx → markdown
│       ├── write-word.executor.ts  — Agent tool: create .docx from markdown
│       └── edit-word.executor.ts   — Agent tool: modify existing .docx
│
├── agent-output/
│   ├── agent-output.module.ts
│   ├── agent-output.controller.ts — GET /api/agent-output, GET /api/agent-output/:filename/download
│   └── agent-output.controller.spec.ts
│
├── excel/
│   ├── excel.module.ts
│   ├── excel.service.ts        — read/write .xlsx via exceljs
│   ├── excel.service.spec.ts
│   └── executors/
│       ├── read-excel.executor.ts, write-excel.executor.ts
│       ├── list-excel-sheets.executor.ts, excel-add-sheet.executor.ts
│       └── excel-chart.executor.ts
│
├── connector/
│   ├── connector.module.ts          — CRUD + OAuth endpoints
│   ├── connector.service.ts         — Connector CRUD
│   ├── dto/
│   │   ├── upsert-connector.dto.ts
│   │   └── update-connector.dto.ts
│   └── providers/
│       └── google/
│           ├── google-oauth.service.ts       — OAuth2 URL gen, token exchange, refresh
│           ├── gmail.service.ts              — Gmail API (search/read/send/draft/labels)
│           ├── google-calendar.service.ts    — Calendar API (list/create/update/availability)
│           ├── google-drive.service.ts       — Drive API (search/read/list/upload)
│           └── google-sheets.service.ts      — Sheets API (read/update/append/create/format/chart)
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
| `POST` | `/api/agent/chat` | Agent chat (SSE stream) |
| `POST` | `/api/agent/approve-tool` | Approve/deny a pending tool call |
| `GET` | `/api/agent/permissions` | Get tool permissions config |
| `PATCH` | `/api/agent/permissions` | Update tool permissions config |
| `GET` | `/api/agent/yolo-config` | Get YOLO classifier config |
| `PATCH` | `/api/agent/yolo-config` | Update YOLO classifier config |
| `GET` | `/api/sessions` | List sessions |
| `POST` | `/api/sessions` | Create session |
| `DELETE` | `/api/sessions` | Delete all sessions |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `GET` | `/api/sessions/:id/messages` | Get session messages |
| `GET` | `/api/notes` | List notes |
| `POST` | `/api/notes` | Create note |
| `PATCH` | `/api/notes/:id` | Update note |
| `DELETE` | `/api/notes/:id` | Delete note |
| `GET` | `/api/plans/session/:sessionId` | List plans for a session |
| `GET` | `/api/plans/session/:sessionId/next` | Get next pending plan |
| `GET` | `/api/plans/:id` | Get plan with steps |
| `POST` | `/api/plans/:id/approve` | Approve a plan |
| `POST` | `/api/plans/:id/reject` | Reject a plan |
| `GET` | `/api/tools` | List tools (registry) |
| `PATCH` | `/api/tools/:name/toggle` | Toggle tool enabled/disabled |
| `PATCH` | `/api/tools/:name/config` | Update tool config |
| `GET` | `/api/providers` | List all providers with models |
| `POST` | `/api/providers` | Create provider |
| `PATCH` | `/api/providers/:id` | Update provider |
| `DELETE` | `/api/providers/:id` | Delete provider |
| `GET` | `/api/providers/models` | List all models as flat list |
| `POST` | `/api/providers/:id/models` | Add model to provider |
| `DELETE` | `/api/providers/:id/models/:modelId` | Remove model from provider |
| `POST` | `/api/providers/:id/sync-models` | Sync models from provider API |
| `GET` | `/api/settings` | Get all settings |
| `PATCH` | `/api/settings/:key` | Update setting |
| `POST` | `/api/cowork/project` | Set active project path |
| `GET` | `/api/cowork/project` | Get current project status |
| `DELETE` | `/api/cowork/project` | Clear current project |
| `GET` | `/api/cowork/projects` | List saved projects |
| `POST` | `/api/cowork/projects` | Add a project |
| `DELETE` | `/api/cowork/projects/:id` | Remove a saved project |
| `GET` | `/api/cowork/drives` | List available drives/roots |
| `GET` | `/api/cowork/browse` | Browse a directory |
| `GET` | `/api/cowork/read-file` | Read a file under the project |
| `GET` | `/api/memories` | List memories (filter by type, search, session) |
| `POST` | `/api/memories` | Create memory |
| `PATCH` | `/api/memories/:id` | Update memory |
| `DELETE` | `/api/memories/:id` | Delete memory |
| `GET` | `/api/memories/context` | Get memories for agent prompt injection |
| `GET` | `/api/knowledge` | List knowledge files |
| `POST` | `/api/knowledge/upload` | Upload file for indexing |
| `POST` | `/api/knowledge/search` | Search indexed files |
| `POST` | `/api/knowledge/reindex` | Reindex all knowledge files |
| `DELETE` | `/api/knowledge/:id` | Delete file |
| `POST` | `/api/workspace/watch` | Start watching a codebase directory |
| `GET` | `/api/workspace/watch/status` | Get watcher status |
| `DELETE` | `/api/workspace/watch` | Stop watching |
| `GET` | `/api/workspace/indexer/status` | Get indexer progress |
| `GET` | `/api/connectors` | List connector accounts |
| `POST` | `/api/connectors` | Upsert connector |
| `PATCH` | `/api/connectors/:id` | Update connector |
| `DELETE` | `/api/connectors/:id` | Delete connector |
| `GET` | `/api/connectors/oauth/auth-url` | Get OAuth URL (query: type) |
| `POST` | `/api/connectors/oauth/confirm` | Confirm OAuth (body: state, code) |
| `GET` | `/api/schedule-tasks` | List scheduled tasks |
| `POST` | `/api/schedule-tasks` | Create scheduled task |
| `PATCH` | `/api/schedule-tasks/:id` | Update scheduled task |
| `DELETE` | `/api/schedule-tasks/:id` | Delete scheduled task |
| `GET` | `/api/schedule-tasks/:id/logs` | List run logs for a task |
| `POST` | `/api/schedule-tasks/:id/run` | Run a scheduled task now |
| `GET` | `/api/usage` | Get total token usage |
| `GET` | `/api/usage/sessions` | Get per-session token usage breakdown |
| `GET` | `/api/agent-output` | List agent-generated files |
| `GET` | `/api/agent-output/:filename/download` | Download agent-generated file |
| `DELETE` | `/api/agent-output/:filename` | Delete agent-generated file |
| `GET` | `/api/files/agent/:id/download` | Download an AgentFile by id |

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
model Memory {
  id        String   @id @default(cuid())
  type      String   // USER | FEEDBACK | PROJECT | REFERENCE
  title     String
  content   String
  metadata  String?  // JSON: { source, hash, sessionId, keywords }
  sessionId Int?
  agentId   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  session   Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}

model Setting {
  key   String @id
  value String
}

model KnowledgeFile {
  id           Int      @id @default(autoincrement())
  filename     String
  filepath     String
  size         Int
  mimeType     String
  status       String   @default("indexing")
  chunkCount   Int      @default(0)
  errorMessage String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Session {
  id           Int           @id @default(autoincrement())
  mode         String        @default("cowork")
  title        String        @default("New Session")
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  messages     ChatMessage[]
  plans        Plan[]
  agentFiles   AgentFile[]
  memories     Memory[]
  usageRecords UsageRecord[]
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

model Note {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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

model Tool {
  name         String   @id
  description  String
  parameters   String
  configSchema String?
  config       String?
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Plan {
  id        Int        @id @default(autoincrement())
  sessionId Int
  session   Session    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  title     String
  status    String     @default("PENDING")
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  steps     PlanStep[]
}

model PlanStep {
  id        Int      @id @default(autoincrement())
  planId    Int
  plan      Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  order     Int
  text      String
  status    String   @default("TODO")
  updatedAt DateTime @updatedAt
}

model AgentFile {
  id        Int      @id @default(autoincrement())
  filename  String
  path      String
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Project {
  id        String   @id @default(cuid())
  name      String
  path      String   @unique
  createdAt DateTime @default(now())
}

model Connector {
  id        String   @id @default(cuid())
  type      String
  account   String?
  config    String   @default("{}")
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model UsageRecord {
  id               Int      @id @default(autoincrement())
  sessionId        Int?
  modelName        String
  providerType     String
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  createdAt        DateTime @default(now())
  session          Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}

model ScheduleTask {
  id             Int      @id @default(autoincrement())
  name           String
  description    String?
  prompt         String
  frequency      String   @default("manual")
  cronMinute     Int?
  cronHour       Int?
  cronDayOfWeek  Int?
  cronDaysOfWeek String?
  modelId        Int?
  projectPath    String?
  timezone       String?  @default("UTC")
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  logs           ScheduleTaskLog[]
}

model ScheduleTaskLog {
  id          Int          @id @default(autoincrement())
  taskId      Int
  task        ScheduleTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  sessionId   Int?
  status      String       @default("PENDING")
  output      String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime     @default(now())
}
```

Run: `npx prisma migrate dev --name <name>` then `npx prisma generate`.

---

## DTOs

**`CreateNoteDto`**: `title` (required, string), `content` (required, string).

**`UpdateNoteDto`**: `PartialType(CreateNoteDto)` — all optional.

**`CreateScheduleTaskDto`**: `name` (required), `prompt` (required), `description?`, `frequency?` (manual|hourly|daily|weekdays|weekly), `cronMinute?` (0–59), `cronHour?` (0–23), `cronDayOfWeek?` (0–6), `cronDaysOfWeek?`, `modelId?` (Int), `projectPath?`, `timezone?`. `UpdateScheduleTaskDto` = `PartialType` + `enabled?`.

**`ChatDto`**: `message` (required), `providerModelId` (required, Int), `sessionId` (required, Int), `mode?` (optional, 'agent' | 'chat').

**`CreateProviderDto`**: `name` (required), `type?` (default 'ollama'), `baseUrl?`, `key?`.

**`UpdateProviderDto`**: `PartialType(CreateProviderDto)`.

**`SetProjectDto`**: `path` (required, string).

**`CreateUsageDto`**: `sessionId?` (Int, optional), `modelName` (required, string), `providerType` (required, string), `promptTokens` (required, Int, >=0), `completionTokens` (required, Int, >=0), `totalTokens` (required, Int, >=0).

---

## Environment Variables

`.env` (git-ignored):
```
DATABASE_URL="file:../workspace_data/dev.db"
PORT=13596
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

# Setup (generate + migrate + seed, with auto-resolve)
npm run setup

# Tests
npx jest                    # all (18+ suites)
npx jest src/agent          # specific module
npx jest src/usage          # usage module tests
npx jest src/tools          # tool executor tests

# Prisma
npx prisma studio           # GUI for SQLite
npx prisma migrate dev      # apply schema changes (dev only)
npx prisma generate         # regenerate client after schema edit
npx prisma migrate deploy   # apply pending migrations (production)
```

---

## CORS Policy

Allowed origin (hardcoded in `main.ts`):
- `http://localhost:17135` — Vite dev server / Nginx production

Never add `origin: '*'`.

---

## Coding Rules

1. **ORM only** — all DB access through `PrismaService`. No `$queryRaw` except the health-check ping.
2. **Typed DTOs** — every POST/PATCH body must use a DTO class with `class-validator` decorators.
3. **No `any`** — TypeScript strict. Use Prisma's generated types.
4. **No comments** unless the WHY is non-obvious.
