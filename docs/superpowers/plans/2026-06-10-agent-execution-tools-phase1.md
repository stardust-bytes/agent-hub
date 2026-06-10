# Agent Execution Tools — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 filesystem/shell executors (`write_file`, `read_file`, `list_directory`, `run_command`) to the existing ToolRegistry so the agent can create files, read files, list directories, and run shell commands.

**Architecture:** Each executor implements the existing `ToolExecutor` interface (`name` + `execute(args)` → `Promise<string>`). Executors are registered in `ToolsModule`, injected into `AgentLoopService`, and seeded in `prisma/seed.ts`. Paths are validated against allowed directories using realpath prefix check.

**Tech Stack:** NestJS 10, TypeScript, Node.js built-in `fs/promises`, `path`, `child_process`. Jest for testing.

---

## File Structure

```
backend/src/tools/executors/
├── write-file.executor.ts        — Create
├── write-file.executor.spec.ts   — Create
├── read-file.executor.ts         — Create
├── read-file.executor.spec.ts    — Create
├── list-directory.executor.ts    — Create
├── list-directory.executor.spec.ts — Create
├── run-command.executor.ts       — Create
├── run-command.executor.spec.ts  — Create

backend/src/tools/tools.module.ts — Modify (register executors)
backend/prisma/seed.ts            — Modify (add tool definitions)
```

---

### Task 1: WriteFileExecutor

**Files:**
- Create: `backend/src/tools/executors/write-file.executor.spec.ts`
- Create: `backend/src/tools/executors/write-file.executor.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tools/executors/write-file.executor.spec.ts
import { WriteFileExecutor } from './write-file.executor'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('WriteFileExecutor', () => {
  let executor: WriteFileExecutor
  let tmpDir: string

  beforeEach(async () => {
    executor = new WriteFileExecutor()
    tmpDir = path.join(os.tmpdir(), `write-file-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes content to a file', async () => {
    const filePath = path.join(tmpDir, 'test.txt')
    const result = await executor.execute({ path: filePath, content: 'hello world' })
    expect(result).toMatch(/Written/)
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('hello world')
  })

  it('creates parent directories', async () => {
    const filePath = path.join(tmpDir, 'sub', 'nested', 'test.txt')
    const result = await executor.execute({ path: filePath, content: 'nested' })
    expect(result).toMatch(/Written/)
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('nested')
  })

  it('rejects path outside allowed directories', async () => {
    const result = await executor.execute({ path: '/etc/passwd', content: 'hack' })
    expect(result).toMatch(/Error/)
  })

  it('returns error for missing args', async () => {
    const result = await executor.execute({} as any)
    expect(result).toMatch(/Error/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tools/executors/write-file.executor.spec.ts --no-coverage`
Expected: FAIL — "WriteFileExecutor not defined" (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/tools/executors/write-file.executor.ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import * as path from 'path'
import * as fs from 'fs/promises'

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file'

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined
    const content = args.content as string | undefined
    if (!filePath || content === undefined) return 'Error: path and content are required.'
    if (!this.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`
    try {
      const resolved = path.resolve(filePath)
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      await fs.writeFile(resolved, content, 'utf-8')
      return `Written ${Buffer.byteLength(content, 'utf-8')} bytes to ${resolved}`
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const allowed = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [path.resolve('./workspace_data')]
    const resolved = path.resolve(filePath)
    return allowed.some(dir => resolved.startsWith(dir))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tools/executors/write-file.executor.spec.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/write-file.executor.ts backend/src/tools/executors/write-file.executor.spec.ts
git commit -m "feat: add WriteFileExecutor for agent file creation"
```

---

### Task 2: ReadFileExecutor

**Files:**
- Create: `backend/src/tools/executors/read-file.executor.spec.ts`
- Create: `backend/src/tools/executors/read-file.executor.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tools/executors/read-file.executor.spec.ts
import { ReadFileExecutor } from './read-file.executor'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('ReadFileExecutor', () => {
  let executor: ReadFileExecutor
  let tmpDir: string

  beforeEach(async () => {
    executor = new ReadFileExecutor()
    tmpDir = path.join(os.tmpdir(), `read-file-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('reads existing file content', async () => {
    const filePath = path.join(tmpDir, 'test.txt')
    await fs.writeFile(filePath, 'hello world', 'utf-8')
    const result = await executor.execute({ path: filePath })
    expect(result).toBe('hello world')
  })

  it('returns error for non-existent file', async () => {
    const result = await executor.execute({ path: path.join(tmpDir, 'nope.txt') })
    expect(result).toMatch(/Error/)
  })

  it('rejects path outside allowed directories', async () => {
    const result = await executor.execute({ path: '/etc/passwd' })
    expect(result).toMatch(/Error/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tools/executors/read-file.executor.spec.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/tools/executors/read-file.executor.ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import * as path from 'path'
import * as fs from 'fs/promises'

const MAX_READ_SIZE = 100 * 1024

@Injectable()
export class ReadFileExecutor implements ToolExecutor {
  readonly name = 'read_file'

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined
    if (!filePath) return 'Error: path is required.'
    if (!this.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`
    try {
      const resolved = path.resolve(filePath)
      const stat = await fs.stat(resolved)
      if (!stat.isFile()) return `Error: "${resolved}" is not a file.`
      if (stat.size > MAX_READ_SIZE) return `Error: File too large (${stat.size} bytes, max ${MAX_READ_SIZE}).`
      return await fs.readFile(resolved, 'utf-8')
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const allowed = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [path.resolve('./workspace_data')]
    const resolved = path.resolve(filePath)
    return allowed.some(dir => resolved.startsWith(dir))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tools/executors/read-file.executor.spec.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/read-file.executor.ts backend/src/tools/executors/read-file.executor.spec.ts
git commit -m "feat: add ReadFileExecutor for agent file reading"
```

---

### Task 3: ListDirectoryExecutor

**Files:**
- Create: `backend/src/tools/executors/list-directory.executor.spec.ts`
- Create: `backend/src/tools/executors/list-directory.executor.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tools/executors/list-directory.executor.spec.ts
import { ListDirectoryExecutor } from './list-directory.executor'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

describe('ListDirectoryExecutor', () => {
  let executor: ListDirectoryExecutor
  let tmpDir: string

  beforeEach(async () => {
    executor = new ListDirectoryExecutor()
    tmpDir = path.join(os.tmpdir(), `list-dir-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'a', 'utf-8')
    await fs.writeFile(path.join(tmpDir, 'b.txt'), 'bb', 'utf-8')
    await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('lists files and directories', async () => {
    const result = await executor.execute({ path: tmpDir })
    expect(result).toContain('a.txt')
    expect(result).toContain('b.txt')
    expect(result).toContain('sub')
  })

  it('returns error for non-existent directory', async () => {
    const result = await executor.execute({ path: '/nonexistent/path' })
    expect(result).toMatch(/Error/)
  })

  it('rejects path outside allowed directories', async () => {
    const result = await executor.execute({ path: '/etc' })
    expect(result).toMatch(/Error/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tools/executors/list-directory.executor.spec.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/tools/executors/list-directory.executor.ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import * as path from 'path'
import * as fs from 'fs/promises'

@Injectable()
export class ListDirectoryExecutor implements ToolExecutor {
  readonly name = 'list_directory'

  async execute(args: Record<string, unknown>): Promise<string> {
    const dirPath = args.path as string | undefined
    if (!dirPath) return 'Error: path is required.'
    if (!this.isPathAllowed(dirPath)) return `Error: path "${dirPath}" is not allowed.`
    try {
      const resolved = path.resolve(dirPath)
      const entries = await fs.readdir(resolved, { withFileTypes: true })
      const lines = entries.map(e => {
        const isDir = e.isDirectory() ? 'd' : '-'
        return `${isDir} ${e.name}`
      })
      return lines.join('\n')
    } catch (e) {
      return `Error listing directory: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  }

  private isPathAllowed(filePath: string): boolean {
    const allowed = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [path.resolve('./workspace_data')]
    const resolved = path.resolve(filePath)
    return allowed.some(dir => resolved.startsWith(dir))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tools/executors/list-directory.executor.spec.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/list-directory.executor.ts backend/src/tools/executors/list-directory.executor.spec.ts
git commit -m "feat: add ListDirectoryExecutor for agent directory listing"
```

---

### Task 4: RunCommandExecutor

**Files:**
- Create: `backend/src/tools/executors/run-command.executor.spec.ts`
- Create: `backend/src/tools/executors/run-command.executor.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tools/executors/run-command.executor.spec.ts
import { RunCommandExecutor } from './run-command.executor'
import * as path from 'path'
import * as os from 'os'

describe('RunCommandExecutor', () => {
  let executor: RunCommandExecutor
  let tmpDir: string

  beforeEach(() => {
    executor = new RunCommandExecutor()
    tmpDir = path.join(os.tmpdir(), `run-cmd-test-${Date.now()}`)
  })

  it('executes a command and returns stdout', async () => {
    const result = await executor.execute({ command: 'echo hello'})
    expect(result).toContain('hello')
  })

  it('returns error for empty command', async () => {
    const result = await executor.execute({ command: '' })
    expect(result).toMatch(/Error/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tools/executors/run-command.executor.spec.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/tools/executors/run-command.executor.ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { exec } from 'child_process'
import { promisify } from 'util'

const asyncExec = promisify(exec)
const MAX_OUTPUT_SIZE = 10 * 1024
const TIMEOUT_MS = 30_000

@Injectable()
export class RunCommandExecutor implements ToolExecutor {
  readonly name = 'run_command'

  async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command as string | undefined
    const cwd = (args.cwd as string) || process.cwd()
    if (!command || command.trim().length === 0) return 'Error: command is required.'
    try {
      const { stdout, stderr } = await asyncExec(command, {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_SIZE,
      })
      let output = stdout || ''
      if (stderr) output += '\n--- stderr ---\n' + stderr
      if (output.length > MAX_OUTPUT_SIZE) output = output.slice(0, MAX_OUTPUT_SIZE) + '\n...(truncated)'
      return output || '(no output)'
    } catch (e: any) {
      if (e.stdout) return e.stdout
      if (e.stderr) return e.stderr
      return `Error: ${e.message || 'Unknown error'}`
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tools/executors/run-command.executor.spec.ts --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/run-command.executor.ts backend/src/tools/executors/run-command.executor.spec.ts
git commit -m "feat: add RunCommandExecutor for agent shell command execution"
```

---

### Task 5: Register executors in ToolsModule + AgentLoopService + Seed

**Files:**
- Modify: `backend/src/tools/tools.module.ts`
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Register 4 new executors in tools.module.ts**

```ts
// backend/src/tools/tools.module.ts (add imports and EXECUTORS array)
import { WriteFileExecutor } from './executors/write-file.executor'
import { ReadFileExecutor } from './executors/read-file.executor'
import { ListDirectoryExecutor } from './executors/list-directory.executor'
import { RunCommandExecutor } from './executors/run-command.executor'

// Add to EXECUTORS array:
  WriteFileExecutor,
  ReadFileExecutor,
  ListDirectoryExecutor,
  RunCommandExecutor,
```

- [ ] **Step 2: Add tool seed data in prisma/seed.ts**

Add these 4 entries to the `DEFAULT_TOOLS` array:
```ts
  { name: 'write_file', description: 'Write content to a file at a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to write to"},"content":{"type":"string","description":"Content to write"}},"required":["path","content"]}' },
  { name: 'read_file', description: 'Read content from a file at a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to read from"}},"required":["path"]}' },
  { name: 'list_directory', description: 'List files and directories in a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"Directory path to list"}},"required":["path"]}' },
  { name: 'run_command', description: 'Execute a shell command', parameters: '{"type":"object","properties":{"command":{"type":"string","description":"Shell command to run"},"cwd":{"type":"string","description":"Working directory (optional)"}},"required":["command"]}', enabled: false },
```

- [ ] **Step 3: Run tests to verify nothing broken**

Run: `npx jest --no-coverage`
Expected: PASS (all existing tests)

- [ ] **Step 4: Commit**

```bash
git add backend/src/tools/tools.module.ts backend/prisma/seed.ts
git commit -m "feat: register 4 execution tools in module and seed"
```

---

### Task 6: Update setup to run seed after schema changes

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Verify setup command includes prisma generate**

Check `backend/package.json` `scripts.setup` already has `prisma generate` from previous fix. If not, add it.

- [ ] **Step 2: Re-seed the database**

Run: `cd backend; npx prisma db seed`
Expected: "Seeded 17 tools" (previously 13 + 4 new)

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add backend/package.json
git commit -m "fix: ensure setup regenerates prisma client before migrating"
```

---

## Verification

After all tasks complete:

1. Run `npx jest --no-coverage` — all tests pass
2. Run `cd backend; npx prisma db seed` — seeds 17 tools
3. Start backend: `npm run start:dev` — no TypeScript errors
4. The agent can now use `write_file`, `read_file`, `list_directory`, `run_command` tools

## Future — Phase 2 (MCP Adapter)

Not in scope for this plan. Phase 2 will:
- Add `@modelcontextprotocol/sdk` dependency
- Create `McpService` + `McpClientService`
- Register MCP tools dynamically with `mcp__` prefix
- Allow user to configure MCP servers via Settings UI
