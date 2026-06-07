import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LLMProvider, OllamaMessage } from './llm-provider.interface';
import { LLMCallerService } from '../services/llm-caller.service';
import { ContextBuilderService, ToolDefinition } from '../services/context-builder.service';
import { AgentRunState } from '../dto/agent-run-state';
import { TasksService } from '../../tasks/tasks.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { SessionsService } from '../../sessions/sessions.service';

const KB_NO_RESULTS = 'No relevant information found in knowledge base.';

@Injectable()
export class OllamaProvider implements LLMProvider {
  constructor(
    private readonly llmCaller: LLMCallerService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly tasksService: TasksService,
    private readonly knowledgeService: KnowledgeService,
    private readonly sessionsService: SessionsService,
  ) {}

  async streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
    sessionId?: number,
    mode: string = 'agent',
  ): Promise<{ finalText: string }> {
    if (signal.aborted) return { finalText: '' };

    const runState = new AgentRunState(10);
    const context = await this.contextBuilder.build(runState, 0);
    context.messages = messages;

    const tools = mode === 'chat' ? [] : context.tools;
    const maxIterations = 10;
    let finalText = '';
    let iterationCount = 0;

    while (!signal.aborted && iterationCount < maxIterations) {
      iterationCount++;
      runState.step = iterationCount;

      let responseText = '';
      const toolCalls: Array<{ name: string; arguments: unknown }> = [];
      let streamError: string | null = null;

      try {
        const stream = this.llmCaller.streamChat(model, context.messages, tools, signal);

        for await (const chunk of stream) {
          if (signal.aborted) return { finalText: '' };

          switch (chunk.type) {
            case 'token':
              if (chunk.token) {
                responseText += chunk.token;
                res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
              }
              break;

            case 'tool_call':
              if (chunk.toolCall) {
                toolCalls.push(chunk.toolCall);
              }
              break;

            case 'thinking':
              if (chunk.thinking) {
                res.write(`data: ${JSON.stringify({ thinking: chunk.thinking })}\n\n`);
                if (sessionId) {
                  await this.sessionsService.saveMessage(sessionId, 'system', chunk.thinking);
                }
              }
              break;

            case 'error':
              streamError = chunk.error ?? 'Unknown streaming error';
              break;

            case 'done':
              break;
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        res.write(`data: ${JSON.stringify({ error: `LLM stream failed: ${errMsg}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        return { finalText: '' };
      }

      if (streamError) {
        if (streamError === 'ollama_unreachable') {
          res.write('data: {"error":"ollama_unreachable"}\n\n');
          res.write('data: [DONE]\n\n');
          return { finalText: '' };
        }
        res.write(`data: ${JSON.stringify({ error: streamError })}\n\n`);
        res.write('data: [DONE]\n\n');
        return { finalText: '' };
      }

      finalText += responseText;

      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (signal.aborted) return { finalText: '' };

          const name = tc.name;
          let args: Record<string, unknown> = {};
          if (typeof tc.arguments === 'string') {
            try { args = JSON.parse(tc.arguments); } catch { args = { raw: tc.arguments }; }
          } else if (typeof tc.arguments === 'object' && tc.arguments !== null) {
            args = tc.arguments as Record<string, unknown>;
          }

          runState.steps.push({
            step: iterationCount,
            type: 'tool_call',
            toolSlug: name,
            args,
          });

          res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
          if (sessionId) {
            await this.sessionsService.saveMessage(
              sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false,
            );
          }

          let result = '';
          try {
            result = await this.executeTool(name, args);
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
          }

          runState.steps.push({
            step: iterationCount,
            type: 'tool_result',
            toolSlug: name,
            result,
          });

          res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
          if (sessionId) {
            await this.sessionsService.saveMessage(sessionId, 'tool', result, name, true);
          }
        }

        const contextMessages = context.messages;
        contextMessages.push({
          role: 'assistant',
          content: responseText || '',
          toolCalls: toolCalls.map(tc => ({
            function: {
              name: tc.name,
              arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
            },
          })),
        });

        for (const tc of toolCalls) {
          const matchingStep = runState.steps.find(
            s => s.type === 'tool_result' && s.toolSlug === tc.name,
          );
          const stepName = tc.name;
          if (stepName === 'search_knowledge') {
            res.write(`data: ${JSON.stringify({ thinking: 'Synthesizing search results...' })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'system', 'Synthesizing search results...');
            }
            const kbResult = String(matchingStep?.result ?? '');
            if (kbResult === KB_NO_RESULTS) {
              let fileList = 'none indexed yet';
              try {
                const files = await this.knowledgeService.findAll();
                if (files.length > 0) {
                  fileList = files.slice(0, 10).map(f => `"${f.filename}"`).join(', ');
                }
              } catch { /* fallback: leave fileList as 'none indexed yet' */ }
              contextMessages.push({
                role: 'user',
                content: `The knowledge base returned no results for the query.\nAvailable KB files: ${fileList}.\nFollow the KB guidance in your system prompt to decide whether to use general knowledge (with disclaimer), ask clarifying questions, or suggest relevant files to the user.`,
              });
            } else {
              contextMessages.push({
                role: 'user',
                content: `I searched the knowledge base and found:\n\n${kbResult}\n\nBased on these results, provide a comprehensive answer with inline citations [Source: "filename", §N].`,
              });
            }
          } else {
            contextMessages.push({
              role: 'tool',
              content: JSON.stringify(matchingStep?.result ?? { error: 'No result' }),
            });
          }
        }
        continue;
      }

      break;
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }

    return { finalText };
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
          title: args.title as string | undefined,
          description: args.description as string | undefined,
          status: args.status as string | undefined,
          priority: args.priority as number | undefined,
          dueDate: args.dueDate as string | undefined,
        });
        return `Task #${task.id} updated: "${task.title}" [${task.status}]`;
      }
      case 'list_tasks': {
        const tasks = await this.tasksService.findAll();
        const filtered = args.status
          ? tasks.filter(t => t.status === args.status)
          : tasks;
        if (filtered.length === 0) return 'No tasks found.';
        return filtered.map(t =>
          `#${t.id} ${t.title} [${t.status}] (priority: ${t.priority})`
        ).join('\n');
      }
      case 'get_task': {
        const task = await this.tasksService.findOne(args.id as number);
        return `Task #${task.id}: "${task.title}" [${task.status}] priority=${task.priority} description="${task.description ?? ''}" due=${task.dueDate ?? ''}`;
      }
      case 'delete_tasks': {
        const ids = args.ids as number[];
        const count = await this.tasksService.removeMany(ids);
        return `Deleted ${count} task(s): #${ids.join(', #')}`;
      }
      case 'search_knowledge': {
        const chunks = await this.knowledgeService.search(args.query as string);
        if (chunks.length === 0) return KB_NO_RESULTS;
        return chunks.map((c, i) =>
          `[${i + 1}] Source: "${c.filename}", §${c.chunkIndex}\n${c.text}`
        ).join('\n\n---\n\n');
      }
      default:
        return `Unknown tool: ${name}`;
    }
  }
}
