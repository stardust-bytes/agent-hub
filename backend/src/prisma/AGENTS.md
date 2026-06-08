# prisma/ — Agent Context

Database access layer. The single source of truth for the SQLite connection and Prisma client lifecycle.

## Responsibility

- `PrismaService` — extends `PrismaClient`, manages `$connect` / `$disconnect` lifecycle.
- `PrismaModule` — `@Global()` NestJS module. Registers and **exports** `PrismaService` so every other module can inject it without re-importing `PrismaModule`.

## Files

```
prisma/
├── prisma.service.ts   — extends PrismaClient, onModuleInit/Destroy hooks
└── prisma.module.ts    — @Global(), provides + exports PrismaService
```

Schema lives one level up at `backend/prisma/schema.prisma` (outside `src/`).

## How to Use in Another Module

**Do not** import `PrismaModule` again — it is `@Global()`. Just inject `PrismaService`:

```ts
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SomeService {
  constructor(private readonly prisma: PrismaService) {}
}
```

## Current Prisma Schema

```prisma
model Setting {
  key   String @id
  value String
}

model KnowledgeFile {
  id         Int      @id @default(autoincrement())
  filename   String
  filepath   String
  size       Int
  mimeType   String
  status     String   @default("indexing")
  chunkCount Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Session {
  id        Int           @id @default(autoincrement())
  title     String        @default("New Session")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
}

model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String
  content   String
  toolName  String?
  isResult  Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Task {
  id          Int       @id @default(autoincrement())
  title       String
  description String?
  status      String    @default("TODO")
  priority    Int       @default(0)
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Provider {
  id        Int             @id @default(autoincrement())
  name      String
  type      String          @default("ollama")
  baseUrl   String?
  key       String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  models    ProviderModel[]
}

model ProviderModel {
  id         Int      @id @default(autoincrement())
  providerId Int
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime @default(now())
}
```

## Adding a New Model

1. Edit `backend/prisma/schema.prisma`.
2. Run: `npx prisma migrate dev --name <descriptive-name>`
3. Run: `npx prisma generate` (regenerates the Prisma client types).
4. Verify migration file was created in `backend/prisma/migrations/`.

## Rules

- **Never** instantiate `PrismaClient` directly inside a service. Always inject `PrismaService`.
- **No raw SQL** except the health-check ping in `app.controller.ts` (`$queryRaw\`SELECT 1\``). Use typed client methods everywhere else: `prisma.task.findMany()`, `prisma.task.create()`, etc.
- The `DATABASE_URL` env var points to `file:../workspace_data/dev.db` in production (Docker volume) and a local path in dev.

## Commands

```bash
npx prisma studio          # GUI to inspect/edit SQLite data
npx prisma migrate dev     # apply schema changes (creates migration file)
npx prisma generate        # regen client after schema edit (no new migration)
npx prisma db push         # sync schema without migration (dev-only shortcut)
```
