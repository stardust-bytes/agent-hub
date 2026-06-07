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

    const messages: Array<Record<string, unknown>> = [];
    if (context) messages.push({ role: 'system', content: context });
    messages.push({ role: 'user', content: message });

    const MAX_TOOL_CALLS = 10;
    let toolCallCount = 0;

    while (!signal.aborted) {
      const body: Record<string, unknown> = {
        model,
        messages,
        stream: true,
      };
      // Only send tools on first iteration to avoid re-triggering
      if (toolCallCount === 0) body.tools = TOOLS;

      let ollamaRes: globalThis.Response;
      try {
        ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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
      let buf = '';
      let currentToolCalls: Array<{ function: { name: string; arguments: unknown } }> | null = null;
      let responseContent = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as {
              message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: unknown } }> };
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

      // Fallback: detect JSON tool calls in text content (models without native tool_calls support)
      if (!currentToolCalls || currentToolCalls.length === 0) {
        currentToolCalls = this.detectTextToolCalls(responseContent);
      }

      const assistantMsg: Record<string, unknown> = { role: 'assistant', content: responseContent };
      if (currentToolCalls && currentToolCalls.length > 0) {
        assistantMsg.tool_calls = currentToolCalls.map(tc => ({
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments),
          },
        }));
      }
      messages.push(assistantMsg);

      if (!currentToolCalls || currentToolCalls.length === 0 || toolCallCount >= MAX_TOOL_CALLS) {
        break;
      }

      for (const tc of currentToolCalls) {
        if (signal.aborted) return;
        toolCallCount++;

        const name = tc.function.name;
        let args: Record<string, unknown> = {};
        if (typeof tc.function.arguments === 'string') {
          try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        } else if (typeof tc.function.arguments === 'object' && tc.function.arguments !== null) {
          args = tc.function.arguments as Record<string, unknown>;
        }

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

  private detectTextToolCalls(text: string): Array<{ function: { name: string; arguments: unknown } }> | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(trimmed) as { name?: string; arguments?: unknown };
      if (parsed.name && TOOLS.some(t => t.function.name === parsed.name)) {
        return [{ function: { name: parsed.name, arguments: parsed.arguments ?? {} } }];
      }
    } catch { /* not JSON */ }
    return null;
  }

}
