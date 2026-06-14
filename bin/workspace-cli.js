#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CWD = process.cwd();
const DATA_DIR = path.resolve(CWD, 'workspace_data');
const DB_PATH = path.join(DATA_DIR, 'dev.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const envPath = path.join(CWD, '.env');
if (!fs.existsSync(envPath)) {
  const examplePath = path.join(ROOT, 'backend', '.env.example');
  if (fs.existsSync(examplePath)) {
    console.log('[workspace] Creating .env from .env.example — edit it to match your setup');
    fs.copyFileSync(examplePath, envPath);
  } else {
    console.log('[workspace] Creating default .env');
    const defaults = [
      'PORT=17135',
      'OLLAMA_URL=http://localhost:11434',
      'ACTIVE_PROVIDER=ollama',
      'EMBED_MODEL=nomic-embed-text',
      'SUMMARY_MODEL=llama3.2',
      'UPLOAD_DIR=./workspace_data/uploads',
      'APP_URL=http://localhost:17135',
      '',
      '# Google OAuth credentials (optional)',
      'GOOGLE_GMAIL_CLIENT_ID=',
      'GOOGLE_GMAIL_CLIENT_SECRET=',
      'GOOGLE_CALENDAR_CLIENT_ID=',
      'GOOGLE_CALENDAR_CLIENT_SECRET=',
      'GOOGLE_DRIVE_CLIENT_ID=',
      'GOOGLE_DRIVE_CLIENT_SECRET=',
      'GOOGLE_SHEETS_CLIENT_ID=',
      'GOOGLE_SHEETS_CLIENT_SECRET=',
    ].join('\n');
    fs.writeFileSync(envPath, defaults);
  }
}

const dbReady = fs.existsSync(DB_PATH);
if (!dbReady) {
  console.log('[workspace] First run — initializing database...');
  execSync(`npx prisma migrate deploy --schema="${path.join(ROOT, 'backend', 'prisma', 'schema.prisma')}"`, {
    cwd: path.join(ROOT, 'backend'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });

  console.log('[workspace] Seeding database...');
  execSync('npx prisma db seed', {
    cwd: path.join(ROOT, 'backend'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });
}

const server = spawn(
  'node',
  [path.join(ROOT, 'backend', 'dist', 'src', 'main.js')],
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
