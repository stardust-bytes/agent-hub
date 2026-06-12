import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const raw = await prisma.setting.findUnique({ where: { key: 'cowork.projects' } });
  if (!raw) {
    console.log('No saved projects found in Setting table. Nothing to migrate.');
    return;
  }

  let projects;
  try {
    projects = JSON.parse(raw.value);
  } catch {
    console.log('Invalid JSON in cowork.projects setting. Skipping.');
    return;
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    console.log('No projects to migrate.');
    return;
  }

  let migrated = 0;
  for (const p of projects) {
    const existing = await prisma.project.findUnique({ where: { path: p.path } });
    if (!existing) {
      await prisma.project.create({
        data: {
          id: p.id,
          name: p.name,
          path: p.path,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        },
      });
      migrated++;
    }
  }

  console.log(`Migrated ${migrated} of ${projects.length} projects to Project table.`);

  if (migrated > 0) {
    console.log('You can now safely delete the "cowork.projects" setting key.');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
