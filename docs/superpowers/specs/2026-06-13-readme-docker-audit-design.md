# README Rewrite + Docker Config Audit

## Scope

Two deliverables:
1. **Docker Compose config audit** — code-level review of Windows compatibility issues
2. **README.md rewrite** — full SEO-optimized rewrite focusing on local-first + cowork, covering all nav features

## README Structure

1. Hero + SEO badges (keep current, add Local-First and Cowork badges)
2. Feature grid — all nav features except Tasks and Knowledge Base:
   - Cowork (AI pair programming with file tree, SSE streaming, code preview)
   - Notes (Markdown CRUD)
   - Connectors (Google: Gmail, Calendar, Drive via OAuth)
   - Tools Registry (enable/disable/config per tool)
   - Plans (AI auto-plan + step execution + resume)
   - Scheduled Tasks (cron-based automation)
   - Agent Outputs (download generated files)
   - Settings (Ollama / MCP / OAuth config)
   - Memory (long-term memory with auto-extraction)
   - Usage Tracking (token usage per session)
   - Permissions (granular tool approval / YOLO mode)
3. Local First (SQLite + LanceDB + Ollama + no telemetry)
4. Installation (npm dev → run.ps1 single command → Docker Compose)
5. Tech Stack (table)
6. Configuration (.env + providers)
7. Project Structure (tree)

## Docker Config Audit Findings

### Issue 1: Backend Dockerfile missing `.dockerignore`
No `.dockerignore` means the build context includes `node_modules/`, `.env`, and development artifacts, slowing builds.

### Issue 2: Backend prod stage has no `prisma` CLI
`prisma` is in `devDependencies` and `npm ci --omit=dev` removes it. `npx prisma migrate deploy` will trigger an on-demand download at container startup. Mitigation: install `prisma` as a regular dependency or copy from builder.

### Issue 3: Backend Dockerfile copies `.env` into image
`COPY . .` includes `.env` (no `.dockerignore`). Secrets leak into the image. Mitigation: add `.dockerignore` or use Docker's `--secret`.

### Issue 4: Healthcheck uses `fetch` — OK for Node 20
`fetch` is globally available in Node 18+. No issue.

### Issue 5: Volume path `./workspace_data` on Windows
Docker Desktop for Windows handles Linux bind mounts correctly. The directory is created automatically on first mount. No issue.

### Issue 6: Frontend depends on backend healthcheck
The frontend container depends on `workspace-backend: condition: service_healthy`. If healthcheck fails during startup, frontend never starts. Mitigation: remove `condition: service_healthy` or add `restart: on-failure` to frontend.

### Recommended fixes
1. Add `.dockerignore` (node_modules, .env, dist, .git, *.log, workspace_data)
2. Copy `prisma` CLI from builder stage or use `npx prisma@latest migrate deploy`
3. Add `restart: on-failure` to frontend service
