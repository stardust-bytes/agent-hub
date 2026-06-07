# Design Spec: Local-First AI Agent Workspace — Foundation Skeleton

**Date:** 2026-06-07  
**Status:** Approved  
**Phase:** 1 of N — Foundation (subsequent phases: RAG, Kanban real-time, Ollama integration)

---

## Context

Building a local-first, self-hosted AI Agent Workspace for developers. The workspace runs entirely via `docker compose up` and is accessed at `http://localhost:3000`. This spec covers Phase 1: a fully wired foundation skeleton — all services talk to each other, the terminal-style UI renders, and a stub agent endpoint provides an observable end-to-end request path. No production AI features yet; those are phased in once the foundation is solid.

**Decisions made:**
- Monorepo (`/frontend` + `/backend` under one root)
- Vue 3 + Vite (SPA, no SSR needed for a local dev tool)
- Prisma + SQLite (schema-first, single-file DB)
- Ollama integration: stubbed for Phase 1, real proxy in Phase 2
- UI: Cyberpunk Cyan color scheme, 3-panel IDE layout (icon sidebar + chat + artifacts)

---

## Architecture Overview

```
Browser → Nginx :3000
  /api/*        → proxy → NestJS :3001 → Prisma → SQLite (dev.db)
  /socket.io/*  → proxy → NestJS :3001 (WebSocket, reserved)
  /*            → serve  → Vue SPA (index.html + assets)

NestJS backend
  extra_hosts: host.docker.internal:host-gateway  (future Ollama access)
  Volume: ./workspace_data → /app/data (SQLite + uploads persisted)
```

---

## Directory Structure

```
960513/
├── docker-compose.yml
├── .gitignore
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env                        ← DATABASE_URL=file:/app/data/dev.db
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/
│       │   └── prisma.service.ts   ← global PrismaClient wrapper
│       ├── tasks/
│       │   ├── tasks.module.ts
│       │   ├── tasks.service.ts
│       │   ├── tasks.controller.ts
│       │   └── dto/
│       │       ├── create-task.dto.ts
│       │       └── update-task.dto.ts
│       └── agent/
│           ├── agent.module.ts
│           ├── agent.service.ts    ← mock reply logic
│           └── agent.controller.ts
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── assets/
│       │   └── main.css            ← Tailwind + JetBrains Mono import
│       └── components/
│           ├── AppShell.vue        ← 3-panel layout, activeView state
│           ├── SidebarNav.vue      ← icon nav + health dot
│           ├── ChatPanel.vue       ← terminal chat UI
│           └── ArtifactsPanel.vue  ← code/markdown artifact renderer
│
└── workspace_data/                 ← gitignored, Docker volume mount
    ├── dev.db
    └── uploads/
```

---

## Docker Compose

**Services:**

| Service | Image | Port | Role |
|---|---|---|---|
| `workspace-frontend` | nginx:alpine (multi-stage) | 3000 (host) | Serves Vue SPA, proxies `/api` and `/socket.io` to backend |
| `workspace-backend` | node:20-alpine (multi-stage) | 3001 (internal only) | NestJS API + Prisma + SQLite |

**Key config:**
- `extra_hosts: host.docker.internal:host-gateway` on backend (future Ollama)
- Volume: `./workspace_data:/app/data` on backend
- Frontend depends_on backend (healthcheck: `GET /api/health`)

**Nginx proxy rules:**
- `location /api/` → `proxy_pass http://workspace-backend:3001/api/`
- `location /socket.io/` → `proxy_pass http://workspace-backend:3001/` + WebSocket upgrade headers
- `location /` → `try_files $uri $uri/ /index.html` (SPA fallback)

---

## Backend (NestJS)

### Prisma Schema

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

### Modules

**PrismaService** (`src/prisma/prisma.service.ts`)
- Extends `PrismaClient`, implements `OnModuleInit` / `OnModuleDestroy`
- Registered as `@Global()` so any module can inject it without re-importing

**TasksModule** (`src/tasks/`)
- `GET /api/tasks` — list all tasks
- `POST /api/tasks` — create task (CreateTaskDto: title required, rest optional)
- `PATCH /api/tasks/:id` — update task (UpdateTaskDto: all fields optional)
- `DELETE /api/tasks/:id` — delete task
- Validation via `class-validator` + `ValidationPipe`

**AgentModule** (`src/agent/`)
- `POST /api/agent/chat` — accepts `{ message: string }`, returns `{ reply: string, timestamp: string }`
- `AgentService.mockReply()` returns a deterministic echo: `"[stub] Received: <message>. Ollama integration coming in Phase 2."`

**Health endpoint** (`app.controller.ts`)
- `GET /api/health` → `{ status: "ok", db: "connected", timestamp: string }`
- Used by Docker healthcheck and the frontend sidebar dot

### Config
- `ConfigModule.forRoot({ isGlobal: true })` loads `.env`
- `DATABASE_URL` defaults to `file:/app/data/dev.db`
- Port: `3001`, CORS enabled for `http://localhost:5173` (Vite dev) and `http://localhost:3000` (Docker)

---

## Frontend (Vue 3 + Vite)

### Tailwind Config Extensions

```js
colors: {
  'cyber-bg':     '#0a0e1a',
  'cyber-dark':   '#060911',
  'cyber-accent': '#00d4ff',
  'cyber-border': 'rgba(0, 212, 255, 0.13)',
  'cyber-dim':    'rgba(0, 212, 255, 0.33)',
}
fontFamily: {
  mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace']
}
```

Google Fonts import for JetBrains Mono in `main.css`.

### Components

**`AppShell.vue`**
- Flex row: `SidebarNav` (fixed 52px) + `ChatPanel` (45% width) + `ArtifactsPanel` (flex-1)
- `activeView` ref (`'chat' | 'tasks' | 'files'`) passed to SidebarNav; future views swap ChatPanel content

**`SidebarNav.vue`**
- Icons: 💬 Chat (active), 📋 Tasks, 📁 Files, ⚙️ Settings
- Active icon has `bg-cyber-accent/10 border-cyber-dim` highlight
- Health dot: `onMounted` → `GET /api/health` → cyan `●` (ok) or red `●` (error), title tooltip shows status text

**`ChatPanel.vue`**
- `messages: Ref<Message[]>` where `Message = { role: 'user'|'agent'|'system', content: string, timestamp: string }`
- Initial system message on mount: `"Agent initialized. SQLite connected. Stub mode active."`
- Submit handler: appends user message, calls `POST /api/agent/chat`, appends agent reply with typewriter effect (`setInterval` 18ms per character)
- Error: appends red system message `"[error] Could not reach agent. Is the backend running?"`
- Input: `$ command_` styling with blinking cursor via `@keyframes blink`

**`ArtifactsPanel.vue`**
- Watches `ChatPanel`'s last agent message (emitted via `provide/inject`)
- Extracts fenced code blocks with regex; renders them in a styled `pre` block
- Non-code content rendered via `marked` as HTML, then sanitized with `DOMPurify` before `v-html` binding
- Empty state: `◈ No artifacts yet` centered placeholder

### Vite Dev Proxy
```ts
server: {
  proxy: {
    '/api': 'http://localhost:3001',
    '/socket.io': { target: 'http://localhost:3001', ws: true }
  }
}
```

---

## Data Flow

**Chat (primary user journey):**
```
User input → ChatPanel.submit()
  → POST /api/agent/chat { message }
  → AgentController → AgentService.mockReply()
  → { reply, timestamp }
  → ChatPanel appends agent message with typewriter effect
  → ArtifactsPanel extracts + renders any code blocks
```

**Health check:**
```
SidebarNav.onMounted()
  → GET /api/health
  → dot: cyan (ok) / red (unreachable)
```

**Task CRUD (background, ready for Kanban phase):**
```
Any future TasksView → GET/POST/PATCH/DELETE /api/tasks
  → TasksController → TasksService → PrismaService → SQLite
```

---

## Error Handling

- **Frontend fetch failures:** caught in try/catch, append red `[error]` system message in chat
- **Backend validation errors:** `ValidationPipe` returns `400` with `{ statusCode, message[] }` — Vue shows `message[0]`
- **NestJS unhandled exceptions:** global `HttpExceptionFilter` (registered in `main.ts`) returns `{ statusCode, message, timestamp }` for all unhandled errors

---

## Verification

After `docker compose up --build`:

1. Open `http://localhost:3000` — Vue app loads, sidebar dot turns cyan
2. Type any message in chat → agent replies with stub message
3. `GET http://localhost:3000/api/health` → `{ status: "ok", db: "connected" }`
4. `GET http://localhost:3000/api/tasks` → `[]` (empty array)
5. `POST http://localhost:3000/api/tasks` with `{ "title": "Test task" }` → task created with id
6. `GET http://localhost:3000/api/tasks` → array with the created task
7. Stop and restart containers → SQLite data persists (task still in list)

**Dev mode (no Docker):**
```bash
cd backend && npm run start:dev   # NestJS on :3001
cd frontend && npm run dev        # Vite on :5173
# open http://localhost:5173
```

---

## Out of Scope (Phase 2+)

- Ollama proxy (real LLM responses)
- LanceDB / RAG document indexing
- Kanban board view with Socket.io real-time updates
- File upload / knowledge base
- Settings panel (model selection, API keys)
