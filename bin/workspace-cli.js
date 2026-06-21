#!/usr/bin/env node
const { spawn, execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const CWD = process.cwd();
const BACKEND_ENTRY = path.join(ROOT, 'backend', 'dist', 'main.js');

function resolveDataDir() {
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--data-dir' && i + 1 < process.argv.length) {
      return path.resolve(process.argv[i + 1]);
    }
  }
  if (process.env.AGENT_HUB_DATA_DIR) {
    return path.resolve(process.env.AGENT_HUB_DATA_DIR);
  }
  const rootData = path.join(ROOT, 'workspace_data');
  if (fs.existsSync(rootData)) return rootData;
  const cwdData = path.resolve(CWD, 'workspace_data');
  if (fs.existsSync(cwdData)) return cwdData;
  const appData = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'agent-hub')
    : path.join(os.homedir(), '.agent-hub');
  return appData;
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'dev.db');

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function createDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log('init', 'Created workspace_data directory');
  }
}

function createEnv() {
  const envPath = path.join(DATA_DIR, '.env');
  const legacyEnv = path.join(CWD, '.env');
  if (fs.existsSync(envPath)) return;
  if (fs.existsSync(legacyEnv) && legacyEnv !== envPath) {
    fs.copyFileSync(legacyEnv, envPath);
    log('init', `Migrated .env from ${legacyEnv} to ${envPath}`);
    return;
  }
  const examplePath = path.join(ROOT, 'backend', '.env.example');
  if (fs.existsSync(examplePath)) {
    log('init', 'Creating .env from .env.example — edit it to match your setup');
    fs.copyFileSync(examplePath, envPath);
  } else {
    log('init', 'Creating default .env');
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

function needsMigration() {
  return !fs.existsSync(DB_PATH);
}

function runMigrations() {
  const schemaPath = path.join(ROOT, 'backend', 'prisma', 'schema.prisma');
  const backendDir = path.join(ROOT, 'backend');
  const env = { ...process.env, DATABASE_URL: `file:${DB_PATH}` };

  log('init', 'Applying database migrations...');
  execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
    cwd: backendDir, stdio: 'inherit', env,
  });

  generatePrismaClient();

  log('init', 'Seeding database...');
  execSync('npx prisma db seed', {
    cwd: backendDir, stdio: 'inherit', env,
  });
}

function generatePrismaClient() {
  const schemaPath = path.join(ROOT, 'backend', 'prisma', 'schema.prisma');
  const backendDir = path.join(ROOT, 'backend');
  const env = { ...process.env, DATABASE_URL: `file:${DB_PATH}` };

  log('init', 'Generating Prisma client...');
  try {
    execSync(`npx prisma generate --schema="${schemaPath}"`, {
      cwd: backendDir, stdio: 'pipe', env,
    });
  } catch (e) {
    log('init', 'Warning: prisma generate failed:', e.message);
  }
}

function getPort() {
  return process.env.PORT ?? '17135';
}

function resolveEnv() {
  const envPath = path.join(DATA_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

function waitForServer(port, maxRetries = 120) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'ok') return resolve();
          } catch {}
          retry();
        });
      });
      req.on('error', retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (++retries >= maxRetries) {
        return reject(new Error('Server did not start in time'));
      }
      setTimeout(check, 500);
    };
    check();
  });
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

async function cmdInit() {
  log('init', `Data dir: ${DATA_DIR}`);
  createDataDir();
  createEnv();
  if (needsMigration()) {
    runMigrations();
    log('init', 'Setup complete');
  } else {
    log('init', 'Already initialized (dev.db exists)');
  }
  process.exit(0);
}

async function cmdStudio() {
  const noBrowser = process.argv.includes('--no-browser');
  const port = getPort();

  createDataDir();
  createEnv();
  if (needsMigration()) {
    runMigrations();
  }
  generatePrismaClient();
  resolveEnv();

  log('studio', `Using data dir: ${DATA_DIR}`);
  const server = spawn('node', [BACKEND_ENTRY], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `file:${DB_PATH}`,
      PORT: port,
    },
  });

  server.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  log('studio', `Starting server on port ${port}...`);
  try {
    await waitForServer(port);
  } catch {
    log('studio', 'Warning: Could not confirm server readiness');
  }

  const url = `http://localhost:${port}`;
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║      Agent Hub Studio                ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  URL:  ${url.padEnd(33)}║`);
  console.log(`  ║  Port: ${port.padEnd(33)}║`);
  console.log('  ╠══════════════════════════════════════╣');
  console.log('  ║  Press Ctrl+C to stop                ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');

  if (!noBrowser) {
    openBrowser(url);
  }

  const cleanup = () => {
    log('studio', 'Shutting down...');
    server.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1000);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  server.on('exit', (code) => process.exit(code ?? 0));
}

function getRegistryValue(key, name) {
  return new Promise((resolve) => {
    exec(`reg query "${key}" /v "${name}"`, (err, stdout) => {
      if (err) return resolve(null);
      const match = stdout.match(/REG_SZ\s+(.+)/);
      resolve(match ? match[1].trim() : null);
    });
  });
}

async function cmdAutoStart() {
  const sub = process.argv[3];
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  const valueName = 'AgentHubStudio';
  const projectRoot = path.resolve(__dirname, '..');

  if (sub === 'enable') {
    const dataDir = path.join(projectRoot, 'workspace_data');
    const psScript = [
      `if (!(Test-Path '${dataDir}')) { $null = New-Item -ItemType Directory -Path '${dataDir}' -Force }`,
      `Start-Process -FilePath '${process.execPath}' -ArgumentList '${path.join(projectRoot, 'bin', 'workspace-cli.js')}','studio','--no-browser' -WorkingDirectory '${projectRoot}' -WindowStyle Hidden`,
    ].join('; ');
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const regCmd = `powershell -WindowStyle Hidden -EncodedCommand ${encoded}`;

    exec(`reg add "${key}" /v "${valueName}" /t REG_SZ /d "${regCmd}" /f`, (err) => {
      if (err) {
        console.error('Failed to enable auto-start:', err.message);
        process.exit(1);
      }
      console.log('Auto-start enabled — Agent Hub Studio will start silently on Windows boot');
      process.exit(0);
    });
  } else if (sub === 'disable') {
    exec(`reg delete "${key}" /v "${valueName}" /f`, (err) => {
      if (err && !err.message.includes('does not exist')) {
        console.error('Failed to disable auto-start:', err.message);
        process.exit(1);
      }
      console.log('Auto-start disabled');
      process.exit(0);
    });
  } else if (sub === 'status') {
    const val = await getRegistryValue(key, valueName);
    if (val) {
      console.log(`Auto-start: enabled (${val})`);
    } else {
      console.log('Auto-start: disabled');
    }
    process.exit(0);
  } else {
    console.log('Usage: agent-hub auto-start <enable|disable|status>');
    process.exit(1);
  }
}

async function cmdMigrate() {
  const force = process.argv.includes('--force');
  if (!force && !fs.existsSync(DB_PATH)) {
    log('migrate', 'No existing database found. Run "agent-hub init" first, or use --force');
    process.exit(1);
  }
  log('migrate', `Running database migrations on ${DB_PATH}...`);
  try {
    const schemaPath = path.join(ROOT, 'backend', 'prisma', 'schema.prisma');
    const backendDir = path.join(ROOT, 'backend');
    const env = { ...process.env, DATABASE_URL: `file:${DB_PATH}` };
    execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
      cwd: backendDir, stdio: 'inherit', env,
    });
    generatePrismaClient();
    log('migrate', 'Migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

async function main() {
  const subcommand = process.argv[2];
  if (!subcommand || subcommand === 'studio') {
    await cmdStudio();
  } else if (subcommand === 'init') {
    await cmdInit();
  } else if (subcommand === 'migrate') {
    await cmdMigrate();
  } else if (subcommand === 'auto-start') {
    await cmdAutoStart();
  } else if (subcommand === '--help' || subcommand === 'help') {
    console.log(`
  Agent Hub Studio — CLI

  Usage:
    agent-hub [studio]           Start Studio (server + dashboard)
    agent-hub studio --no-browser  Start server without opening browser
    agent-hub init               One-time setup (data dir, .env, migrations)
    agent-hub migrate            Apply pending DB migrations (safe update)
    agent-hub auto-start enable  Register Windows auto-start (run hidden)
    agent-hub auto-start disable  Remove Windows auto-start
    agent-hub auto-start status  Check auto-start status
    agent-hub --help             Show this help

  Data directory (default: auto-detected):
    --data-dir <path>            Set workspace data directory
    AGENT_HUB_DATA_DIR           Environment variable alternative

  Examples:
    agent-hub studio --data-dir "C:\\Users\\me\\agent-hub-data"
    `);
    process.exit(0);
  } else {
    console.log(`Unknown command: ${subcommand}`);
    console.log('Run "agent-hub --help" for usage');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
