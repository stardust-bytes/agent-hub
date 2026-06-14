# First-Run Seed Data Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire existing seed data into first-run paths (CLI + Docker) and seed a default Ollama provider so workspace is functional immediately.

**Architecture:** Convert `seed.ts` → `seed.cjs` (no ts-node dependency). Add provider seeding to it. Then add `npx prisma db seed` call after `migrate deploy` in both CLI and Docker entry points.

**Tech Stack:** Node.js, Prisma, NestJS, Docker

---

### Task 1: Convert `seed.ts` → `seed.cjs` with default provider

**Files:**
- Delete: `backend/prisma/seed.ts`
- Create: `backend/prisma/seed.cjs`

- [ ] **Step 1: Delete old seed.ts**

```bash
git rm backend/prisma/seed.ts
```

- [ ] **Step 2: Create backend/prisma/seed.cjs**

All 28 tools + MCP config carried over from `seed.ts`, plus default Ollama provider seeding.

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_TOOLS = [
  { name: 'create_task', description: 'Create a scheduled task. Parameters: name (required), description (optional, used as AI prompt), frequency (optional, default manual; values: manual/hourly/daily/weekdays/weekly), cronMinute (0-59), cronHour (0-23), cronDayOfWeek (0-6, 0=Sunday), cronDaysOfWeek (comma-separated, 0=Sun, 1=Mon...), modelId (optional, auto-resolves to first available model if empty), projectPath (optional, leave empty unless user explicitly requests). Use natural language to parse user scheduling requests into cron fields.', parameters: '{"type":"object","properties":{"name":{"type":"string"},"description":{"type":"string"},"frequency":{"type":"string","enum":["manual","hourly","daily","weekdays","weekly"]},"cronMinute":{"type":"number","minimum":0,"maximum":59},"cronHour":{"type":"number","minimum":0,"maximum":23},"cronDayOfWeek":{"type":"number","minimum":0,"maximum":6},"cronDaysOfWeek":{"type":"string"},"modelId":{"type":"number"},"projectPath":{"type":"string"}},"required":["name"]}' },
  { name: 'update_task', description: 'Update a scheduled task by id. Parameters: id (required), name, description, frequency, cronMinute, cronHour, cronDayOfWeek, cronDaysOfWeek, modelId, projectPath (all optional — only provided fields are updated).', parameters: '{"type":"object","properties":{"id":{"type":"number"},"name":{"type":"string"},"description":{"type":"string"},"frequency":{"type":"string","enum":["manual","hourly","daily","weekdays","weekly"]},"cronMinute":{"type":"number","minimum":0,"maximum":59},"cronHour":{"type":"number","minimum":0,"maximum":23},"cronDayOfWeek":{"type":"number","minimum":0,"maximum":6},"cronDaysOfWeek":{"type":"string"},"modelId":{"type":"number"},"projectPath":{"type":"string"}},"required":["id"]}' },
  { name: 'list_tasks', description: 'List all scheduled tasks.', parameters: '{"type":"object","properties":{}}' },
  { name: 'get_task', description: 'Get details of a scheduled task by id.', parameters: '{"type":"object","properties":{"id":{"type":"number","minimum":1}},"required":["id"]}' },
  { name: 'delete_tasks', description: 'Delete scheduled tasks by array of ids.', parameters: '{"type":"object","properties":{"ids":{"type":"array","items":{"type":"number"}}},"required":["ids"]}' },
  { name: 'create_note', description: 'Create a new note. Only use when the user explicitly asks to create a note.', parameters: '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"}},"required":["title","content"]}' },
  { name: 'update_note', description: 'Update a note (title, content). Only use when the user explicitly asks to update a note.', parameters: '{"type":"object","properties":{"id":{"type":"number"},"title":{"type":"string"},"content":{"type":"string"}},"required":["id"]}' },
  { name: 'list_notes', description: 'List all notes. Only use when the user explicitly asks about notes.', parameters: '{"type":"object","properties":{}}' },
  { name: 'delete_note', description: 'Delete a note by ID. Only use when the user explicitly asks to delete a note.', parameters: '{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}' },
  { name: 'convert_note_to_task', description: 'Convert a note to a scheduled task. Only use when the user explicitly asks to convert a note.', parameters: '{"type":"object","properties":{"noteId":{"type":"number"},"modelId":{"type":"number"}},"required":["noteId"]}' },
  { name: 'search_knowledge', description: 'Search the knowledge base for relevant information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}' },
  { name: 'web_fetch', description: 'Fetch content from a URL', parameters: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}', enabled: false },
  { name: 'web_search', description: 'Search the web for information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', enabled: false, configSchema: '{"type":"object","properties":{"apiKey":{"type":"string","title":"Exa AI API Key","format":"password"}},"required":["apiKey"]}' },
  { name: 'write_file', description: 'Write content to a file at a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to write to"},"content":{"type":"string","description":"Content to write"}},"required":["path","content"]}' },
  { name: 'read_file', description: 'Read content from a file at a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to read from"}},"required":["path"]}' },
  { name: 'list_directory', description: 'List files and directories in a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"Directory path to list"}},"required":["path"]}' },
  { name: 'run_command', description: 'Execute a shell command', parameters: '{"type":"object","properties":{"command":{"type":"string","description":"Shell command to run"},"cwd":{"type":"string","description":"Working directory (optional)"}},"required":["command"]}', enabled: false },
  { name: 'grep', description: 'Search file contents recursively using a regex pattern', parameters: '{"type":"object","properties":{"pattern":{"type":"string","description":"Regex pattern to search for"},"path":{"type":"string","description":"Directory to search in (default: current dir)"},"include":{"type":"string","description":"File extension filter (e.g. \'.ts\')"}},"required":["pattern"]}' },
  { name: 'glob', description: 'Match files using a glob pattern', parameters: '{"type":"object","properties":{"pattern":{"type":"string","description":"Glob pattern to match files"},"path":{"type":"string","description":"Directory to search in (default: current dir)"}},"required":["pattern"]}' },
  { name: 'resume_plan', description: 'Validate and describe plan status for resumption by plan ID', parameters: '{"type":"object","properties":{"planId":{"type":"number","description":"ID of the plan to check"}},"required":["planId"]}' },
  { name: 'create_plan', description: 'Create a multi-step plan for complex tasks with optional approval gate', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Title of the plan"},"steps":{"type":"array","items":{"type":"string"},"description":"Ordered list of steps to execute"},"requireApproval":{"type":"boolean","description":"Require user approval before executing (default: true)"}},"required":["title","steps"]}' },
  { name: 'spawn_subagent', description: 'Spawn a sub-agent to complete a specific subtask. Use for complex, multi-step, or parallel tasks. Do NOT use for simple questions or single-tool operations — handle those directly.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The task for the sub-agent to complete. Be specific and include all context needed."}},"required":["task"]}' },
  { name: 'delegate', description: 'Delegate subtasks to run in parallel workers. Use for complex multi-step tasks like reading multiple files, processing data, or searching.', parameters: '{"type":"object","properties":{"tasks":{"type":"array","items":{"type":"string"},"description":"Array of subtask descriptions to execute in parallel"}},"required":["tasks"]}' },
  { name: 'read_excel', description: 'Read data from an Excel (.xlsx) file. Returns data as a markdown table.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"sheet":{"type":"string","description":"Sheet name (default: first sheet)"},"range":{"type":"string","description":"Cell range like A1:D10 (default: all used cells)"}},"required":["path"]}' },
  { name: 'write_excel', description: 'Write data to an Excel (.xlsx) file. Creates new file if it does not exist. Supports cells, rows, columns, formulas, merge, and styling.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path"},"operations":{"type":"array","description":"Array of write operations","items":{"type":"object","properties":{"type":{"type":"string","enum":["write_cell","write_row","write_column","formula","merge","style","column_width"]},"sheet":{"type":"string"},"cell":{"type":"string"},"value":{},"values":{"type":"array"},"formula":{"type":"string"},"range":{"type":"string"},"column":{"type":"string"},"width":{"type":"number"},"style":{"type":"object","properties":{"bold":{"type":"boolean"},"italic":{"type":"boolean"},"fontSize":{"type":"number"},"fontColor":{"type":"string"},"fillColor":{"type":"string"},"numberFormat":{"type":"string"},"border":{"type":"boolean"}}}}}}},"required":["path","operations"]}' },
  { name: 'excel_add_sheet', description: 'Add a new sheet to an existing Excel (.xlsx) file.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"sheet":{"type":"string","description":"Name for the new sheet"}},"required":["path","sheet"]}' },
  { name: 'list_excel_sheets', description: 'List all sheet names in an Excel (.xlsx) file.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"}},"required":["path"]}' },
  { name: 'excel_chart', description: 'Add chart metadata to an Excel (.xlsx) sheet. Chart types: bar, line, pie, column.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"sheet":{"type":"string","description":"Sheet name"},"type":{"type":"string","enum":["bar","line","pie","column"],"description":"Chart type"},"title":{"type":"string","description":"Chart title"},"dataRange":{"type":"string","description":"Source data range like B2:D5"},"categoriesRange":{"type":"string","description":"Category labels range like A2:A5"}},"required":["path","sheet","type","dataRange"]}' },
  { name: 'read_word', description: 'Read a Word (.docx) file and return its content as structured markdown with tables.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .docx file"}},"required":["path"]}' },
  { name: 'write_word', description: 'Create a Word (.docx) file from markdown content. Supports headings, lists, tables, and bold text.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path for the new .docx file"},"content":{"type":"string","description":"Markdown content to write"}},"required":["path","content"]}' },
  { name: 'edit_word', description: 'Edit an existing Word (.docx) file. Supports append (add content at end) and replace (find and replace text) operations.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .docx file"},"operations":{"type":"array","description":"Array of edit operations","items":{"type":"object","properties":{"type":{"type":"string","enum":["append","replace"],"description":"append: add content at end, replace: find and replace text"},"content":{"type":"string","description":"Content to append (for append type)"},"target":{"type":"string","description":"Text to find (for replace type)"},"replacement":{"type":"string","description":"Replacement text (for replace type)"}}}}},"required":["path","operations"]}' },
  { name: 'google_gmail_search', description: 'Search Gmail emails by query.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"Gmail search query"},"maxResults":{"type":"number","description":"Max results (default: 20)"}},"required":["query"]}', enabled: false },
  { name: 'google_gmail_read', description: 'Read full content of a Gmail email by ID.', parameters: '{"type":"object","properties":{"id":{"type":"string","description":"Email ID to read"}},"required":["id"]}', enabled: false },
  { name: 'google_gmail_send', description: 'Send an email via Gmail.', parameters: '{"type":"object","properties":{"to":{"type":"array","items":{"type":"string"},"description":"Recipients"},"subject":{"type":"string","description":"Email subject"},"body":{"type":"string","description":"Email body"},"cc":{"type":"array","items":{"type":"string"},"description":"CC"},"bcc":{"type":"array","items":{"type":"string"},"description":"BCC"}},"required":["to","subject","body"]}', enabled: false },
  { name: 'google_gmail_draft', description: 'Create a Gmail draft (does not send).', parameters: '{"type":"object","properties":{"to":{"type":"array","items":{"type":"string"},"description":"Recipients"},"subject":{"type":"string","description":"Subject"},"body":{"type":"string","description":"Body"}},"required":["to","subject","body"]}', enabled: false },
  { name: 'google_gmail_labels', description: 'List Gmail labels.', parameters: '{"type":"object","properties":{}}', enabled: false },
  { name: 'google_calendar_list', description: 'List Google Calendar events.', parameters: '{"type":"object","properties":{"since":{"type":"string","description":"Start date ISO"},"until":{"type":"string","description":"End date ISO"}}}', enabled: false },
  { name: 'google_calendar_create', description: 'Create a Google Calendar event.', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Event title"},"startTime":{"type":"string","description":"Start time ISO"},"endTime":{"type":"string","description":"End time ISO"},"description":{"type":"string","description":"Description"},"attendees":{"type":"array","items":{"type":"string"},"description":"Attendee emails"},"location":{"type":"string","description":"Location"}},"required":["title","startTime","endTime"]}', enabled: false },
  { name: 'google_calendar_update', description: 'Update a Google Calendar event.', parameters: '{"type":"object","properties":{"id":{"type":"string","description":"Event ID"},"title":{"type":"string","description":"New title"},"startTime":{"type":"string","description":"New start time"},"endTime":{"type":"string","description":"New end time"}},"required":["id"]}', enabled: false },
  { name: 'google_calendar_availability', description: 'Check calendar availability.', parameters: '{"type":"object","properties":{"startTime":{"type":"string","description":"Start ISO"},"endTime":{"type":"string","description":"End ISO"}},"required":["startTime","endTime"]}', enabled: false },
  { name: 'google_drive_search', description: 'Search Google Drive files by name.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"File name query"},"pageSize":{"type":"number","description":"Max results"}},"required":["query"]}', enabled: false },
  { name: 'google_drive_read', description: 'Read file content from Google Drive.', parameters: '{"type":"object","properties":{"id":{"type":"string","description":"File ID"}},"required":["id"]}', enabled: false },
  { name: 'google_drive_list', description: 'List files in a Google Drive folder.', parameters: '{"type":"object","properties":{"folderId":{"type":"string","description":"Folder ID (omit for root)"}}}', enabled: false },
  { name: 'google_drive_upload', description: 'Upload a file to Google Drive. Supports local file path or base64 content.', parameters: '{"type":"object","properties":{"filePath":{"type":"string","description":"Local file path (alternative to name+contentBase64)"},"name":{"type":"string","description":"File name"},"contentBase64":{"type":"string","description":"File content as base64"},"mimeType":{"type":"string","description":"MIME type"}}}', enabled: false },
  { name: 'google_drive_create_folder', description: 'Create a new folder in Google Drive.', parameters: '{"type":"object","properties":{"name":{"type":"string","description":"Folder name"},"parentFolderId":{"type":"string","description":"Parent folder ID (omit for root)"}},"required":["name"]}', enabled: false },
  { name: 'google_sheets_read', description: 'Read data from a Google Sheets range and return a markdown table.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string","description":"Spreadsheet ID or name"},"range":{"type":"string","description":"Cell range e.g. A1:D10"},"tab":{"type":"string","description":"Tab/sheet name (default: Sheet1)"}},"required":["spreadsheet","range"]}', enabled: false },
  { name: 'google_sheets_list_tabs', description: 'List all tabs/sheets in a Google Sheets spreadsheet with their row and column counts.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string","description":"Spreadsheet ID or name"}},"required":["spreadsheet"]}', enabled: false },
  { name: 'google_sheets_update', description: 'Overwrite values in a Google Sheets range.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"range":{"type":"string"},"values":{"type":"array","items":{"type":"array"}},"tab":{"type":"string"}},"required":["spreadsheet","range","values"]}', enabled: false },
  { name: 'google_sheets_append', description: 'Append rows to the end of a Google Sheets tab.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"values":{"type":"array","items":{"type":"array"}},"tab":{"type":"string"}},"required":["spreadsheet","values"]}', enabled: false },
  { name: 'google_sheets_create', description: 'Create a new Google Sheets spreadsheet.', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Spreadsheet title"},"initialTab":{"type":"string","description":"Name for the first tab (optional)"},"parentFolderId":{"type":"string","description":"Drive folder ID to create in (optional)"}},"required":["title"]}', enabled: false },
  { name: 'google_sheets_add_tab', description: 'Add a new tab/sheet to an existing Google Sheets spreadsheet.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"tabName":{"type":"string"}},"required":["spreadsheet","tabName"]}', enabled: false },
  { name: 'google_sheets_format', description: 'Apply formatting to a Google Sheets cell range.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"range":{"type":"string"},"tab":{"type":"string"},"format":{"type":"object","properties":{"bold":{"type":"boolean"},"italic":{"type":"boolean"},"fontSize":{"type":"number"},"fontColor":{"type":"string"},"fillColor":{"type":"string"},"numberFormat":{"type":"string"},"border":{"type":"boolean"}}}},"required":["spreadsheet","range","format"]}', enabled: false },
  { name: 'google_sheets_chart', description: 'Add a chart to a Google Sheets tab.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"tab":{"type":"string"},"type":{"type":"string","enum":["BAR","LINE","PIE","COLUMN"]},"dataRange":{"type":"string"},"categoriesRange":{"type":"string"},"title":{"type":"string"}},"required":["spreadsheet","tab","type","dataRange"]}', enabled: false },
];

async function main() {
  const validNames = new Set(DEFAULT_TOOLS.map(t => t.name));
  const stale = await prisma.tool.findMany({ where: { name: { notIn: [...validNames] } } });
  if (stale.length > 0) {
    await prisma.tool.deleteMany({ where: { name: { notIn: [...validNames] } } });
    console.log(`Removed ${stale.length} stale tools: ${stale.map(t => t.name).join(', ')}`);
  }

  for (const tool of DEFAULT_TOOLS) {
    const data = { description: tool.description, parameters: tool.parameters };
    if (tool.configSchema !== undefined) {
      data.configSchema = tool.configSchema;
    }
    await prisma.tool.upsert({
      where: { name: tool.name },
      update: data,
      create: { name: tool.name, enabled: tool.enabled ?? true, ...data },
    });
  }
  console.log(`Seeded ${DEFAULT_TOOLS.length} tools`);

  const mcpConfig = await prisma.setting.findUnique({ where: { key: 'mcp.servers' } });
  if (!mcpConfig) {
    await prisma.setting.create({
      data: {
        key: 'mcp.servers',
        value: JSON.stringify([
          { id: 'playwright', name: 'Playwright Browser', type: 'stdio', command: 'npx', args: ['@playwright/mcp'], enabled: true },
        ]),
      },
    });
    console.log('Seeded default MCP server: playwright');
  }

  const existingProvider = await prisma.provider.findFirst({ where: { type: 'ollama' } });
  if (!existingProvider) {
    await prisma.provider.create({
      data: {
        name: 'Local Ollama',
        type: 'ollama',
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        models: {
          create: [
            { name: process.env.SUMMARY_MODEL || 'llama3.2' },
            { name: process.env.EMBED_MODEL || 'nomic-embed-text' },
          ],
        },
      },
    });
    console.log('Seeded default Ollama provider with models: ' +
      (process.env.SUMMARY_MODEL || 'llama3.2') + ', ' +
      (process.env.EMBED_MODEL || 'nomic-embed-text'));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.cjs
git rm backend/prisma/seed.ts
git commit -m "refactor: convert seed to CJS and add default Ollama provider"
```

---

### Task 2: Update `package.json` seed config

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Update prisma.seed path**

Change line `"seed": "ts-node prisma/seed.ts"` to `"seed": "node prisma/seed.cjs"`

- [ ] **Step 2: Commit**

```bash
git add backend/package.json
git commit -m "chore: update prisma seed config to CJS path"
```

---

### Task 3: Wire seed into CLI

**Files:**
- Modify: `bin/workspace-cli.js`

- [ ] **Step 1: Add seed call after migrate deploy**

After line 54 (closing brace of the `if (!dbReady)` block), add the seed call:

```js
if (!dbReady) {
  console.log('[workspace] First run — initializing database...');
  execSync(`npx prisma migrate deploy --schema="${path.join(ROOT, 'backend', 'prisma', 'schema.prisma')}"`, {
    cwd: ROOT,
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
```

- [ ] **Step 2: Commit**

```bash
git add bin/workspace-cli.js
git commit -m "feat: run seed after migration on first CLI run"
```

---

### Task 4: Wire seed into Docker

**Files:**
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Add seed to Docker CMD**

Change line 22 from:
```
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```
to:
```
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]
```

- [ ] **Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat: run seed after migration in Docker entrypoint"
```

---

### Task 5: Build and verify

**Files:** none (verification only)

- [ ] **Step 1: Run backend build**

```bash
cd backend && npm run build
```

Expected: NestJS compiles without errors

- [ ] **Step 2: Verify seed runs standalone**

```bash
cd backend && npx prisma db seed
```

Expected:
- `Seeded 28 tools`
- `Seeded default MCP server: playwright`
- `Seeded default Ollama provider with models: llama3.2, nomic-embed-text`

- [ ] **Step 3: Verify seed is idempotent (run again)**

```bash
cd backend && npx prisma db seed
```

Expected: Same output minus provider message (provider already exists, only first 2 messages show)
