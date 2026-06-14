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
