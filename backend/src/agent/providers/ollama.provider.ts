import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LLMProvider, OllamaMessage } from './llm-provider.interface';
import { LLMCallerService } from '../services/llm-caller.service';
import { ContextBuilderService, ToolDefinition } from '../services/context-builder.service';
import { AgentRunState } from '../dto/agent-run-state';
import { SessionsService } from '../../sessions/sessions.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { ToolExecutor } from '../../tools/executors/tool-executor.interface';
import { CreateTaskExecutor } from '../../tools/executors/create-task.executor';
import { UpdateTaskExecutor } from '../../tools/executors/update-task.executor';
import { ListTasksExecutor } from '../../tools/executors/list-tasks.executor';
import { GetTaskExecutor } from '../../tools/executors/get-task.executor';
import { DeleteTasksExecutor } from '../../tools/executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from '../../tools/executors/search-knowledge.executor';
import { WebFetchExecutor } from '../../tools/executors/web-fetch.executor';
import { WebSearchExecutor } from '../../tools/executors/web-search.executor';

const KB_NO_RESULTS = 'No relevant information found in knowledge base.';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private readonly executorMap: Map<string, ToolExecutor>;

  constructor(
    private readonly llmCaller: LLMCallerService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly sessionsService: SessionsService,
    private readonly knowledgeService: KnowledgeService,
    createTask: CreateTaskExecutor,
    updateTask: UpdateTaskExecutor,
    listTasks: ListTasksExecutor,
    getTask: GetTaskExecutor,
    deleteTasks: DeleteTasksExecutor,
    searchKnowledge: SearchKnowledgeExecutor,
    webFetch: WebFetchExecutor,
    webSearch: WebSearchExecutor,
  ) {
    this.executorMap = new Map<string, ToolExecutor>([
      [createTask.name, createTask],
      [updateTask.name, updateTask],
      [listTasks.name, listTasks],
      [getTask.name, getTask],
      [deleteTasks.name, deleteTasks],
      [searchKnowledge.name, searchKnowledge],
      [webFetch.name, webFetch],
      [webSearch.name, webSearch],
    ]);
  }

  async streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
    sessionId?: number,
    mode: string = 'agent',
    providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' },
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
        const stream = this.llmCaller.streamChat(model, context.messages, tools, signal, providerConfig.baseUrl, providerConfig.key);

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
          toolCalls: toolCalls.map(tc => {
            let args = tc.arguments;
            if (typeof args === 'string') {
              try { args = JSON.parse(args); } catch {}
            }
            return {
              function: {
                name: tc.name,
                arguments: args,
              },
            };
          }),
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
              content: String(matchingStep?.result ?? 'No result'),
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
    const executor = this.executorMap.get(name);
    if (!executor) return `Unknown tool: ${name}`;
    return executor.execute(args);
  }
}
