import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AgentState } from '../dto/agent-state.enum';
import { LLMControllerService } from './llm-controller.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { ToolDefinition } from './context-builder.service';
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
import { CreateNoteExecutor } from '../../tools/executors/create-note.executor';
import { UpdateNoteExecutor } from '../../tools/executors/update-note.executor';
import { ListNotesExecutor } from '../../tools/executors/list-notes.executor';
import { DeleteNoteExecutor } from '../../tools/executors/delete-note.executor';
import { ConvertNoteToTaskExecutor } from '../../tools/executors/convert-note-to-task.executor';

const MAX_RETRIES = 2;
const MAX_ITERATIONS = 10;
const KB_NO_RESULTS = 'No relevant information found in knowledge base.';

@Injectable()
export class AgentLoopService {
  private state: AgentState = AgentState.PLANNING;
  private readonly executorMap: Map<string, ToolExecutor>;
  private currentPlan: string[] = [];
  private retryCount = 0;
  private failedTool: string | null = null;

  constructor(
    private readonly llmController: LLMControllerService,
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
    createNote: CreateNoteExecutor,
    updateNote: UpdateNoteExecutor,
    listNotes: ListNotesExecutor,
    deleteNote: DeleteNoteExecutor,
    convertNoteToTask: ConvertNoteToTaskExecutor,
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
      [createNote.name, createNote],
      [updateNote.name, updateNote],
      [listNotes.name, listNotes],
      [deleteNote.name, deleteNote],
      [convertNoteToTask.name, convertNoteToTask],
    ]);
  }

  async run(
    providerType: string,
    model: string,
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    tools: ToolDefinition[],
    res: Response,
    signal: AbortSignal,
    sessionId?: number,
    mode: string = 'agent',
    providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' },
  ): Promise<string> {
    this.state = AgentState.PLANNING;
    this.currentPlan = [];
    this.retryCount = 0;
    this.failedTool = null;

    const activeTools = mode === 'chat' ? [] : tools;
    let finalText = '';
    let messages = this.llmController.buildMessages(systemPrompt, history, userMessage);
    let iterationCount = 0;

    while (!signal.aborted && iterationCount < MAX_ITERATIONS && this.state !== AgentState.RESPONDING) {
      iterationCount++;

      if (this.state === AgentState.PLANNING) {
        this.state = AgentState.EXECUTING;
      }

      if (this.state === AgentState.EXECUTING) {
        const { text, toolCalls } = await this.executeStep(
          model, messages, activeTools, signal, providerConfig, res, sessionId,
        );
        finalText += text;

        if (toolCalls.length > 0) {
          messages = this.addToolCallsToMessages(messages, text, toolCalls);
          this.state = AgentState.EVALUATING;
        } else {
          this.state = AgentState.RESPONDING;
        }

        if (this.state === AgentState.EVALUATING) {
          let allGood = true;
          for (const tc of toolCalls) {
            const name = tc.name;
            const args = this.normalizeArgs(tc.arguments);

            res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
            }

            let result: string;
            try {
              result = await this.executeTool(name, args);
            } catch (e) {
              result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
            }

            res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'tool', result, name, true);
            }

            const isGood = this.evaluateResult(name, result);
            if (!isGood) {
              allGood = false;
              this.failedTool = name;
              messages.push({ role: 'tool', content: result });
              break;
            }

            messages.push({ role: 'tool', content: result });

            if (name === 'search_knowledge') {
              messages = await this.handleKnowledgeResult(messages, result, res, sessionId);
            }
          }

          if (allGood) {
            this.retryCount = 0;
            this.failedTool = null;
            this.state = AgentState.EXECUTING;
          } else {
            this.state = AgentState.CORRECTING;
          }
        }
      }

      if (this.state === AgentState.CORRECTING) {
        if (this.retryCount < MAX_RETRIES) {
          this.retryCount++;
          res.write(`data: ${JSON.stringify({ thinking: `\u27f3 Retrying (${this.retryCount}/${MAX_RETRIES})...` })}\n\n`);
          if (sessionId) {
            await this.sessionsService.saveMessage(sessionId, 'system', `Retrying (${this.retryCount}/${MAX_RETRIES})...`);
          }
          messages.push({
            role: 'user',
            content: `The tool "${this.failedTool}" failed. Please try again with different arguments.`,
          });
          this.state = AgentState.EXECUTING;
        } else {
          const fallbackTool = this.findFallbackTool(this.failedTool);
          if (fallbackTool) {
            res.write(`data: ${JSON.stringify({ thinking: `\u27f3 Trying alternative tool: ${fallbackTool}...` })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'system', `Trying alternative tool: ${fallbackTool}...`);
            }
            this.failedTool = fallbackTool;
            this.retryCount = 0;
            messages.push({
              role: 'user',
              content: `The tool failed after retries. Try using "${fallbackTool}" instead.`,
            });
            this.state = AgentState.EXECUTING;
          } else {
            res.write(`data: ${JSON.stringify({ thinking: 'Unable to complete after retries. Asking user...' })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'system', 'Unable to complete after retries. Asking user...');
            }
            this.state = AgentState.RESPONDING;
          }
        }
      }
    }

    if (iterationCount >= MAX_ITERATIONS) {
      res.write(`data: ${JSON.stringify({ thinking: 'Reached max iterations. Generating closing message...' })}\n\n`);
      if (sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'system', 'Reached max iterations. Generating closing message...');
      }

      const closePrompt = `I have reached the maximum number of iterations. Based on the conversation and tool results above, write a closing message to the user explaining what happened and suggesting alternative approaches.`;

      const closeMessages: OllamaMessage[] = [
        ...messages,
        { role: 'user', content: closePrompt },
      ];

      const { text: closeText } = await this.executeStep(
        model, closeMessages, [], signal, providerConfig, res, sessionId,
      );

      if (closeText && sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'assistant', closeText);
      }
      finalText += closeText ?? '';
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }

    return finalText;
  }

  private async executeStep(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    providerConfig: { baseUrl: string; key?: string },
    res: Response,
    sessionId?: number,
  ): Promise<{ text: string; toolCalls: Array<{ name: string; arguments: unknown }> }> {
    let text = '';
    const toolCalls: Array<{ name: string; arguments: unknown }> = [];

    const stream = this.llmController.stream(
      'ollama', model, messages, tools, signal,
      providerConfig.baseUrl, providerConfig.key,
    );

    for await (const chunk of stream) {
      if (signal.aborted) return { text, toolCalls };

      switch (chunk.type) {
        case 'token':
          if (chunk.token) {
            text += chunk.token;
            res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
          }
          break;
        case 'tool_call':
          if (chunk.toolCall) toolCalls.push(chunk.toolCall);
          break;
        case 'error':
          res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
          return { text, toolCalls };
        case 'done':
          break;
      }
    }

    return { text, toolCalls };
  }

  private evaluateResult(toolName: string, result: string): boolean {
    if (!result || result.startsWith('Error:')) return false;
    if (result === KB_NO_RESULTS) return false;
    return true;
  }

  private findFallbackTool(failedTool: string | null): string | null {
    if (!failedTool) return null;
    const fallbackMap: Record<string, string> = {
      'web_fetch': 'web_search',
      'search_knowledge': 'web_search',
    };
    return fallbackMap[failedTool] ?? null;
  }

  private normalizeArgs(args: unknown): Record<string, unknown> {
    if (typeof args === 'string') {
      try { return JSON.parse(args); } catch { return { raw: args }; }
    }
    if (typeof args === 'object' && args !== null) return args as Record<string, unknown>;
    return {};
  }

  private addToolCallsToMessages(
    messages: OllamaMessage[],
    text: string,
    toolCalls: Array<{ name: string; arguments: unknown }>,
  ): OllamaMessage[] {
    return [
      ...messages,
      {
        role: 'assistant',
        content: text || '',
        toolCalls: toolCalls.map(tc => ({
          function: { name: tc.name, arguments: this.normalizeArgs(tc.arguments) },
        })),
      },
    ];
  }

  private async handleKnowledgeResult(
    messages: OllamaMessage[],
    result: string,
    res: Response,
    sessionId?: number,
  ): Promise<OllamaMessage[]> {
    res.write(`data: ${JSON.stringify({ thinking: 'Synthesizing search results...' })}\n\n`);
    if (sessionId) {
      await this.sessionsService.saveMessage(sessionId, 'system', 'Synthesizing search results...');
    }

    if (result === KB_NO_RESULTS) {
      let fileList = 'none indexed yet';
      try {
        const files = await this.knowledgeService.findAll();
        if (files.length > 0) {
          fileList = files.slice(0, 10).map(f => `"${f.filename}"`).join(', ');
        }
      } catch { /* fallback */ }
      return [
        ...messages,
        {
          role: 'user',
          content: `The knowledge base returned no results.\nAvailable KB files: ${fileList}.\nFollow KB guidance in system prompt.`,
        },
      ];
    }

    return [
      ...messages,
      {
        role: 'user',
        content: `I searched the knowledge base and found:\n\n${result}\n\nProvide a comprehensive answer with inline citations [Source: "filename", \u00a7N].`,
      },
    ];
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const executor = this.executorMap.get(name);
    if (!executor) return `Error: Unknown tool: ${name}`;
    return executor.execute(args);
  }
}
