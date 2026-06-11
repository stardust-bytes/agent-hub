import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function capture(cmd) {
  return execSync(cmd, { cwd: projectRoot, encoding: 'utf8' });
}

function parseAlterAddColumn(sql) {
  const regex = /ALTER\s+TABLE\s+"(\w+)"\s+ADD\s+COLUMN\s+"(\w+)"/gi;
  const changes = [];
  let match;
  while ((match = regex.exec(sql)) !== null) {
    changes.push({ table: match[1], column: match[2] });
  }
  return changes;
}

function parseCreateTable(sql) {
  const regex = /CREATE\s+TABLE\s+"(\w+)"/gi;
  const tables = [];
  let match;
  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

async function checkColumnExists(prisma, table, column) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return rows.some(r => r.name === column);
}

async function checkTableExists(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table
  );
  return rows.length > 0;
}

// Step 1: Generate Prisma client
console.log('\n=== Step 1: Generate Prisma Client ===');
if (!run('npx prisma generate')) {
  console.error('FATAL: prisma generate failed');
  process.exit(1);
}

// Step 2: Try deploying migrations
console.log('\n=== Step 2: Deploy Migrations ===');
const deployOk = run('npx prisma migrate deploy');

if (deployOk) {
  console.log('\n=== Step 3: Seed Database ===');
  run('npx prisma db seed');
  console.log('\n✓ Setup complete');
  process.exit(0);
}

// Step 3: Auto-resolve failed migrations
console.log('\n⚠️  Migration deploy failed. Attempting auto-resolve...\n');

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

try {
  await prisma.$connect();

  const failedMigrations = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL`
  );

  if (failedMigrations.length === 0) {
    console.log(' No failed migrations found in _prisma_migrations table.');
    process.exit(1);
  }

  for (const row of failedMigrations) {
    const migrationName = row.migration_name;
    console.log(`  Checking: ${migrationName}`);

    const sqlPath = join(projectRoot, 'prisma', 'migrations', migrationName, 'migration.sql');
    let sql;
    try {
      sql = readFileSync(sqlPath, 'utf8');
    } catch {
      console.error(`  ✗ Cannot read migration file: ${sqlPath}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const addColumns = parseAlterAddColumn(sql);
    const createTables = parseCreateTable(sql);

    let allApplied = true;

    for (const { table, column } of addColumns) {
      const exists = await checkColumnExists(prisma, table, column);
      if (exists) {
        console.log(`  ✓ Column "${column}" already exists in "${table}"`);
      } else {
        console.error(`  ✗ Column "${column}" missing from "${table}" — needs manual fix`);
        allApplied = false;
      }
    }

    for (const table of createTables) {
      const exists = await checkTableExists(prisma, table);
      if (exists) {
        console.log(`  ✓ Table "${table}" already exists`);
      } else {
        console.error(`  ✗ Table "${table}" missing — needs manual fix`);
        allApplied = false;
      }
    }

    if (allApplied) {
      console.log(`  → Resolving ${migrationName}`);
      run(`npx prisma migrate resolve --applied ${migrationName}`);
    } else {
      console.error(`  Cannot auto-resolve ${migrationName}`);
      await prisma.$disconnect();
      process.exit(1);
    }
  }
} finally {
  await prisma.$disconnect();
}

// Step 4: Retry deploy
console.log('\n=== Retry: Deploy Migrations ===');
if (!run('npx prisma migrate deploy')) {
  console.error('FATAL: deploy still failing after auto-resolve');
  process.exit(1);
}

// Step 5: Seed
console.log('\n=== Final: Seed Database ===');
run('npx prisma db seed');

console.log('\n✓ Setup complete');
