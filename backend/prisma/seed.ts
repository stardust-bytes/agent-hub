import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TOOLS = [
  { name: 'create_task', description: 'Create a new task in the task board', parameters: '{"type":"object","properties":{"title":{"type":"string"},"priority":{"type":"number","enum":[0,1,2]},"description":{"type":"string"}},"required":["title"]}' },
  { name: 'update_task', description: 'Update a task (title, description, status, priority, dueDate)', parameters: '{"type":"object","properties":{"id":{"type":"number"},"title":{"type":"string"},"description":{"type":"string"},"status":{"type":"string","enum":["TODO","PROCESSING","DONE","FAILED"]},"priority":{"type":"number","enum":[0,1,2]},"dueDate":{"type":"string"}},"required":["id"]}' },
  { name: 'list_tasks', description: 'List all tasks, optionally filter by status', parameters: '{"type":"object","properties":{"status":{"type":"string","enum":["TODO","PROCESSING","DONE","FAILED"]}}}' },
  { name: 'get_task', description: 'Get details of a specific task by ID', parameters: '{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}' },
  { name: 'delete_tasks', description: 'Delete one or more tasks by their IDs', parameters: '{"type":"object","properties":{"ids":{"type":"array","items":{"type":"number"}}},"required":["ids"]}' },
  { name: 'search_knowledge', description: 'Search the knowledge base for relevant information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}' },
  { name: 'web_fetch', description: 'Fetch content from a URL', parameters: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}', enabled: false },
  { name: 'web_search', description: 'Search the web for information', parameters: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', enabled: false,
    configSchema: '{"type":"object","properties":{"apiKey":{"type":"string","title":"API Key","format":"password"},"provider":{"type":"string","title":"Provider","enum":["google","bing"],"default":"google"},"cx":{"type":"string","title":"Google CSE ID"}},"required":["apiKey"]}' },
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
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
