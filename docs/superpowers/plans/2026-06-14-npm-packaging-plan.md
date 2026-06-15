# npm Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the project as an npm CLI (`npx 171305-workspace-hub`) that serves the Vue.js frontend and NestJS API without Docker.

**Architecture:** Root `package.json` with `bin` entry point. Pre-built frontend served by NestJS via `app.useStaticAssets()` + SPA fallback middleware. Auto-creates `./workspace_data/` on first run and runs Prisma migration.

**Tech Stack:** Node.js, NestJS, Vue.js, Prisma, SQLite

---

### Task 1: Create root `package.json` and `.npmignore`

**Files:**
- Create: `package.json` (root)
- Create: `.npmignore` (root)

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "171305-workspace-hub",
  "version": "0.1.0",
  "private": true,
  "bin": {
    "workspace-hub": "./bin/workspace-cli.js"
  },
  "files": [
    "bin/",
    "backend/dist/",
    "backend/prisma/",
    "frontend/dist/"
  ],
  "scripts": {
    "build": "node scripts/build.mjs",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "prisma": "^5.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/event-emitter": "^3.1.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/schedule": "^6.1.3",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0",
    "socket.io": "^4.8.3",
    "googleapis": "^173.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "chokidar": "^3.6.0",
    "exceljs": "^4.4.0",
    "docx": "^9.7.1",
    "mammoth": "^1.12.0",
    "pdf-parse": "^2.4.5",
    "date-fns": "^4.4.0",
    "date-fns-tz": "^3.2.0",
    "@lancedb/lancedb": "^0.30.0",
    "@playwright/mcp": "^0.0.76",
    "imap": "^0.8.19",
    "mailparser": "^3.9.9",
    "nodemailer": "^8.0.11"
  }
}
```

- [ ] **Step 2: Create `.npmignore`**

```
frontend/src/
frontend/node_modules/
backend/src/
backend/node_modules/
backend/test/
scripts/
docs/
workspace_data/
*.md
.*
```

- [ ] **Step 3: Commit**

```bash
git add package.json .npmignore
git commit -m "chore: add root package.json and .npmignore for npm publishing"
```

---

### Task 2: Create CLI entry point and build script

**Files:**
- Create: `bin/workspace-cli.js`
- Create: `scripts/build.mjs`

- [ ] **Step 1: Create `bin/workspace-cli.js`**

```js
#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.cwd(), 'workspace_data');
const DB_PATH = path.join(DATA_DIR, 'dev.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbReady = fs.existsSync(DB_PATH);
if (!dbReady) {
  console.log('[workspace] First run — initializing database...');
  execSync(`npx prisma migrate deploy --schema="${path.join(ROOT, 'backend', 'prisma', 'schema.prisma')}"`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });
}

const server = spawn(
  'node',
  [path.join(ROOT, 'backend', 'dist', 'main.js')],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `file:${DB_PATH}`,
      PORT: process.env.PORT ?? '17135',
    },
  }
);

server.on('exit', (code) => process.exit(code ?? 0));
server.on('error', (err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Create `scripts/build.mjs`**

```js
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

console.log('[build] Installing frontend deps...');
execSync('npm ci', { cwd: resolve(ROOT, 'frontend'), stdio: 'inherit' });

console.log('[build] Building frontend...');
execSync('npm run build', { cwd: resolve(ROOT, 'frontend'), stdio: 'inherit' });

console.log('[build] Installing backend deps...');
execSync('npm ci', { cwd: resolve(ROOT, 'backend'), stdio: 'inherit' });

console.log('[build] Building backend...');
execSync('npm run build', { cwd: resolve(ROOT, 'backend'), stdio: 'inherit' });
```

- [ ] **Step 3: Commit**

```bash
git add bin/workspace-cli.js scripts/build.mjs
git commit -m "feat: add CLI entry point and build script for npm package"
```

---

### Task 3: Add static file serving to NestJS

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Run existing tests to verify baseline**

Run: `npx jest src/connector/ src/tools/executors/google-sheets-create.executor.spec.ts --verbose`
Expected: All tests pass before changes

- [ ] **Step 2: Modify `backend/src/main.ts`**

Replace the entire file content:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: ['http://localhost:17135'],
  });

  const frontendDir = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(frontendDir)) {
    app.useStaticAssets(frontendDir);
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api') && req.method === 'GET') {
        res.sendFile(join(frontendDir, 'index.html'));
      } else {
        next();
      }
    });
  }

  await app.listen(process.env.PORT ?? 17135);
}
bootstrap();
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd backend && npm run build`
Expected: NestJS compiles without errors

- [ ] **Step 4: Run tests to verify nothing is broken**

Run: `npx jest`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/main.ts
git commit -m "feat: add static file serving for npm-packaged frontend"
```

---

### Task 4: Build and verify the full pipeline

**Files:** none (verification only)

- [ ] **Step 1: Run the build script**

Run: `node scripts/build.mjs`
Expected:
- Frontend builds successfully (dist/ created)
- Backend builds successfully (dist/ created)

- [ ] **Step 2: Verify the frontend dist exists**

Run: `node -e "console.log(require('fs').existsSync('frontend/dist/index.html'))"`
Expected: `true`

- [ ] **Step 3: Verify the backend dist exists**

Run: `node -e "console.log(require('fs').existsSync('backend/dist/main.js'))"`
Expected: `true`
