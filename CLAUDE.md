# Product Requirement Document (PRD) / Prompt for Claude Code
## Project: Local-First AI Agent Workspace (Web-based Hub)

### 1. Project Overview & Architecture
We are building a local-first, self-hosted AI Agent Workspace tailored primarily for software developers (coding-focused) but accessible to general office users. 
- **Deployment Mode:** Single-command installation using Docker Compose.
- **Access Mode:** Web URL interface (e.g., `http://localhost:3000` or local network IP).
- **Core Strategy:** Local-first data privacy. Heavy usage of embedded/zero-config components. No complex multi-server databases installation required for the user.

### 2. Tech Stack Requirements
- **Frontend:** Vue.js (or Nuxt.js) + TailwindCSS.
- **Backend:** NestJS (Node.js framework) acting as the main orchestrator.
- **AI Core:** Integration with OpenCode agent philosophy, communicating with a local Ollama instance (port 11434) or external APIs (OpenAI/DeepSeek spec).
- **Primary Database:** SQLite via Prisma or TypeORM (embedded as a single file inside a Docker volume).
- **Vector Database:** LanceDB (or ChromaDB embedded) for local RAG (Resource/Codebase indexing).
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

#### B. Agentic Task Management (Kanban & Automation)
- **Database Schema:** A SQLite table `tasks` with fields: `id`, `title`, `description`, `status` (TODO, PROCESSING, DONE, FAILED), `priority`, `due_date`, and `context_metadata`.
- **Agent Integration:** Expose custom tools/functions to the OpenCode Agent core so it can perform CRUD operations on the SQLite `tasks` table.
- **Real-time Synchronization:** Use `@nestjs/websockets` (Socket.io) to stream agent execution logs and task states directly to the web UI in real time.

---

### 5. Docker Compose Specs (Zero-Configuration Target)
The project must run smoothly via a single `docker-compose.yml`. 

**Required Services:**
1. `workspace-frontend`: Nginx container serving the built Vue.js files, proxying `/api` and `/socket.io` to the backend. Exposes port `3000`.
2. `workspace-backend`: NestJS application container running the agent logic, containing the SQLite DB file and LanceDB files.
3. **Volume Mapping:** Map a local folder `./workspace_data` into the backend container to persist the SQLite file (`dev.db`), indexed vector files, and user documents.
4. **Host Connectivity:** Enable `extra_hosts: - "host.docker.internal:host-gateway"` so the NestJS backend container can communicate effortlessly with Ollama running natively on the host machine (with GPU acceleration).

---

### 6. Expected Output from Claude Code
Dear Claude, please act as a Senior Full-stack Architect and Lead UI/UX Engineer. Generate the foundational boilerplate for this project:
1. Provide the structural directory layout for a monorepo setup (or split frontend/backend folders).
2. Generate the initialized `docker-compose.yml` meeting the specs above.
3. Write the NestJS configurations for SQLite (Prisma/TypeORM setup) and a sample Agent Module.
4. Provide the Nginx configuration file (`nginx.conf`) to glue the Frontend and Backend into port `3000`.
5. Create a basic Vue.js layout template implementing the requested **Terminal/IDE aesthetic** using TailwindCSS (with sample custom configuration for monospace fonts and custom border colors).

---

## Development Rules

These rules apply to ALL tasks in this project. Claude must follow them strictly.

---

### Rule Set 1: UI / Design System

**Color Tokens — never use raw hex values in components, always use Tailwind custom classes:**
| Token | Value | Usage |
|---|---|---|
| `cyber-bg` | `#0a0e1a` | Main background |
| `cyber-dark` | `#060911` | Panel headers, sidebar, input bars |
| `cyber-accent` | `#00d4ff` | Primary accent, active icons, borders |
| `cyber-border` | `rgba(0,212,255,0.13)` | Subtle panel dividers |
| `cyber-dim` | `rgba(0,212,255,0.33)` | Hover states, active borders |

**Typography:**
- ALL text in the UI uses `font-mono` (JetBrains Mono → Fira Code → Courier New fallback).
- Body/prose text: `text-slate-100` or `text-slate-300`.
- Dimmed/system text: `text-cyber-accent/50` or `text-cyber-accent/40`.
- Never use `sans` or `serif` font families anywhere in the UI.

**Layout rules:**
- 3-panel structure is canonical: `SidebarNav (52px fixed) | ChatPanel (45%) | ArtifactsPanel (flex-1)`.
- Do not add margins or padding outside the defined panel boundaries.
- All panels use `overflow-hidden` at the shell level; individual panels handle their own scroll with `overflow-y-auto`.
- Use `border-cyber-border` (not arbitrary border colors) for all panel dividers.

**Component styling:**
- Border radius: max `rounded` (4px). Never use `rounded-lg`, `rounded-xl`, or larger — terminal aesthetic requires sharp corners.
- No drop shadows (`shadow-*` classes are forbidden).
- No gradients. Flat, dark surfaces only.
- Allowed animations: `animate-blink` (cursor), typewriter via `setInterval`. No `transition` animations except `transition-colors duration-150` on interactive elements.
- Icons in the sidebar: plain emoji or Unicode symbols only. No SVG icon libraries.

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
- Only `http://localhost:5173` (Vite dev) and `http://localhost:3000` (Docker) are allowed origins.
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
chat.placeholder  → "type a command or question_" / "nhập lệnh hoặc câu hỏi_"
chat.system.init  → "Agent initialized..." / "Agent đã khởi động..."
chat.error        → "[error] ..." / "[lỗi] ..."
artifacts.empty   → "◈ No artifacts yet" / "◈ Chưa có kết quả"
health.ok         → "Backend: ok · DB: connected" / "Backend: hoạt động · DB: đã kết nối"
health.error      → "Backend unreachable" / "Không kết nối được backend"
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
- **Prisma migrations** — always run `prisma migrate dev --name <description>` for schema changes. Never edit migration files manually.