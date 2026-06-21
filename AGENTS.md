# Product Requirement Document (PRD) / Prompt for Claude Code
## Project: Local-First AI Agent Workspace (Web-based Hub)

### 1. Project Overview & Architecture
We are building a local-first, self-hosted AI Agent Workspace tailored primarily for software developers (coding-focused) but accessible to general office users. 
- **Deployment Mode:** Single-command installation using Docker Compose.
- **Access Mode:** Web URL interface (e.g., `http://localhost:17135` or local network IP).
- **Core Strategy:** Local-first data privacy. Heavy usage of embedded/zero-config components. No complex multi-server databases installation required for the user.

### 2. Tech Stack Requirements

> As-built (the "or X" alternatives below were resolved during implementation):

- **Frontend:** Vue 3 (Composition API, `<script setup>`) + Vite + Vue Router + Pinia + TailwindCSS.
- **Backend:** NestJS 10 (Node.js framework) acting as the main orchestrator.
- **AI Core:** Custom agent loop (state machine) communicating with a local Ollama instance (port 11434) or external OpenAI-compatible APIs (OpenAI/DeepSeek spec); external tools via MCP (`@modelcontextprotocol/sdk`).
- **Primary Database:** SQLite via **Prisma** (embedded as a single file inside a Docker volume).
- **Vector Database:** **LanceDB** (`@lancedb/lancedb`) for local RAG (Resource/Codebase indexing).
- **Web Server / Reverse Proxy:** Nginx (embedded in frontend docker) to serve UI and proxy API requests to NestJS.

---

### 3. UI/UX Aesthetic: Terminal / IT-centric Style
The interface must look and feel like an advanced developer environment (IDE/CLI-hybrid) while remaining structured enough for office users.
- **Theme:** Dark mode by default (Monochrome or Cyberpunk/Matrix-adjacent). Use deep grays/blacks (`#0d1117`, `#161b22`) with high-contrast accent colors (Neon Green, Cyan, or Amber) for status indicators.
- **Typography:** Use Monospace fonts (e.g., `JetBrains Mono`, `Fira Code`, or `SF Mono`) for system outputs, agent logs, and code streams.
- **Components Styling:**
  - **Chat Interface:** Model it after a terminal console. The agent’s output should have a "streaming shell text" effect. Inputs should look like command lines prompt (`$ user_request...`).
  - **The "Artifacts" Panel:** Instead of clean generic cards, render code snippets, markdown tables, and file trees inside retro-modern container blocks with subtle borders (`1px solid #30363d`), mimicking code editors.
  - **Task & Kanban View:** A clean grid with border-lines (resembling terminal UI tables or TUI frameworks like `lazygit`).

---

### 4. Core Features & Capabilities

#### A. Resource & Codebase Management (Local-First RAG)
- **Developer Context:** Ability to watch a designated local directory (project source code), split the code into chunks (handling programming language syntax), generate embeddings via local Ollama or API, and save them into LanceDB.
- **Office Context:** A virtual `/knowledge` folder where users can drag-and-drop `.docx`, `.xlsx`, `.pdf` files. The system processes and indexes them cross-referenceable by the AI Agent.

#### B. Agentic Task Management (Scheduled Tasks & Automation)
> As-built: the original Kanban `tasks` table was replaced by **scheduled tasks**. Notes are a separate lightweight CRUD entity.
- **Database Schema:** SQLite `ScheduleTask` (named agent prompt + cron schedule) with `ScheduleTaskLog` per run. See `backend/AGENTS.md` for the full Prisma schema. (There is no standalone `Task` model.)
- **Agent Integration:** Custom tools (`create_task`, `convert_note_to_task`) let the agent create `ScheduleTask` rows; the agent loop runs a task's prompt and records a `ScheduleTaskLog`.
- **Real-time Synchronization:** Use `@nestjs/websockets` (Socket.io) to stream events to the web UI in real time — notes (`/notes`) and memories (`/memories`) namespaces; agent chat streams over SSE.

---

### 5. Docker Compose Specs (Zero-Configuration Target)
The project must run smoothly via a single `docker-compose.yml`. 

**Required Services:**
1. `workspace-frontend`: Nginx container serving the built Vue.js files, proxying `/api` and `/socket.io` to the backend. Exposes port `17135` (mapped `17135:80`).
2. `workspace-backend`: NestJS application container running the agent logic, containing the SQLite DB file and LanceDB files.
3. **Volume Mapping:** Map a local folder `./workspace_data` into the backend container to persist the SQLite file (`dev.db`), indexed vector files, and user documents.
4. **Host Connectivity:** Enable `extra_hosts: - "host.docker.internal:host-gateway"` so the NestJS backend container can communicate effortlessly with Ollama running natively on the host machine (with GPU acceleration).

---

### 6. Expected Output from Claude Code
Dear Claude, please act as a Senior Full-stack Architect and Lead UI/UX Engineer. Generate the foundational boilerplate for this project:
1. Provide the structural directory layout for a monorepo setup (or split frontend/backend folders).
2. Generate the initialized `docker-compose.yml` meeting the specs above.
3. Write the NestJS configurations for SQLite (Prisma/TypeORM setup) and a sample Agent Module.
4. Provide the Nginx configuration file (`nginx.conf`) to glue the Frontend and Backend into port `17135`.
5. Create a basic Vue.js layout template implementing the requested **Terminal/IDE aesthetic** using TailwindCSS (with sample custom configuration for monospace fonts and custom border colors).

---

## System Architecture (As-Built)

This section reflects the implemented system. Each module keeps its own `AGENTS.md` with details — start there, then drill down.

### Repository Structure

```
agent-hub/
├── docker-compose.yml      — 2 services: workspace-backend (13596), workspace-frontend (17135)
├── package.json            — root npm package (agent-hub), publishes the CLI
├── bin/workspace-cli.js    — `agent-hub` CLI (npx one-command install/run; subcommands: init, studio, auto-start)
├── scripts/                — build/setup orchestration (build.mjs, …)
├── backend/                — NestJS API (see backend/AGENTS.md)
│   ├── prisma/schema.prisma — single source of truth for the DB schema
│   └── src/<module>/AGENTS.md — per-module docs
├── frontend/               — Vue 3 + Vite SPA (see frontend/AGENTS.md)
│   └── src/components/AGENTS.md
├── docs/index.html          — GitHub Pages landing page (project site)
├── docs/superpowers/       — specs/ (design) + plans/ (implementation) — committed
└── workspace_data/         — runtime volume: dev.db, lancedb/, uploads/, agent-output/ (git-ignored)
```

### Port Reference

| Service | Port | Notes |
|---|---|---|
| Frontend / Nginx | `17135` | UI + reverse proxy (`/api`, `/socket.io`) — the only URL users open |
| Backend (NestJS) | `13596` | internal API; `PORT` env (falls back to `17135` if unset) |
| Ollama (host) | `11434` | reached via `host.docker.internal` from the backend container |

### Agent Subsystem

- **Agent loop** (`backend/src/agent/`) — state-machine ReAct loop, SSE streaming, native tool calling. Providers: Ollama + OpenAI-compatible. Sub-agents and MCP servers supported.
- **Tools** (`backend/src/tools/`) — tool registry (`Tool` table, enable/config) + executor classes. Office executors live in `excel/` and `word/`; Google executors back the connectors.
- **Mode policy** (`backend/src/mode-policy/`) — filters available tools/paths and sets the permission mode per agent mode.
- **Permissions / YOLO** (`backend/src/agent/services/`) — per-tool approval, danger-pattern blocking, 2-stage LLM safety classifier with denial tracking.
- **RAG** — `knowledge/` (uploaded docs → LanceDB) and `workspace/` (watched codebase → LanceDB) with Ollama embeddings.
- **Connectors** (`backend/src/connector/`) — Google OAuth (Gmail / Calendar / Drive / Sheets) exposed as agent tools.
- **Scheduling** (`backend/src/schedule-tasks/`) — cron-driven agent runs (the "tasks" feature).

### Distribution

The repo is a publishable npm package (`@stardust-bytes/agent-hub`); end users can run it with one command via `npx @stardust-bytes/agent-hub`, or via `docker-compose up`. See `README.md`.

**CLI Subcommands (`bin/workspace-cli.js`):**
| Command | Description |
|---|---|
| `agent-hub` / `agent-hub studio` | Start Studio (server + dashboard, auto-opens browser) |
| `agent-hub studio --no-browser` | Start server without opening browser |
| `agent-hub init` | One-time setup (data dir, .env, prisma migrate, seed) |
| `agent-hub auto-start enable` | Register Windows auto-start (HKCU Run) |
| `agent-hub auto-start disable` | Remove Windows auto-start |
| `agent-hub auto-start status` | Check auto-start status |
| `agent-hub --help` | Show help |

---

## Development Rules

These rules apply to ALL tasks in this project. Claude must follow them strictly.

---

### Rule Set 1: UI / Design System

**Theme: Semantic Tokens (Mintlify-style).** `darkMode: 'class'` + CSS variable tokens defined in `main.css` (`:root`/`.dark`), exposed via Tailwind `rgb(var(--name) / <alpha-value>)`. Components use semantic utility classes only — no Tailwind color literals (`bg-white`, `text-gray-900`, `border-gray-200`, etc.). Interactive primitives use **Headless UI** (`@headlessui/vue`).

| Token | Light value | Dark value | Usage |
|---|---|---|---|
| `background` | `255 255 255` | `15 17 23` | View background |
| `surface` | `255 255 255` | `22 27 34` | Panels, cards, headers, sidebar, modals |
| `muted` | `249 250 251` | `26 32 40` | Hover rows, code/terminal panes, inset fills |
| `elevated` | `255 255 255` | `30 37 46` | Modals, dropdowns, popovers |
| `border` | `229 231 235` | `34 43 54` | Panel/section dividers |
| `input` | `209 213 219` | `48 58 70` | Inputs, selects, secondary buttons |
| `ring` | `59 130 246` | `59 130 246` | Input focus ring |
| `foreground` | `17 24 39` | `230 237 243` | Primary text, code text |
| `muted-foreground` | `107 114 128` | `139 148 158` | Secondary, muted, meta text |
| `primary` | `37 99 235` | `59 130 246` | Links, active, accent, primary buttons |
| `primary-foreground` | `255 255 255` | `255 255 255` | Primary button label |
| `success` | `22 163 74` | `34 197 94` | Connected / success |
| `warning` | `217 119 6` | `245 158 11` | Processing / pending |
| `danger` | `220 38 38` | `248 113 113` | Errors, delete |

**Typography:**
- UI chrome uses `font-sans` (Inter stack: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI"…`).
- `font-mono` (`"JetBrains Mono"`, `"Fira Code"`, monospace) currently unused (all UI uses `font-sans`). Reserve for future code-specific display if needed.
- Body/prose text: `text-foreground` (primary) or `text-muted-foreground` (secondary).

**Layout rules:**
- Mintlify-style shell: `TopBar (h-14) | flex-row (grouped SidebarNav + router-view content) | StatusBar (h-[1.75rem])`.
- Sidebar is `w-64`, hidden on mobile (`hidden xl:flex`). Mobile uses an overlay drawer.
- Do not add margins or padding outside the defined panel boundaries.
- All panels use `overflow-hidden` at the shell level; individual panels handle their own scroll with `overflow-y-auto`.
- Use `border-border` (not arbitrary border colors) for all panel dividers.

**Component styling:**
- Border radius: `rounded-lg` (8px) for controls, inputs, cards; `rounded-xl` (12px) for modals.
- Subtle shadows only — `shadow-sm` on hover cards, `shadow-lg` on popovers/menus, `shadow-xl` on modals. No gradients.
- Light/flat surfaces — `bg-background` (page), `bg-surface` (panels/cards).
- Allowed animations: `animate-blink` (cursor), `animate-dot-pulse` (streaming), typewriter via `setInterval`. No `transition` animations except `transition-colors duration-150` on interactive elements.
- Icons: `vue-icons-plus/hi` (Hero Icons) throughout the UI. No inline SVG.
- Interactive primitives (modal/select) built on Headless UI — see `BaseModal`, `BaseSelect`.

**New components must:**
1. Live in `frontend/src/components/`.
2. Use `<script setup lang="ts">` syntax.
3. Define all props and emits with TypeScript generics (`defineProps<{...}>()`, `defineEmits<{...}>()`).
4. Not import global CSS — style via Tailwind classes only.

---

### Rule Set 2: Security

**Input sanitization:**
- Any content rendered via `v-html` MUST first be passed through `DOMPurify.sanitize()`. No exceptions.
- Example: `v-html="DOMPurify.sanitize(marked.parse(content))"`.
- Never bind raw API responses directly to `v-html`.

**Backend validation:**
- Every NestJS controller endpoint that accepts a request body MUST use a DTO class with `class-validator` decorators.
- `ValidationPipe` is global (`whitelist: true, transform: true`) — already set in `main.ts`. Never disable it per-route.
- Never use `@Body() body: any` — always a typed DTO.

**Database:**
- NEVER construct raw SQL strings. Always use Prisma's typed client methods (`prisma.task.findMany()`, etc.).
- The only allowed use of `$queryRaw` is for the health check ping (`SELECT 1`).
- All Prisma queries go through `PrismaService` — never instantiate `PrismaClient` directly in a service.

**Secrets and environment:**
- No secrets, API keys, or tokens in source code or committed files.
- All config values come from `.env` via `ConfigService` or `process.env`.
- `.env` is gitignored. `.env.example` documents required keys with placeholder values.
- The `DATABASE_URL` must always use the Docker volume path (`file:/app/data/dev.db`) in production and a local path in `.env` for dev.

**CORS:**
- Only `http://localhost:17135` is allowed as origin.
- Never set `origin: '*'` or `origin: true`.

**Error handling:**
- `HttpExceptionFilter` (global, registered in `main.ts`) handles all unhandled exceptions. Never swallow errors silently.
- Frontend: catch all `fetch()` calls in try/catch. On failure, append a red `[error]` system message to the chat — never `console.error` only.
- Never expose stack traces or internal error details to the frontend response.

---

### Rule Set 3: i18n (Internationalization)

**Language strategy:**
- **Primary UI language: Vietnamese (vi)**. All user-facing labels, button text, placeholder text, and status messages must be in Vietnamese.
- **Secondary language: English (en)**. Supported as a toggle.
- **Code, logs, error keys, and commit messages: English always.**

**Implementation:**
- Use `vue-i18n` v9 for frontend translations.
- Locale files live at `frontend/src/locales/vi.json` and `frontend/src/locales/en.json`.
- Never hardcode user-facing strings directly in `.vue` files — always use `t('key')`.
- The `i18n` instance is created in `frontend/src/i18n.ts` and registered in `main.ts`.

**String key conventions:**
```
nav.chat          → "Chat" / "Trò chuyện"
nav.tasks         → "Tasks" / "Nhiệm vụ"
nav.files         → "Files" / "Tệp tin"
nav.settings      → "Settings" / "Cài đặt"
nav.providers     → "Providers" / "Providers"
chat.placeholder  → "type a command or question_" / "nhập lệnh hoặc câu hỏi_"
chat.system.init  → "Agent initialized. SQLite connected. Stub mode active." / "Agent đã khởi động. SQLite đã kết nối. Đang ở chế độ stub."
chat.error        → "[error] ..." / "[lỗi] ..."
chat.no_provider  → "No provider configured..." / "Chưa có provider..."
chat.mode.agent   → "Agent" / "Agent"
chat.mode.chat    → "Chat" / "Chat"
chat.thinking     → "⟳ thinking..." / "⟳ đang nghĩ..."
health.ok         → "Backend: ok · DB: connected" / "Backend: hoạt động · DB: đã kết nối"
health.error      → "Backend unreachable" / "Không kết nối được backend"
providers.*       → Full provider management i18n keys
sessions.*        → Full session management i18n keys
tasks.*           → Full kanban/task i18n keys
files.*           → Full knowledge base i18n keys
settings.*        → Full settings i18n keys
```

**Date and number formats (Vietnamese locale):**
- Dates: `DD/MM/YYYY` format (use `toLocaleDateString('vi-VN')`).
- Times: 24-hour format (use `toLocaleTimeString('vi-VN', { hour12: false })`).
- Numbers: `.` as thousands separator, `,` as decimal (Vietnamese standard).

**Backend:**
- Backend returns error messages in English (keys only). The frontend translates them using i18n.
- `NestJS` validation error messages stay in English — frontend maps them to Vietnamese via i18n keys.

---

### Rule Set 4: General Coding Standards

- **No comments** unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant).
- **No unused imports** — TypeScript strict mode catches these.
- **TDD for backend** — write `.spec.ts` before implementing services and controllers.
- **Commit granularity** — one logical change per commit. Prefix: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- **No `any` types** in TypeScript. Use proper types or `unknown` with narrowing.

### Rule Set 5: Database Schema Migration

**Core principle:** Every schema change MUST preserve existing user data. Data loss is never acceptable.

**Migration workflow:**
- Use `prisma migrate dev --name <desc>` for safe changes (add new table, add optional column).
- Use `prisma migrate dev --create-only` + manual SQL editing for changes that could break existing data (rename column, change type, add required column). Never edit past migration files.

**Add column:** MUST be nullable or have a DEFAULT value. NEVER add a required (NOT NULL) column to a table that contains data.

**Rename column/table:** Use `--create-only` with custom SQL (`ALTER TABLE ... RENAME COLUMN`). Update the Prisma schema to use the new name.

**Drop column/table:** STRICTLY PROHIBITED on tables/columns that contain user data. Mark as deprecated instead. Only remove after a deprecation period with a data migration plan.

**Change column type:** SQLite ALTER support is limited. Use `--create-only` with the safe pattern: create new table → INSERT INTO ... SELECT (with CAST) → verify → DROP old table → RENAME new table.

**Validation:** Every migration MUST be tested against a copy of production data before deployment.

**Version control:** All migration files are committed. Production uses `prisma migrate deploy`. Never modify or delete historical migration files.

---

### Commit Conventions

#### Format

```
<type>: <short description>

<optional body with details>

Issue: #<issue-number> (optional)
```

#### Types

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring without feature change |
| `docs` | Documentation only |
| `style` | Formatting, semicolons, etc. (no code change) |
| `test` | Adding or fixing tests |
| `chore` | Build config, dependencies, tooling |
| `perf` | Performance improvement |

#### Rules

- **Language**: Write commit descriptions in English.
- **Conciseness**: Subject line ≤ 72 characters.
- **Body**: Leave blank if subject is clear enough. If details are needed, leave a blank line after the subject then write the body.
- **Lowercase**: Start type in lowercase (`feat`, `fix`, not `Feat`, `Fix`).
- **No trailing period**: Subject line must not end with `.`

#### Important

- **Full description**: Commit must include a subject (summary) and body (description) clearly explaining what changed. The body explains "why" and "what was adjusted", not just repeating the subject.
- **ABSOLUTELY DO NOT** add `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` or any variant to commit messages.

#### Examples

```
feat: add JWT authentication with refresh token rotation

feat: initialize NestJS backend project scaffold

fix: resolve TypeScript build error in update-agent.dto

refactor: extract encryption logic to dedicated service
```

### Git Ignore Rules

When committing, **ABSOLUTELY DO NOT** include the following files/directories:
- `.superpowers/` — brainstorming, worktree metadata, skill cache
- `.claude/settings.local.json` — local-only settings (permissions, env vars)

`docs/superpowers/` (specs, plans) are project documents, **MUST commit** to sync between machines.

### Design Specs

See `docs/superpowers/specs/` for full design specification and `docs/superpowers/plans/` for implementation plan.

### AGENTS.md — Documentation Sync Rule

Each module directory has an `AGENTS.md` file describing purpose, status, key files, API endpoints, dependencies, and TODOs. `CLAUDE.md` at the same level only contains `@AGENTS.md` (Claude Code import syntax).

**ABSOLUTELY** update `AGENTS.md` when there are any changes to:
- New or changed business logic (endpoints, service methods, DTOs)
- File structure changes (add/delete/rename important files)
- Status changes (SKELETON → PARTIAL → IMPLEMENTED)
- New or changed dependencies (entities, modules, packages)
- Completed TODOs or new TODOs added

Rule: **Code changes → Update AGENTS.md before committing.**

When updating any `AGENTS.md` file:
- **ONLY** modify the entries that reflect the code, structure, status, dependency, endpoint, or TODO items that were actually changed or newly added.
- **DO NOT** rewrite the whole file, **DO NOT** "clean up" unrelated sections, and **DO NOT** change wording just because you prefer different phrasing when the current meaning is still correct.
- **DO NOT** change the existing file format on your own, including heading levels, section order, bullet style, checkbox style, tables, label conventions, indentation, line spacing, and the presentation conventions already used in that specific file.
- If new information must be added, insert it into the correct section using the existing format instead of restructuring the whole file.
- If an existing entry is not affected by the code change, leave it unchanged.
- If the current format seems imperfect but is still consistent, **prefer preserving it**; only adjust formatting when the user explicitly asks for that specific file.