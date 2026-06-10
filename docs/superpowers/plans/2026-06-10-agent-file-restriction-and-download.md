# Agent File Restriction & Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict agent file access to workspace_data + cowork project only, and add file download API for workspace_data files.

**Architecture:** Remove `process.cwd()` from allowed paths and context. Add `AgentFile` model + controller for download. Modify `write_file` executor to return download URL for workspace_data files.

**Tech Stack:** NestJS, Prisma, SQLite

---

## File Structure

### Backend — Modify:
- `backend/prisma/schema.prisma` — add `AgentFile` model
- `backend/src/workspace/workspace.service.ts` — remove `process.cwd()` from allowedPaths
- `backend/src/workspace/workspace.service.spec.ts` — update test
- `backend/src/agent/services/context-builder.service.ts` — remove cwd/userHome from system prompt
- `backend/src/tools/executors/write-file.executor.ts` — inject PrismaService + WorkspaceService, check workspaceRoot, return download URL
- `backend/src/app.module.ts` — import FilesModule

### Backend — Create:
- `backend/src/files/files.module.ts`
- `backend/src/files/files.controller.ts`

---

### Task 1: Add AgentFile model to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add AgentFile model**

Add after the `PlanStep` model:

```prisma
model AgentFile {
  id          Int      @id @default(autoincrement())
  filename    String
  path        String
  sessionId   Int
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 2: Run Prisma migration**

```bash
npx prisma migrate dev --name add-agent-file
npx prisma generate
```

Expected: Migration applied, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add AgentFile model for file registry"
```

---

### Task 2: Remove process.cwd() from allowed paths

**Files:**
- Modify: `backend/src/workspace/workspace.service.ts`
- Modify: `backend/src/workspace/workspace.service.spec.ts`

- [ ] **Step 1: Remove cwd from allowedPaths**

In `backend/src/workspace/workspace.service.ts`, remove this line:

```ts
path.resolve(process.cwd()),
```

- [ ] **Step 2: Update test**

In `backend/src/workspace/workspace.service.spec.ts`, change the cwd test:

```ts
it('isPathAllowed rejects process.cwd() by default', () => {
  expect(service.isPathAllowed(process.cwd())).toBe(false);
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest backend/src/workspace/workspace.service.spec.ts --verbose`
Expected: all 8 tests pass (cwd test now asserts `false`)

- [ ] **Step 4: Commit**

```bash
git add backend/src/workspace/workspace.service.ts backend/src/workspace/workspace.service.spec.ts
git commit -m "fix: remove process.cwd() from allowed paths"
```

---

### Task 3: Remove cwd and userHome from system prompt

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Remove cwd and userHome lines**

In `backend/src/agent/services/context-builder.service.ts`, find and remove these lines:

```ts
`  Current Working Directory: ${process.cwd()}`,
`  User Home: ${process.env.USERPROFILE || process.env.HOME || '(unknown)'}`,
```

The system prompt section should now look like:

```ts
'System Environment:',
`  Platform: ${process.platform}`,
```

- [ ] **Step 2: Run tests**

Run: `npx jest --passWithNoTests`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "fix: remove cwd and userHome from agent system prompt"
```

---

### Task 4: Create FilesModule with download controller

**Files:**
- Create: `backend/src/files/files.module.ts`
- Create: `backend/src/files/files.controller.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create files module**

Create `backend/src/files/files.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
})
export class FilesModule {}
```

- [ ] **Step 2: Create files controller**

Create `backend/src/files/files.controller.ts`:

```ts
import { Controller, Get, Param, ParseIntPipe, NotFoundException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('files')
export class FilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('agent/:id/download')
  async downloadAgentFile(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    const agentFile = await this.prisma.agentFile.findUnique({ where: { id } });
    if (!agentFile) throw new NotFoundException('File not found');

    const resolved = path.resolve(agentFile.path);
    if (!fs.existsSync(resolved)) throw new NotFoundException('File not found on disk');

    const stat = fs.statSync(resolved);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${agentFile.filename}"`,
      'Content-Length': stat.size,
    });

    return new StreamableFile(fs.createReadStream(resolved));
  }
}
```

- [ ] **Step 3: Register FilesModule in AppModule**

In `backend/src/app.module.ts`, add import and add to `imports` array:

```ts
import { FilesModule } from './files/files.module';
```

```ts
FilesModule,
```

- [ ] **Step 4: Run tests**

Run: `npx jest --passWithNoTests`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/files/ backend/src/app.module.ts
git commit -m "feat: add FilesModule with agent file download endpoint"
```

---

### Task 5: Update write_file executor to return download URL

**Files:**
- Modify: `backend/src/tools/executors/write-file.executor.ts`

- [ ] **Step 1: Update executor**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, sessionId?: number): Promise<string> {
    const filePath = args.path as string | undefined;
    const content = args.content as string | undefined;
    if (!filePath || content === undefined) return 'Error: path and content are required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      const filename = resolved.split(/[\\/]/).pop() || 'file';
      const workspaceRoot = this.workspace.getWorkspaceRoot();
      if (resolved.startsWith(workspaceRoot)) {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: resolved, sessionId: 0 },
        });
        return `Written ${bytesWritten} bytes. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return `Written ${bytesWritten} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

Note: The `ToolExecutor` interface defines `execute(args: Record<string, unknown>): Promise<string>` — it doesn't pass sessionId. We keep the existing interface signature. The `sessionId` field in `AgentFile` is stored as `0` for now (doesn't affect download functionality).

- [ ] **Step 2: Run tests**

Run: `npx jest --passWithNoTests`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/tools/executors/write-file.executor.ts
git commit -m "feat: write_file returns download URL for workspace_data files"
```

---

### Task 6: Update AGENTS.md

**Files:**
- Create: `backend/src/files/AGENTS.md`
- Modify: `backend/src/agent/AGENTS.md`

- [ ] **Step 1: Create files AGENTS.md**

```markdown
# files/ — Agent Context

File download module. Serves agent-created files via download URL.

## Files

```
files/
├── files.module.ts
└── files.controller.ts
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/files/agent/:id/download` | Download agent-created file by ID |

## Dependencies

- PrismaService (AgentFile queries)
```

- [ ] **Step 2: Update agent AGENTS.md**

Add to tools list:
- `write_file` — also registers files in workspace_data for download

- [ ] **Step 3: Commit**

```bash
git add backend/src/files/AGENTS.md backend/src/agent/AGENTS.md
git commit -m "docs: update AGENTS.md with files module"
```
