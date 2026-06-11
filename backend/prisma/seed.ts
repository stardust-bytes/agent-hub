import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TOOLS = [
  { name: 'create_task', description: 'Create a new task in the task board', parameters: '{"type":"object","properties":{"title":{"type":"string"},"priority":{"type":"number","enum":[0,1,2]},"description":{"type":"string"}},"required":["title"]}' },
  { name: 'update_task', description: 'Update a task (title, description, status, priority, dueDate)', parameters: '{"type":"object","properties":{"id":{"type":"number"},"title":{"type":"string"},"description":{"type":"string"},"status":{"type":"string","enum":["TODO","PROCESSING","DONE","FAILED"]},"priority":{"type":"number","enum":[0,1,2]},"dueDate":{"type":"string"}},"required":["id"]}' },
  { name: 'list_tasks', description: 'List all tasks, optionally filter by status', parameters: '{"type":"object","properties":{"status":{"type":"string","enum":["TODO","PROCESSING","DONE","FAILED"]}}}' },
  { name: 'get_task', description: 'Get details of a specific task by ID', parameters: '{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}' },
  { name: 'delete_tasks', description: 'Delete one or more tasks by their IDs', parameters: '{"type":"object","properties":{"ids":{"type":"array","items":{"type":"number"}}},"required":["ids"]}' },
  { name: 'create_note', description: 'Create a new note', parameters: '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"}},"required":["title","content"]}' },
  { name: 'update_note', description: 'Update a note (title, content)', parameters: '{"type":"object","properties":{"id":{"type":"number"},"title":{"type":"string"},"content":{"type":"string"}},"required":["id"]}' },
  { name: 'list_notes', description: 'List all notes', parameters: '{"type":"object","properties":{}}' },
  { name: 'delete_note', description: 'Delete a note by ID', parameters: '{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}' },
  { name: 'convert_note_to_task', description: 'Convert a note to a task in the task board', parameters: '{"type":"object","properties":{"noteId":{"type":"number"}},"required":["noteId"]}' },
  { name: 'search_knowledge', description: 'Search the knowledge base for relevant information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}' },
  { name: 'web_fetch', description: 'Fetch content from a URL', parameters: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}', enabled: false },
  { name: 'web_search', description: 'Search the web for information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', enabled: false,
    configSchema: '{"type":"object","properties":{"apiKey":{"type":"string","title":"Exa AI API Key","format":"password"}},"required":["apiKey"]}' },
  { name: 'write_file', description: 'Write content to a file at a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to write to"},"content":{"type":"string","description":"Content to write"}},"required":["path","content"]}' },
  { name: 'read_file', description: 'Read content from a file at a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to read from"}},"required":["path"]}' },
  { name: 'list_directory', description: 'List files and directories in a given path', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"Directory path to list"}},"required":["path"]}' },
  { name: 'run_command', description: 'Execute a shell command', parameters: '{"type":"object","properties":{"command":{"type":"string","description":"Shell command to run"},"cwd":{"type":"string","description":"Working directory (optional)"}},"required":["command"]}', enabled: false },
  { name: 'grep', description: 'Search file contents recursively using a regex pattern', parameters: '{"type":"object","properties":{"pattern":{"type":"string","description":"Regex pattern to search for"},"path":{"type":"string","description":"Directory to search in (default: current dir)"},"include":{"type":"string","description":"File extension filter (e.g. \'.ts\')"}},"required":["pattern"]}' },
  { name: 'glob', description: 'Match files using a glob pattern', parameters: '{"type":"object","properties":{"pattern":{"type":"string","description":"Glob pattern to match files"},"path":{"type":"string","description":"Directory to search in (default: current dir)"}},"required":["pattern"]}' },
  { name: 'resume_plan', description: 'Validate and describe plan status for resumption by plan ID', parameters: '{"type":"object","properties":{"planId":{"type":"number","description":"ID of the plan to check"}},"required":["planId"]}' },
  { name: 'create_plan', description: 'Create a multi-step plan for complex tasks with optional approval gate', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Title of the plan"},"steps":{"type":"array","items":{"type":"string"},"description":"Ordered list of steps to execute"},"requireApproval":{"type":"boolean","description":"Require user approval before executing (default: true)"}},"required":["title","steps"]}' },
  { name: 'spawn_subagent', description: 'Spawn a sub-agent to complete a specific subtask. Use for complex, multi-step, or parallel tasks. Do NOT use for simple questions or single-tool operations — handle those directly.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The task for the sub-agent to complete. Be specific and include all context needed."}},"required":["task"]}' },
  { name: 'delegate_parallel', description: 'Decompose a complex task into independent parallel subtasks. Use ONLY when the user request involves multiple pieces of independent work that can run concurrently.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The original user request or overall task description."},"subtasks":{"type":"array","items":{"type":"string"},"description":"List of independent subtasks that can run in parallel. Each should be self-contained."}},"required":["task","subtasks"]}' },
];

async function main() {
  for (const tool of DEFAULT_TOOLS) {
    const data: any = {
      description: tool.description,
      parameters: tool.parameters,
      ...(tool.configSchema !== undefined ? { configSchema: tool.configSchema } : {}),
    };
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
          {
            id: 'playwright',
            name: 'Playwright Browser',
            type: 'stdio',
            command: 'npx',
            args: ['@playwright/mcp'],
            enabled: true,
          },
        ]),
      },
    });
    console.log('Seeded default MCP server: playwright');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
