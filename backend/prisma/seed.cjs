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
  { name: 'spawn_subagent', description: 'Spawn a sub-agent to complete a specific subtask. Use for complex, multi-step, or parallel tasks. Do NOT use for simple questions or single-tool operations — handle those directly.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The task for the sub-agent to complete. Be specific and include all context needed."},"profile":{"type":"string","description":"Optional agent profile slug to specialize the sub-agent."}},"required":["task"]}' },
  { name: 'delegate', description: 'Delegate subtasks to run in parallel workers. Use for complex multi-step tasks like reading multiple files, processing data, or searching.', parameters: '{"type":"object","properties":{"tasks":{"type":"array","items":{"type":"string"},"description":"Array of subtask descriptions to execute in parallel"},"profile":{"type":"string","description":"Optional agent profile slug applied to all workers."}},"required":["tasks"]}' },
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
  { name: 'github_search_repos', description: 'Search GitHub repositories by query. Returns name, description, stars, language.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"limit":{"type":"number","description":"Max results (default: 10)"}},"required":["query"]}', enabled: false },
  { name: 'github_get_repo', description: 'Get detailed information about a GitHub repository.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"}},"required":["owner","repo"]}', enabled: false },
  { name: 'github_search_issues', description: 'Search GitHub issues and pull requests across all repositories.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"Search query with GitHub qualifiers"},"limit":{"type":"number","description":"Max results (default: 10)"}},"required":["query"]}', enabled: false },
  { name: 'github_list_issues', description: 'List issues in a specific GitHub repository.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"},"state":{"type":"string","enum":["open","closed","all"]},"limit":{"type":"number"}},"required":["owner","repo"]}', enabled: false },
  { name: 'github_create_issue', description: 'Create a new issue in a GitHub repository.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"},"title":{"type":"string"},"body":{"type":"string"},"labels":{"type":"array","items":{"type":"string"}}},"required":["owner","repo","title"]}', enabled: false },
  { name: 'github_get_issue', description: 'Get detailed information about a specific GitHub issue.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"},"issueNumber":{"type":"number"}},"required":["owner","repo","issueNumber"]}', enabled: false },
  { name: 'github_list_pull_requests', description: 'List pull requests in a GitHub repository.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"},"state":{"type":"string","enum":["open","closed","all"]},"limit":{"type":"number"}},"required":["owner","repo"]}', enabled: false },
  { name: 'github_get_pull_request', description: 'Get detailed information about a specific pull request.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"},"pullNumber":{"type":"number"}},"required":["owner","repo","pullNumber"]}', enabled: false },
  { name: 'github_list_commits', description: 'List recent commits in a GitHub repository.', parameters: '{"type":"object","properties":{"owner":{"type":"string"},"repo":{"type":"string"},"branch":{"type":"string"},"limit":{"type":"number"}},"required":["owner","repo"]}', enabled: false },
  { name: 'slack_send_message', description: 'Send a message to a Slack channel.', parameters: '{"type":"object","properties":{"channel":{"type":"string","description":"Channel name or ID"},"text":{"type":"string"}},"required":["channel","text"]}', enabled: false },
  { name: 'slack_list_channels', description: 'List public Slack channels with member count and topic.', parameters: '{"type":"object","properties":{"limit":{"type":"number"}}}', enabled: false },
  { name: 'slack_get_history', description: 'Get recent messages from a Slack channel.', parameters: '{"type":"object","properties":{"channel":{"type":"string","description":"Channel ID"},"limit":{"type":"number"}},"required":["channel"]}', enabled: false },
  { name: 'slack_search', description: 'Search Slack messages across all channels.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"count":{"type":"number"}},"required":["query"]}', enabled: false },
  { name: 'notion_search', description: 'Search Notion pages and databases by text query.', parameters: '{"type":"object","properties":{"query":{"type":"string"},"pageSize":{"type":"number"}},"required":["query"]}', enabled: false },
  { name: 'notion_get_page', description: 'Read the full content of a Notion page by its ID.', parameters: '{"type":"object","properties":{"pageId":{"type":"string"}},"required":["pageId"]}', enabled: false },
  { name: 'notion_create_page', description: 'Create a new page inside a Notion database.', parameters: '{"type":"object","properties":{"databaseId":{"type":"string"},"properties":{"type":"object"}},"required":["databaseId","properties"]}', enabled: false },
  { name: 'notion_update_page', description: 'Update properties of an existing Notion page.', parameters: '{"type":"object","properties":{"pageId":{"type":"string"},"properties":{"type":"object"}},"required":["pageId","properties"]}', enabled: false },
  { name: 'notion_query_database', description: 'Query a Notion database with optional filters and sorts.', parameters: '{"type":"object","properties":{"databaseId":{"type":"string"},"filter":{"type":"object"},"sorts":{"type":"array","items":{"type":"object"}},"pageSize":{"type":"number"}},"required":["databaseId"]}', enabled: false },
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

  const DEFAULT_PROFILES = [
    { slug: 'researcher', name: 'Researcher', description: 'Read-only research and synthesis', systemPrompt: 'You are a research sub-agent. Gather and synthesize information accurately. Report findings concisely with sources.', allowedTools: JSON.stringify(['search_knowledge','web_search','web_fetch','read_file','grep','glob','list_directory']), builtin: true },
    { slug: 'code-reviewer', name: 'Code Reviewer', description: 'Reviews code for bugs and clarity', systemPrompt: 'You are a code-review sub-agent. Inspect the code and report concrete issues (bugs, risks, simplifications) with file:line references. Do not modify files.', allowedTools: JSON.stringify(['read_file','grep','glob','list_directory']), builtin: true },
    { slug: 'explorer', name: 'Explorer', description: 'Broad codebase search', systemPrompt: 'You are an exploration sub-agent. Locate relevant files and summarize where things live. Return paths and short excerpts, not full files.', allowedTools: JSON.stringify(['grep','glob','list_directory','read_file']), builtin: true },
    { slug: 'general', name: 'General Assistant', description: 'General-purpose agent with full tool access', systemPrompt: 'You are a general-purpose sub-agent. Use any tools available to complete the task. Plan your approach, execute steps methodically, and report back concisely.', allowedTools: '*', builtin: true },
  ];
  for (const p of DEFAULT_PROFILES) {
    await prisma.agentProfile.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description, systemPrompt: p.systemPrompt, allowedTools: p.allowedTools, builtin: true },
      create: p,
    });
  }
  console.log(`Seeded ${DEFAULT_PROFILES.length} agent profiles`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
