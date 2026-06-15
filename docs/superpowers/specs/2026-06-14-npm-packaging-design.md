# npm Package: `171305-workspace-hub`

## Problem

Project currently runs only via Docker Compose. Users need a simpler
`npx 171305-workspace-hub` experience — install and run in one command, no Docker
required. Docker support must be preserved for future production use. Must work on
Windows.

## Solution

Root CLI wrapper package (`package.json` at project root) with a `bin` entry.
Frontend is pre-built into static files, NestJS serves them directly (no Nginx).
On first run, auto-creates `./workspace_data/` and runs Prisma migration.

## Architecture

```
171305-workspace-hub/ (npm package)
├── package.json            — bin, deps, files[], scripts
├── .npmignore              — exclude sources, keep only dist/
├── bin/
│   └── workspace-cli.js    — entry point: setup + boot
│   └── setup-db.js         — first-run prisma migration
├── backend/
│   ├── dist/               — NestJS compiled
│   ├── prisma/             — schema + migrations
│   ├── package.json        — reference only, not installed
│   └── tsconfig.json
├── frontend/
│   ├── dist/               — Vue.js SPA pre-built
│   └── (source excluded by .npmignore)
└── docker-compose.yml      — kept for future use
```

## Package

### Root `package.json`

```json
{
  "name": "171305-workspace-hub",
  "version": "0.1.0",
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
    "postinstall": "node bin/setup-db.js",
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

### `.npmignore`

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

### Entry point: `bin/workspace-cli.js`

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

### Build script: `scripts/build.mjs`

```js
import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

console.log('[build] Installing frontend deps...');
execSync('npm ci', { cwd: resolve(ROOT, '..', 'frontend'), stdio: 'inherit' });

console.log('[build] Building frontend...');
execSync('npm run build', { cwd: resolve(ROOT, '..', 'frontend'), stdio: 'inherit' });

console.log('[build] Installing backend deps...');
execSync('npm ci', { cwd: resolve(ROOT, '..', 'backend'), stdio: 'inherit' });

console.log('[build] Building backend...');
execSync('npm run build', { cwd: resolve(ROOT, '..', 'backend'), stdio: 'inherit' });

console.log('[build] Done.');
```

### NestJS Changes: `backend/src/main.ts`

Add `NestExpressApplication` type and serve static frontend files:

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

### Backend `package.json` changes

No changes needed — `app.useStaticAssets()` comes from `@nestjs/platform-express`
which is already a dependency.

## Windows Compatibility

- `path.resolve()` instead of `path.join()` for safe cross-platform paths
- `#!/usr/bin/env node` shebang works on Windows via Node.js
- `spawn` with `shell: false` (default) is cross-platform
- `execSync` works on Windows with proper path quoting
- `.npmignore` is platform-agnostic
- No bash-specific scripts — all logic in JS/`.mjs`

## Docker Preservation

`docker-compose.yml` stays unchanged. Users who prefer Docker can continue using
it. The Docker setup is independent of the npm package.

## User Experience

```bash
# Install and run
npx 171305-workspace-hub

# Or install globally
npm install -g 171305-workspace-hub
workspace-hub

# Open browser
# → http://localhost:17135
```

On first run, output:
```
[workspace] First run — initializing database...
[workspace] Running at http://localhost:17135
```

## Files Changed/Created

| File | Action |
|---|---|
| `package.json` (root) | Create |
| `.npmignore` (root) | Create |
| `bin/workspace-cli.js` | Create |
| `scripts/build.mjs` | Create |
| `backend/src/main.ts` | Modify — add static serving |
| `backend/package.json` | Modify — add @nestjs/serve-static |
