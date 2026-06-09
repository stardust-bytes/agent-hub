# AI Agent Workspace — Foundation Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully wired foundation skeleton: Docker Compose orchestrates a NestJS backend (SQLite via Prisma, stub agent, task CRUD) and a Vue 3 frontend (Cyberpunk Cyan 3-panel terminal UI) accessible at http://localhost:3000.

**Architecture:** Nginx container on port 3000 proxies `/api/*` to NestJS on internal port 3001 and serves the Vue SPA. NestJS uses Prisma with a SQLite file persisted in `./workspace_data`. The stub agent endpoint echoes messages; real Ollama integration is deferred to Phase 2.

**Tech Stack:** NestJS 10, Prisma 5, SQLite, Vue 3, Vite 4, TailwindCSS 3, marked 9, DOMPurify 3, Nginx alpine, Node 20 alpine, Docker Compose v2

---

## File Map

```
171305/
├── .gitignore
├── docker-compose.yml
├── workspace_data/.gitkeep
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── .env                          ← local dev only, gitignored
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── app.controller.ts         ← GET /api/health
│       ├── app.controller.spec.ts
│       ├── http-exception.filter.ts
│       ├── prisma/
│       │   ├── prisma.module.ts
│       │   └── prisma.service.ts
│       ├── tasks/
│       │   ├── tasks.module.ts
│       │   ├── tasks.service.ts
│       │   ├── tasks.service.spec.ts
│       │   ├── tasks.controller.ts
│       │   ├── tasks.controller.spec.ts
│       │   └── dto/
│       │       ├── create-task.dto.ts
│       │       └── update-task.dto.ts
│       └── agent/
│           ├── agent.module.ts
│           ├── agent.service.ts
│           ├── agent.service.spec.ts
│           ├── agent.controller.ts
│           └── agent.controller.spec.ts
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    └── src/
        ├── main.ts
        ├── App.vue
        ├── assets/main.css
        └── components/
            ├── AppShell.vue
            ├── SidebarNav.vue
            ├── ChatPanel.vue
            └── ArtifactsPanel.vue
```

---

## Task 1: Initialize Monorepo + Git

**Files:**
- Create: `.gitignore`
- Create: `workspace_data/.gitkeep`

- [ ] **Step 1: Initialize git and create root structure**

```bash
cd C:/Users/doanp/Documents/GitHub/171305
git init
mkdir -p workspace_data
echo "" > workspace_data/.gitkeep
mkdir -p backend/src frontend/src
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/

# Environment
.env
*.env.local

# Database / data
workspace_data/
*.db
*.db-journal

# Superpowers
.superpowers/

# Logs
*.log
npm-debug.log*

# Coverage
coverage/

# IDE
.idea/
.vscode/
*.suo

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Initial commit**

```bash
git add .gitignore workspace_data/.gitkeep docs/
git commit -m "chore: initialize monorepo with docs and gitignore"
```

---

## Task 2: Backend — Project Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env`
- Create: `backend/.env.example`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "workspace-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/mapped-types": "^2.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@prisma/client": "^5.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "jest": "^29.5.0",
    "prisma": "^5.0.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 3: Create `backend/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 4: Create `backend/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `backend/.env.example` and `backend/.env`**

`.env.example`:
```
DATABASE_URL=file:/app/data/dev.db
PORT=3001
```

`.env` (local dev, gitignored):
```
DATABASE_URL=file:./dev.db
PORT=3001
```

- [ ] **Step 6: Install dependencies**

```bash
cd backend
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit scaffold**

```bash
cd ..
git add backend/package.json backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/.env.example
git commit -m "chore(backend): scaffold NestJS project"
```

---

## Task 3: Backend — Prisma + PrismaModule

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`

- [ ] **Step 1: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
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
```

- [ ] **Step 2: Run migration to create dev.db**

```bash
cd backend
npx prisma migrate dev --name init
```

Expected output contains: `Your database is now in sync with your schema.` and creates `backend/dev.db` (local dev path).

- [ ] **Step 3: Create `backend/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Create `backend/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add backend/prisma/ backend/src/prisma/
git commit -m "feat(backend): add Prisma schema, migration, and PrismaModule"
```

---

## Task 4: Backend — Bootstrap + Health Endpoint

**Files:**
- Create: `backend/src/http-exception.filter.ts`
- Create: `backend/src/app.controller.ts`
- Create: `backend/src/app.controller.spec.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/main.ts`

- [ ] **Step 1: Write the failing test — `backend/src/app.controller.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
};

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get<AppController>(AppController);
  });

  it('health returns ok status with db and timestamp', async () => {
    const result = await controller.health();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('connected');
    expect(result.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npx jest app.controller.spec --no-coverage
```

Expected: FAIL — `Cannot find module './app.controller'`

- [ ] **Step 3: Create `backend/src/http-exception.filter.ts`**

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 4: Create `backend/src/app.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 5: Create `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 6: Create `backend/src/main.ts`**

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx jest app.controller.spec --no-coverage
```

Expected: PASS — `AppController › health returns ok status with db and timestamp`

- [ ] **Step 8: Smoke-test dev server**

```bash
npm run start:dev
```

In another terminal:
```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok","db":"connected","timestamp":"..."}`. Stop the server with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
cd ..
git add backend/src/main.ts backend/src/app.module.ts backend/src/app.controller.ts backend/src/app.controller.spec.ts backend/src/http-exception.filter.ts
git commit -m "feat(backend): add health endpoint, ValidationPipe, and HttpExceptionFilter"
```

---

## Task 5: Backend — TasksModule

**Files:**
- Create: `backend/src/tasks/dto/create-task.dto.ts`
- Create: `backend/src/tasks/dto/update-task.dto.ts`
- Create: `backend/src/tasks/tasks.service.ts`
- Create: `backend/src/tasks/tasks.service.spec.ts`
- Create: `backend/src/tasks/tasks.controller.ts`
- Create: `backend/src/tasks/tasks.controller.spec.ts`
- Create: `backend/src/tasks/tasks.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`backend/src/tasks/dto/create-task.dto.ts`:
```typescript
import { IsString, IsOptional, IsInt, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['TODO', 'PROCESSING', 'DONE', 'FAILED'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
```

`backend/src/tasks/dto/update-task.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

- [ ] **Step 2: Write the failing service test — `backend/src/tasks/tasks.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  task: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  it('findAll returns tasks ordered by createdAt desc', async () => {
    mockPrisma.task.findMany.mockResolvedValue([{ id: 1, title: 'Test' }]);
    const result = await service.findAll();
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(result).toEqual([{ id: 1, title: 'Test' }]);
  });

  it('create persists a task', async () => {
    const dto = { title: 'New task' };
    mockPrisma.task.create.mockResolvedValue({ id: 1, title: 'New task', status: 'TODO' });
    const result = await service.create(dto);
    expect(mockPrisma.task.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toMatchObject({ id: 1, title: 'New task' });
  });

  it('update throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.update(999, { title: 'x' })).rejects.toThrow(NotFoundException);
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });

  it('update patches task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 1, title: 'Old' });
    mockPrisma.task.update.mockResolvedValue({ id: 1, title: 'New' });
    const result = await service.update(1, { title: 'New' });
    expect(mockPrisma.task.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { title: 'New' } });
    expect(result).toMatchObject({ title: 'New' });
  });

  it('remove throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.task.delete).not.toHaveBeenCalled();
  });

  it('remove deletes task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.task.delete.mockResolvedValue({ id: 1 });
    await service.remove(1);
    expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
```

- [ ] **Step 3: Run service test to verify it fails**

```bash
cd backend
npx jest tasks.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './tasks.service'`

- [ ] **Step 4: Create `backend/src/tasks/tasks.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateTaskDto) {
    return this.prisma.task.create({ data: dto });
  }

  async update(id: number, dto: UpdateTaskDto) {
    await this.findOneOrFail(id);
    return this.prisma.task.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOneOrFail(id);
    return this.prisma.task.delete({ where: { id } });
  }

  private async findOneOrFail(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }
}
```

- [ ] **Step 5: Run service test to verify it passes**

```bash
npx jest tasks.service.spec --no-coverage
```

Expected: PASS — 6 tests passing.

- [ ] **Step 6: Write the failing controller test — `backend/src/tasks/tasks.controller.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 1, title: 'Test' }),
  update: jest.fn().mockResolvedValue({ id: 1, title: 'Updated' }),
  remove: jest.fn().mockResolvedValue({ id: 1 }),
};

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockService }],
    }).compile();
    controller = module.get<TasksController>(TasksController);
    jest.clearAllMocks();
  });

  it('findAll delegates to service', async () => {
    mockService.findAll.mockResolvedValue([{ id: 1 }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('create delegates to service with dto', async () => {
    const dto = { title: 'New' };
    await controller.create(dto as any);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('update delegates with id and dto', async () => {
    const dto = { title: 'Updated' };
    await controller.update(1, dto as any);
    expect(mockService.update).toHaveBeenCalledWith(1, dto);
  });

  it('remove delegates with id', async () => {
    await controller.remove(1);
    expect(mockService.remove).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 7: Run controller test to verify it fails**

```bash
npx jest tasks.controller.spec --no-coverage
```

Expected: FAIL — `Cannot find module './tasks.controller'`

- [ ] **Step 8: Create `backend/src/tasks/tasks.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
```

- [ ] **Step 9: Create `backend/src/tasks/tasks.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 10: Register TasksModule in `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 11: Run all backend tests**

```bash
npx jest --no-coverage
```

Expected: All tests pass. Count: at least 11 tests.

- [ ] **Step 12: Commit**

```bash
cd ..
git add backend/src/tasks/ backend/src/app.module.ts
git commit -m "feat(backend): add TasksModule with CRUD endpoints and tests"
```

---

## Task 6: Backend — AgentModule

**Files:**
- Create: `backend/src/agent/agent.service.ts`
- Create: `backend/src/agent/agent.service.spec.ts`
- Create: `backend/src/agent/agent.controller.ts`
- Create: `backend/src/agent/agent.controller.spec.ts`
- Create: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write the failing service test — `backend/src/agent/agent.service.spec.ts`**

```typescript
import { AgentService } from './agent.service';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
  });

  it('mockReply echoes message in stub format', () => {
    const reply = service.mockReply('hello world');
    expect(reply).toBe('[stub] Received: hello world. Ollama integration coming in Phase 2.');
  });

  it('mockReply handles empty string', () => {
    const reply = service.mockReply('');
    expect(reply).toBe('[stub] Received: . Ollama integration coming in Phase 2.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npx jest agent.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './agent.service'`

- [ ] **Step 3: Create `backend/src/agent/agent.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentService {
  mockReply(message: string): string {
    return `[stub] Received: ${message}. Ollama integration coming in Phase 2.`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest agent.service.spec --no-coverage
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Write the failing controller test — `backend/src/agent/agent.controller.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

const mockService = {
  mockReply: jest.fn().mockReturnValue('[stub] Received: hi. Ollama integration coming in Phase 2.'),
};

describe('AgentController', () => {
  let controller: AgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: mockService }],
    }).compile();
    controller = module.get<AgentController>(AgentController);
    jest.clearAllMocks();
  });

  it('chat returns reply and timestamp', async () => {
    mockService.mockReply.mockReturnValue('[stub] Received: hi.');
    const result = await controller.chat({ message: 'hi' });
    expect(result.reply).toBe('[stub] Received: hi.');
    expect(result.timestamp).toBeDefined();
    expect(mockService.mockReply).toHaveBeenCalledWith('hi');
  });
});
```

- [ ] **Step 6: Run controller test to verify it fails**

```bash
npx jest agent.controller.spec --no-coverage
```

Expected: FAIL — `Cannot find module './agent.controller'`

- [ ] **Step 7: Create `backend/src/agent/agent.controller.ts`**

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AgentService } from './agent.service';

class ChatDto {
  @IsString()
  message: string;
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    return {
      reply: this.agentService.mockReply(dto.message),
      timestamp: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 8: Create `backend/src/agent/agent.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';

@Module({
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
```

- [ ] **Step 9: Register AgentModule in `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    AgentModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 10: Run all backend tests**

```bash
npx jest --no-coverage
```

Expected: All tests pass. Count: at least 14 tests.

- [ ] **Step 11: Commit**

```bash
cd ..
git add backend/src/agent/ backend/src/app.module.ts
git commit -m "feat(backend): add AgentModule with stub chat endpoint and tests"
```

---

## Task 7: Backend — Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

- [ ] **Step 2: Verify Docker build (optional, requires Docker)**

```bash
cd backend
docker build -t workspace-backend-test .
```

Expected: Build completes with no errors. If Docker is not available, skip to Step 3.

- [ ] **Step 3: Commit**

```bash
cd ..
git add backend/Dockerfile
git commit -m "feat(backend): add multi-stage Dockerfile"
```

---

## Task 8: Frontend — Project Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/assets/main.css`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "workspace-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "dompurify": "^3.0.0",
    "marked": "^9.0.0",
    "vue": "^3.3.0"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.0",
    "@vitejs/plugin-vue": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.1.0",
    "vite": "^4.4.0",
    "vue-tsc": "^1.8.0"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
})
```

- [ ] **Step 4: Create `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'cyber-bg':     '#0a0e1a',
        'cyber-dark':   '#060911',
        'cyber-accent': '#00d4ff',
        'cyber-border': 'rgba(0, 212, 255, 0.13)',
        'cyber-dim':    'rgba(0, 212, 255, 0.33)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: Create `frontend/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Workspace</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/src/assets/main.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: #0a0e1a;
  color: #e2e8f0;
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: #060911;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 255, 0.2);
  border-radius: 2px;
}
```

- [ ] **Step 8: Create `frontend/src/main.ts`**

```typescript
import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 9: Create `frontend/src/App.vue`**

```vue
<template>
  <AppShell />
</template>

<script setup lang="ts">
import AppShell from './components/AppShell.vue'
</script>
```

- [ ] **Step 10: Install dependencies**

```bash
cd frontend
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 11: Commit**

```bash
cd ..
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/tailwind.config.ts frontend/postcss.config.js frontend/index.html frontend/src/main.ts frontend/src/App.vue frontend/src/assets/
git commit -m "chore(frontend): scaffold Vue 3 + Vite + TailwindCSS project"
```

---

## Task 9: Frontend — AppShell + SidebarNav

**Files:**
- Create: `frontend/src/components/AppShell.vue`
- Create: `frontend/src/components/SidebarNav.vue`

- [ ] **Step 1: Create stub placeholders for ChatPanel and ArtifactsPanel**

These stubs allow AppShell to render immediately. Tasks 10 and 11 overwrite them with real implementations.

`frontend/src/components/ChatPanel.vue` (stub):
```vue
<template>
  <div class="flex flex-col bg-cyber-bg items-center justify-center text-cyber-accent/30 text-sm font-mono">
    ◈ Chat panel — coming in Task 10
  </div>
</template>
<script setup lang="ts">
defineEmits<{ lastMessage: [content: string] }>()
</script>
```

`frontend/src/components/ArtifactsPanel.vue` (stub):
```vue
<template>
  <div class="flex flex-col bg-cyber-bg items-center justify-center text-cyber-accent/30 text-sm font-mono">
    ◈ Artifacts panel — coming in Task 11
  </div>
</template>
<script setup lang="ts">
defineProps<{ lastMessage: string }>()
</script>
```

- [ ] **Step 2: Create `frontend/src/components/SidebarNav.vue`**

```vue
<template>
  <nav class="w-[52px] bg-cyber-dark border-r border-cyber-border flex flex-col items-center py-3 gap-2 shrink-0">
    <div class="text-cyber-accent text-lg mb-2 font-mono" style="text-shadow: 0 0 8px #00d4ff">◈</div>

    <button
      v-for="item in navItems"
      :key="item.view"
      :title="item.label"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-9 h-9 rounded flex items-center justify-center text-base transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 border border-cyber-dim text-cyber-accent'
          : 'border border-transparent text-cyber-accent/40 hover:text-cyber-accent/70'
      ]"
    >
      {{ item.icon }}
    </button>

    <div class="flex-1" />

    <button
      title="Settings"
      class="w-9 h-9 rounded flex items-center justify-center text-base border border-transparent text-cyber-accent/40 hover:text-cyber-accent/70"
    >
      ⚙️
    </button>

    <div
      :title="healthStatus"
      :class="['w-2 h-2 rounded-full mt-1 transition-colors duration-500', isHealthy ? 'bg-cyber-accent' : 'bg-red-500']"
      :style="isHealthy ? 'box-shadow: 0 0 6px #00d4ff' : ''"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineProps<{ activeView: string }>()
defineEmits<{ navigate: [view: string] }>()

const navItems = [
  { view: 'chat',  label: 'Chat',  icon: '💬' },
  { view: 'tasks', label: 'Tasks', icon: '📋' },
  { view: 'files', label: 'Files', icon: '📁' },
]

const isHealthy = ref(false)
const healthStatus = ref('Checking backend...')

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    isHealthy.value = data.status === 'ok'
    healthStatus.value = `Backend: ${data.status} · DB: ${data.db}`
  } catch {
    healthStatus.value = 'Backend unreachable'
  }
})
</script>
```

- [ ] **Step 3: Create `frontend/src/components/AppShell.vue`**

```vue
<template>
  <div class="flex h-screen bg-cyber-bg font-mono overflow-hidden">
    <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
    <ChatPanel
      class="border-r border-cyber-border"
      style="width: 45%"
      @last-message="lastAgentMessage = $event"
    />
    <ArtifactsPanel class="flex-1" :last-message="lastAgentMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'

const activeView = ref<'chat' | 'tasks' | 'files'>('chat')
const lastAgentMessage = ref('')
</script>
```

- [ ] **Step 4: Verify — start dev server and inspect layout**

Start the NestJS backend in one terminal:
```bash
cd backend && npm run start:dev
```

Start Vite in another terminal:
```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` in a browser.

Expected:
- Dark `#0a0e1a` background fills viewport
- Left sidebar (52px): `◈` logo + nav icons + settings + health dot
- Health dot is red (backend may not be fully ready) then turns cyan after a moment
- No console errors about missing components

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/components/
git commit -m "feat(frontend): add AppShell 3-panel layout, SidebarNav with health dot, and component stubs"
```

---

## Task 10: Frontend — ChatPanel

**Files:**
- Create: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Create `frontend/src/components/ChatPanel.vue`**

```vue
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">◈ AGENT CHAT</span>
      <span class="text-cyber-accent/40 text-xs font-mono">stub mode</span>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">
        <div class="text-xs mb-1" :class="roleColor(msg.role)">
          {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
        </div>
        <div
          class="text-sm leading-relaxed break-words"
          :class="{
            'text-cyber-accent/50': msg.role === 'system',
            'text-slate-300': msg.role === 'agent',
            'text-slate-100': msg.role === 'user',
          }"
        >
          {{ msg.content }}<span v-if="msg.typing" class="animate-blink text-cyber-accent ml-px">█</span>
        </div>
      </div>
    </div>

    <div class="px-3 py-2 border-t border-cyber-border bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 border border-cyber-dim rounded px-3 py-2">
        <span class="text-cyber-accent text-sm font-mono">$</span>
        <input
          v-model="input"
          class="flex-1 bg-transparent text-slate-100 text-sm outline-none font-mono placeholder-cyber-accent/30"
          placeholder="type a command or question_"
          :disabled="loading"
          autocomplete="off"
          spellcheck="false"
        />
        <span v-if="!loading" class="animate-blink text-cyber-accent text-sm">█</span>
        <span v-else class="text-cyber-accent/50 text-xs">…</span>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface Message {
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: string
  typing?: boolean
}

const emit = defineEmits<{ lastMessage: [content: string] }>()

const messages = ref<Message[]>([
  {
    role: 'system',
    content: 'Agent initialized. SQLite connected. Stub mode active.',
    timestamp: now(),
  },
])
const input = ref('')
const loading = ref(false)
const messagesEl = ref<HTMLElement | null>(null)

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return '$ user'
  if (role === 'agent') return '▶ agent'
  return '[system]'
}

function roleColor(role: string): string {
  if (role === 'user') return 'text-cyber-accent/60'
  if (role === 'agent') return 'text-cyber-accent'
  return 'text-cyber-accent/40'
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

async function submit() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  loading.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(err.message ?? `HTTP ${res.status}`)
    }

    const data: { reply: string; timestamp: string } = await res.json()
    await typewriterAppend(data.reply)
    emit('lastMessage', data.reply)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    messages.value.push({
      role: 'system',
      content: `[error] ${msg}. Is the backend running?`,
      timestamp: now(),
    })
    await scrollToBottom()
  } finally {
    loading.value = false
  }
}

async function typewriterAppend(fullText: string) {
  const msg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
  messages.value.push(msg)
  await scrollToBottom()

  for (const char of fullText) {
    msg.content += char
    await new Promise<void>(resolve => setTimeout(resolve, 18))
    await scrollToBottom()
  }
  msg.typing = false
}
</script>
```

- [ ] **Step 2: Verify — send a message in the browser**

With both servers running from Task 9 (`npm run start:dev` + `npm run dev`), open `http://localhost:5173`:

1. Type any text in the input and press Enter
2. Expected: message appears as `$ user`, then agent reply types in character by character with `[stub] Received: ...` text
3. Check: no console errors

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/components/ChatPanel.vue
git commit -m "feat(frontend): add ChatPanel with typewriter effect and error handling"
```

---

## Task 11: Frontend — ArtifactsPanel

**Files:**
- Create: `frontend/src/components/ArtifactsPanel.vue`

- [ ] **Step 1: Create `frontend/src/components/ArtifactsPanel.vue`**

```vue
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">◈ ARTIFACTS</span>
      <span v-if="lastMessage" class="text-cyber-accent/40 text-xs font-mono">last reply</span>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      <div
        v-if="!lastMessage"
        class="flex items-center justify-center h-full text-cyber-accent/30 text-sm font-mono"
      >
        ◈ No artifacts yet
      </div>

      <template v-else>
        <div v-for="(block, i) in codeBlocks" :key="`code-${i}`" class="mb-3">
          <div class="bg-cyber-dark border border-cyber-border rounded overflow-hidden">
            <div class="px-3 py-1 border-b border-cyber-border text-cyber-accent/50 text-xs font-mono">
              {{ block.lang || 'code' }}
            </div>
            <pre class="px-3 py-2 text-xs text-slate-300 overflow-x-auto leading-relaxed font-mono">{{ block.code }}</pre>
          </div>
        </div>

        <div
          v-if="proseHtml"
          class="text-sm text-slate-300 leading-relaxed font-mono prose-invert"
          v-html="proseHtml"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{ lastMessage: string }>()

interface CodeBlock {
  lang: string
  code: string
}

const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g

const codeBlocks = computed<CodeBlock[]>(() => {
  if (!props.lastMessage) return []
  const blocks: CodeBlock[] = []
  const re = new RegExp(CODE_FENCE_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(props.lastMessage)) !== null) {
    blocks.push({ lang: match[1] ?? '', code: match[2].trimEnd() })
  }
  return blocks
})

const proseHtml = computed<string>(() => {
  if (!props.lastMessage) return ''
  const prose = props.lastMessage.replace(new RegExp(CODE_FENCE_RE.source, 'g'), '').trim()
  if (!prose) return ''
  const raw = marked.parse(prose) as string
  return DOMPurify.sanitize(raw)
})
</script>
```

- [ ] **Step 2: Verify — artifacts panel renders correctly**

With both servers running, open `http://localhost:5173`:

1. Before sending a message: right panel shows `◈ No artifacts yet`
2. Send a message → agent stub reply appears → right panel shows `last reply` badge and renders the plain text via marked
3. No console errors about DOMPurify or marked

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/components/ArtifactsPanel.vue
git commit -m "feat(frontend): add ArtifactsPanel with code block extraction and DOMPurify rendering"
```

---

## Task 12: Frontend — Nginx Config + Dockerfile

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://workspace-backend:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /socket.io/ {
        proxy_pass http://workspace-backend:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/nginx.conf frontend/Dockerfile
git commit -m "feat(frontend): add Nginx config and multi-stage Dockerfile"
```

---

## Task 13: Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
version: '3.9'

services:
  workspace-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: workspace-backend
    environment:
      DATABASE_URL: file:/app/data/dev.db
      PORT: 3001
    volumes:
      - ./workspace_data:/app/data
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped

  workspace-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: workspace-frontend
    ports:
      - "3000:80"
    depends_on:
      workspace-backend:
        condition: service_healthy
    restart: unless-stopped
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Docker Compose orchestration"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Build and start all containers**

```bash
docker compose up --build
```

Wait for output: `workspace-frontend` container starts (after `workspace-backend` passes healthcheck). This typically takes 60-90 seconds on first build.

- [ ] **Step 2: Verify Vue app loads and sidebar health dot turns cyan**

Open `http://localhost:3000` in browser.

Expected:
- Dark `#0a0e1a` background, Cyberpunk Cyan 3-panel layout
- Sidebar dot turns cyan (◈) within a few seconds
- System message: `Agent initialized. SQLite connected. Stub mode active.`
- Right panel shows `◈ No artifacts yet`

- [ ] **Step 3: Verify health endpoint**

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{"status":"ok","db":"connected","timestamp":"2026-06-07T..."}
```

- [ ] **Step 4: Verify tasks endpoint — empty list**

```bash
curl http://localhost:3000/api/tasks
```

Expected: `[]`

- [ ] **Step 5: Create a task**

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Test task from curl\"}"
```

Expected:
```json
{"id":1,"title":"Test task from curl","description":null,"status":"TODO","priority":0,"dueDate":null,"createdAt":"...","updatedAt":"..."}
```

- [ ] **Step 6: Verify task persisted**

```bash
curl http://localhost:3000/api/tasks
```

Expected: Array with the task from Step 5.

- [ ] **Step 7: Verify agent chat via browser**

In the browser at `http://localhost:3000`, type a message in the chat input and press Enter.

Expected:
- User message appears immediately
- Agent reply types in character by character: `[stub] Received: <your message>. Ollama integration coming in Phase 2.`
- Artifacts panel updates to show `last reply` header

- [ ] **Step 8: Verify data persistence across container restart**

```bash
docker compose restart workspace-backend
```

Wait ~15 seconds for healthcheck to pass, then:

```bash
curl http://localhost:3000/api/tasks
```

Expected: The task created in Step 5 is still there (SQLite file persisted in `./workspace_data/dev.db`).

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "chore: verify foundation skeleton — all services running end-to-end"
```

---

## Verification Summary

| Check | Command | Expected |
|---|---|---|
| App loads | Browser → http://localhost:3000 | 3-panel UI, dot turns cyan |
| Health | `curl .../api/health` | `{"status":"ok","db":"connected",...}` |
| Tasks list | `curl .../api/tasks` | `[]` |
| Create task | POST with title | Task object with id |
| Agent chat | Browser input | Typewriter stub reply |
| Persistence | Restart + GET tasks | Task still exists |
| Dev mode | `npm run start:dev` + `npm run dev` | Same behavior at :5173 |
