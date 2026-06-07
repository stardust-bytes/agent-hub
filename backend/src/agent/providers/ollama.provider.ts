import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LLMProvider } from './llm-provider.interface';
import { SettingsService } from '../../settings/settings.service';
import { TasksService } from '../../tasks/tasks.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in the task board',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          priority: { type: 'number', enum: [0, 1, 2], description: '0=low, 1=medium, 2=high' },
          description: { type: 'string', description: 'Optional description' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update a task status or priority',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Task ID' },
          status: { type: 'string', enum: ['TODO', 'PROCESSING', 'DONE', 'FAILED'] },
          priority: { type: 'number', enum: [0, 1, 2] },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List all tasks, optionally filter by status',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['TODO', 'PROCESSING', 'DONE', 'FAILED'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the knowledge base for relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
];

@Injectable()
export class OllamaProvider implements LLMProvider {
  constructor(
    private readonly settings: SettingsService,
    private readonly tasksService: TasksService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
    context?: string,
  ): Promise<void> {
    if (signal.aborted) return;

    const ollamaUrl = await this.settings.get('ollama.baseUrl', 'http://localhost:11434');

    const messages: Array<{ role: string; content: string }> = [];
    if (context) messages.push({ role: 'system', content: context });
    messages.push({ role: 'user', content: message });

    let toolCallCount = 0;

    while (!signal.aborted) {
      const body = JSON.stringify({
        model,
        messages,
        stream: true,
        tools: TOOLS,
      });

      let ollamaRes: globalThis.Response;
      try {
        ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal,
        });
      } catch {
        if (signal.aborted) return;
        res.write('data: {"error":"ollama_unreachable"}\n\n');
        res.write('data: [DONE]\n\n');
        return;
      }

      if (!ollamaRes.ok) {
        let detail = `ollama_error_${ollamaRes.status}`;
        try {
          const errBody = await ollamaRes.json() as { error?: string };
          if (errBody.error) detail = errBody.error;
        } catch { /* ignore */ }
        res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
        res.write('data: [DONE]\n\n');
        return;
      }

      const reader = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolCalls: Array<{ function: { name: string; arguments: string } }> | null = null;
      let responseContent = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as {
              message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> };
              done?: boolean;
            };
            if (parsed.message?.content) {
              responseContent += parsed.message.content;
              res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
            }
            if (parsed.message?.tool_calls) {
              currentToolCalls = parsed.message.tool_calls;
            }
          } catch { /* skip malformed */ }
        }
      }

      if (signal.aborted) return;

      if (responseContent) {
        messages.push({ role: 'assistant', content: responseContent });
      }

      if (!currentToolCalls || currentToolCalls.length === 0) {
        break;
      }

      for (const tc of currentToolCalls) {
        if (signal.aborted) return;
        toolCallCount++;

        const name = tc.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }

        res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);

        let result = '';
        try {
          result = await this.executeTool(name, args);
        } catch (e) {
          result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
        }

        res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);

        messages.push({
          role: 'tool',
          content: result,
        });
      }

      currentToolCalls = null;
      responseContent = '';
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'create_task': {
        const task = await this.tasksService.create({
          title: args.title as string,
          priority: args.priority as number | undefined,
          description: args.description as string | undefined,
        });
        return `Task #${task.id} created: "${task.title}"`;
      }
      case 'update_task': {
        const task = await this.tasksService.update(args.id as number, {
          status: args.status as string | undefined,
          priority: args.priority as number | undefined,
        });
        return `Task #${task.id} updated`;
      }
      case 'list_tasks': {
        const tasks = await this.tasksService.findAll();
        const filtered = args.status
          ? tasks.filter((t: { status: string }) => t.status === args.status)
          : tasks;
        if (filtered.length === 0) return 'No tasks found.';
        return filtered.map((t: { id: number; title: string; status: string; priority: number }) =>
          `#${t.id} ${t.title} [${t.status}] (priority: ${t.priority})`
        ).join('\n');
      }
      case 'search_knowledge': {
        const chunks = await this.knowledgeService.search(args.query as string);
        if (chunks.length === 0) return 'No relevant information found.';
        return chunks.map((c: { filename: string; text: string }) =>
          `[${c.filename}]: ${c.text}`
        ).join('\n---\n');
      }
      default:
        return `Unknown tool: ${name}`;
    }
  }
}
