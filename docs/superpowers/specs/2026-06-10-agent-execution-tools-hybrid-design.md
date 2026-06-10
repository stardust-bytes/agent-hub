# Agent Execution Tools — Hybrid (Custom + MCP) Design

## Problem

The agent can plan tasks (e.g. "create HTML file", "test and fix bugs") via Plan Mode, but cannot execute them because it lacks filesystem and shell tools. The user understands this as missing MCP (Model Context Protocol), but the real issue is missing execution tools.

## Design

Implementation is split into two independent cycles: Phase 1 (custom executors) provides immediate value and can ship alone. Phase 2 (MCP adapter) is additive and does not require Phase 1 to be complete first.

Hybrid approach: immediately extend the existing tool registry with custom file/shell executors (Phase 1), then add an MCP adapter layer for future standardization (Phase 2). Tool definitions seeded, `run_command` disabled by default.

---

### Architecture

```
AgentLoopService
  ├── executorMap: Map<string, ToolExecutor>
  │     ├── create_task, web_fetch, ... (existing custom executors)
  │     ├── write_file, read_file, list_directory, run_command (new custom executors)
  │     └── mcp__* (MCP-wrapped dynamic tools, Phase 2)
  │
  ├── McpService (Phase 2)
  │     ├── connect to MCP servers (stdio, TCP)
  │     ├── discover tools from each server
  │     └── call MCP tool via protocol
  │
  └── executeTool(name, args)
        ├── if name in executorMap → executor.execute(args)
        ├── if name starts with "mcp__" → McpService.call(name, args)
        └── else → Error: Unknown tool
```

The existing `ToolExecutor` interface (`name: string` + `execute(args)` → `Promise<string>`) is unchanged. All new executors implement this same interface.

---

### Phase 1: Custom File/Shell Executors

Four new executor classes in `backend/src/tools/executors/`:

| Executor | Tool Name | Function |
|---|---|---|
| `WriteFileExecutor` | `write_file` | Write string content to a file at `path` |
| `ReadFileExecutor` | `read_file` | Read file contents from `path` |
| `ListDirectoryExecutor` | `list_directory` | List files/dirs under `path` |
| `RunCommandExecutor` | `run_command` | Execute a shell command at `cwd` |

**WriteFileExecutor**
- Args: `{ path: string, content: string }`
- Path validated: `path.resolve(cwd, path)` must start with `path.resolve(allowedDir)` — prevents `../` traversal escape
- Allowed directories: `./workspace_data/` and system temp dir (configurable via `Setting` key `agent.allowedPaths`)
- Creates parent directories if needed
- Returns `"Written {bytes} bytes to {path}"`

**ReadFileExecutor**
- Args: `{ path: string }`
- Path validated same as WriteFileExecutor
- Returns file content (truncated at 100KB for safety)
- Error if file does not exist or path escapes allowed dirs

**ListDirectoryExecutor**
- Args: `{ path: string }`
- Returns newline-separated listing of entries (name, size, isDirectory)
- Non-recursive (single level)

**RunCommandExecutor**
- Args: `{ command: string, cwd?: string }`
- `cwd` defaults to `./workspace_data`
- Timeout: 30 seconds
- Returns stdout (truncated at 10KB)
- Stderr appended to output if non-empty
- **Disabled by default** (seed `enabled: false`)
- Approved via existing `PermissionsService` check (same as web tools)

All four executors return error strings on failure (consistent with existing pattern).

---

### Phase 2: MCP Adapter Layer

#### Architecture

```
AgentLoopService.executeTool(name, args)
  ├── if name in executorMap → executor.execute(args)           (custom executors)
  ├── if name startsWith("mcp__") → McpService.call(name, args)  (MCP tools)
  └── else → Error
```

**McpClientService** (`backend/src/agent/mcp/mcp-client.service.ts`):
- Wrapper quanh `@modelcontextprotocol/sdk` Client class
- `connect(transport)` — kết nối tới MCP server via Stdio hoặc SSE transport
- `listTools()` — khám phá tools từ MCP server
- `callTool(name, args)` — gọi tool, trả về string (compatible với ToolExecutor interface)
- `disconnect()` — ngắt kết nối, cleanup

**McpService** (`backend/src/agent/mcp/mcp.service.ts`):
- `@Injectable()` + `OnModuleInit` — auto-start servers khi app khởi động
- `McpService.servers: Map<string, { client: McpClientService; transport }>` — registry các MCP connections
- Tool name convention: `mcp__{serverId}__{toolName}` (ví dụ: `mcp__playwright__browser_navigate`)
- Default server: **Playwright MCP** (`@playwright/mcp`) — chạy dưới dạng child process (stdio transport)
- User servers: load từ `Setting` table key `mcp.servers` (JSON array of server configs)

**Execute flow:**
```
executeTool("mcp__playwright__browser_navigate", { url: "https://example.com" })
  → parse "mcp__playwright__browser_navigate" → serverId = "playwright", toolName = "browser_navigate"
  → McpService.servers.get("playwright") → McpClientService
  → client.callTool("browser_navigate", { url: "..." })
  → return string result
```

**Integration with AgentLoopService:**
- `executeTool()` kiểm tra executorMap trước, nếu không tìm thấy thì fallback sang McpService
- MCP tools cũng được `PermissionsService.isAllowed()` kiểm tra (dùng full name `mcp__playwright__browser_navigate`)
- Không thay đổi gì khác trong AgentLoopService logic

#### Security

- MCP tool names được permissions check giống custom executors
- Playwright MCP browser hoạt động trong isolated context
- User có thể enable/disable từng MCP server qua Settings UI

---

### Seed & Config Changes

**Backend `prisma/seed.ts`:** Add four new tool definitions:
```
{ name: 'write_file', description: 'Write content to a file', ..., enabled: true }
{ name: 'read_file', description: 'Read content from a file', ..., enabled: true }
{ name: 'list_directory', description: 'List files in a directory', ..., enabled: true }
{ name: 'run_command', description: 'Execute a shell command', ..., enabled: false }
```

**Permissions:** `run_command` gated by `PermissionsService.isAllowed('run_command')` — user must approve via Settings UI.

**Allowed directories:** Configurable via `Setting` key `agent.allowedPaths` (default: `["./workspace_data"]`).

---

### Files Modified/Created

| File | Action |
|---|---|---|
| *Phase 1 (completed)* | |
| `backend/prisma/seed.ts` | Add 4 tool definitions |
| `backend/src/tools/executors/write-file.executor.ts` | **Create** |
| `backend/src/tools/executors/read-file.executor.ts` | **Create** |
| `backend/src/tools/executors/list-directory.executor.ts` | **Create** |
| `backend/src/tools/executors/run-command.executor.ts` | **Create** |
| `backend/src/tools/tools.module.ts` | Register 4 new executors |
| `backend/src/agent/services/agent-loop.service.ts` | Wire new executors |
| *Phase 2* | |
| `backend/src/agent/mcp/mcp.module.ts` | **Create** |
| `backend/src/agent/mcp/mcp.service.ts` | **Create** |
| `backend/src/agent/mcp/mcp-client.service.ts` | **Create** |
| `backend/src/agent/mcp/mcp.service.spec.ts` | **Create** |
| `backend/src/agent/mcp/mcp-client.service.spec.ts` | **Create** |
| `backend/src/agent/services/agent-loop.service.ts` | Add MCP namespace fallback in executeTool() |
| `backend/src/agent/agent.module.ts` | Import McpModule |
| `backend/package.json` | Add `@modelcontextprotocol/sdk`, `@playwright/mcp` |
| `backend/Dockerfile` | Add `npx playwright install chromium --with-deps` |
| `backend/prisma/seed.ts` | Add default MCP server config in Setting |
| `frontend/src/components/SettingsView.vue` | Add MCP Servers section |

---

### Out of Scope

- Full MCP server implementation (we consume MCP, do not host it)
- File upload via MCP (frontend already has drag-and-drop)
- Arbitrary path access (restricted to allowed directories)
