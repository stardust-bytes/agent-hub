import * as crypto from 'crypto';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WriteStream } from '../dto/write-stream.interface';
import { AgentState } from '../dto/agent-state.enum';
import { LLMControllerService } from './llm-controller.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { ToolDefinition } from './context-builder.service';
import { SessionsService } from '../../sessions/sessions.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { ToolContext, ToolExecutor } from '../../tools/executors/tool-executor.interface';
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
import { WriteFileExecutor } from '../../tools/executors/write-file.executor';
import { ReadFileExecutor } from '../../tools/executors/read-file.executor';
import { ListDirectoryExecutor } from '../../tools/executors/list-directory.executor';
import { RunCommandExecutor } from '../../tools/executors/run-command.executor';
import { GrepExecutor } from '../../tools/executors/grep.executor';
import { GlobExecutor } from '../../tools/executors/glob.executor';
import { ResumePlanExecutor } from '../../tools/executors/resume-plan.executor';
import { CreatePlanExecutor } from '../../tools/executors/create-plan.executor';
import { PermissionsService } from './permissions.service';
import { ApprovalManagerService } from './approval-manager.service';
import { PlansService } from '../../plans/plans.service';
import { McpService } from '../mcp/mcp.service';
import { SubagentService } from '../subagent/subagent.service';
import { filterSubagentTools } from '../subagent/subagent-tools.util';
import { AgentProfilesService } from '../../agent-profiles/agent-profiles.service';
import { UsageService } from '../../usage/usage.service';
import { ReadExcelExecutor } from '../../excel/executors/read-excel.executor';
import { WriteExcelExecutor } from '../../excel/executors/write-excel.executor';
import { ExcelAddSheetExecutor } from '../../excel/executors/excel-add-sheet.executor';
import { ListExcelSheetsExecutor } from '../../excel/executors/list-excel-sheets.executor';
import { ExcelChartExecutor } from '../../excel/executors/excel-chart.executor';
import { ReadWordExecutor } from '../../word/executors/read-word.executor';
import { WriteWordExecutor } from '../../word/executors/write-word.executor';
import { EditWordExecutor } from '../../word/executors/edit-word.executor';
import { GoogleGmailSearchExecutor } from '../../tools/executors/google-gmail-search.executor';
import { GoogleGmailReadExecutor } from '../../tools/executors/google-gmail-read.executor';
import { GoogleGmailSendExecutor } from '../../tools/executors/google-gmail-send.executor';
import { GoogleGmailDraftExecutor } from '../../tools/executors/google-gmail-draft.executor';
import { GoogleGmailLabelsExecutor } from '../../tools/executors/google-gmail-labels.executor';
import { GoogleCalendarListExecutor } from '../../tools/executors/google-calendar-list.executor';
import { GoogleCalendarCreateExecutor } from '../../tools/executors/google-calendar-create.executor';
import { GoogleCalendarUpdateExecutor } from '../../tools/executors/google-calendar-update.executor';
import { GoogleCalendarAvailabilityExecutor } from '../../tools/executors/google-calendar-availability.executor';
import { GoogleDriveSearchExecutor } from '../../tools/executors/google-drive-search.executor';
import { GoogleDriveReadExecutor } from '../../tools/executors/google-drive-read.executor';
import { GoogleDriveListExecutor } from '../../tools/executors/google-drive-list.executor';
import { GoogleDriveUploadExecutor } from '../../tools/executors/google-drive-upload.executor';
import { GoogleDriveCreateFolderExecutor } from '../../tools/executors/google-drive-create-folder.executor';
import { GoogleSheetsReadExecutor } from '../../tools/executors/google-sheets-read.executor';
import { GoogleSheetsListTabsExecutor } from '../../tools/executors/google-sheets-list-tabs.executor';
import { GoogleSheetsUpdateExecutor } from '../../tools/executors/google-sheets-update.executor';
import { GoogleSheetsAppendExecutor } from '../../tools/executors/google-sheets-append.executor';
import { GoogleSheetsCreateExecutor } from '../../tools/executors/google-sheets-create.executor';
import { GoogleSheetsAddTabExecutor } from '../../tools/executors/google-sheets-add-tab.executor';
import { GoogleSheetsFormatExecutor } from '../../tools/executors/google-sheets-format.executor';
import { GoogleSheetsChartExecutor } from '../../tools/executors/google-sheets-chart.executor';

const MAX_ITERATIONS = 100;
const KB_NO_RESULTS = 'No relevant information found in knowledge base.';

@Injectable()
export class AgentLoopService {
  private state: AgentState = AgentState.PLANNING;
  private readonly executorMap: Map<string, ToolExecutor>;

  constructor(
    private readonly llmController: LLMControllerService,
    private readonly sessionsService: SessionsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly permissionsService: PermissionsService,
    private readonly approvalManager: ApprovalManagerService,
    private readonly plansService: PlansService,
    private readonly mcpService: McpService,
    @Inject(forwardRef(() => SubagentService)) private readonly subagentService: SubagentService,
    private readonly agentProfilesService: AgentProfilesService,
    private readonly eventEmitter: EventEmitter2,
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
    writeFile: WriteFileExecutor,
    readFile: ReadFileExecutor,
    listDirectory: ListDirectoryExecutor,
    runCommand: RunCommandExecutor,
    private readonly grep: GrepExecutor,
    private readonly glob: GlobExecutor,
    private readonly resumePlan: ResumePlanExecutor,
    private readonly createPlan: CreatePlanExecutor,
    readExcel: ReadExcelExecutor,
    writeExcel: WriteExcelExecutor,
    excelAddSheet: ExcelAddSheetExecutor,
    listExcelSheets: ListExcelSheetsExecutor,
    excelChart: ExcelChartExecutor,
    private readonly readWord: ReadWordExecutor,
    private readonly writeWord: WriteWordExecutor,
    private readonly editWord: EditWordExecutor,
    private readonly googleGmailSearch: GoogleGmailSearchExecutor,
    private readonly googleGmailRead: GoogleGmailReadExecutor,
    private readonly googleGmailSend: GoogleGmailSendExecutor,
    private readonly googleGmailDraft: GoogleGmailDraftExecutor,
    private readonly googleGmailLabels: GoogleGmailLabelsExecutor,
    private readonly googleCalendarList: GoogleCalendarListExecutor,
    private readonly googleCalendarCreate: GoogleCalendarCreateExecutor,
    private readonly googleCalendarUpdate: GoogleCalendarUpdateExecutor,
    private readonly googleCalendarAvailability: GoogleCalendarAvailabilityExecutor,
    private readonly googleDriveSearch: GoogleDriveSearchExecutor,
    private readonly googleDriveRead: GoogleDriveReadExecutor,
    private readonly googleDriveList: GoogleDriveListExecutor,
    private readonly googleDriveUpload: GoogleDriveUploadExecutor,
    private readonly googleDriveCreateFolder: GoogleDriveCreateFolderExecutor,
    private readonly googleSheetsRead: GoogleSheetsReadExecutor,
    private readonly googleSheetsListTabs: GoogleSheetsListTabsExecutor,
    private readonly googleSheetsUpdate: GoogleSheetsUpdateExecutor,
    private readonly googleSheetsAppend: GoogleSheetsAppendExecutor,
    private readonly googleSheetsCreate: GoogleSheetsCreateExecutor,
    private readonly googleSheetsAddTab: GoogleSheetsAddTabExecutor,
    private readonly googleSheetsFormat: GoogleSheetsFormatExecutor,
    private readonly googleSheetsChart: GoogleSheetsChartExecutor,
    private readonly usageService: UsageService,
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
      [writeFile.name, writeFile],
      [readFile.name, readFile],
      [listDirectory.name, listDirectory],
      [runCommand.name, runCommand],
      [grep.name, grep],
      [glob.name, glob],
      [resumePlan.name, resumePlan],
      [createPlan.name, createPlan],
      [readExcel.name, readExcel],
      [writeExcel.name, writeExcel],
      [excelAddSheet.name, excelAddSheet],
      [listExcelSheets.name, listExcelSheets],
      [excelChart.name, excelChart],
      [readWord.name, readWord],
      [writeWord.name, writeWord],
      [editWord.name, editWord],
      [googleGmailSearch.name, googleGmailSearch],
      [googleGmailRead.name, googleGmailRead],
      [googleGmailSend.name, googleGmailSend],
      [googleGmailDraft.name, googleGmailDraft],
      [googleGmailLabels.name, googleGmailLabels],
      [googleCalendarList.name, googleCalendarList],
      [googleCalendarCreate.name, googleCalendarCreate],
      [googleCalendarUpdate.name, googleCalendarUpdate],
      [googleCalendarAvailability.name, googleCalendarAvailability],
      [googleDriveSearch.name, googleDriveSearch],
      [googleDriveRead.name, googleDriveRead],
      [googleDriveList.name, googleDriveList],
      [googleDriveUpload.name, googleDriveUpload],
      [googleDriveCreateFolder.name, googleDriveCreateFolder],
      [googleSheetsRead.name, googleSheetsRead],
      [googleSheetsListTabs.name, googleSheetsListTabs],
      [googleSheetsUpdate.name, googleSheetsUpdate],
      [googleSheetsAppend.name, googleSheetsAppend],
      [googleSheetsCreate.name, googleSheetsCreate],
      [googleSheetsAddTab.name, googleSheetsAddTab],
      [googleSheetsFormat.name, googleSheetsFormat],
      [googleSheetsChart.name, googleSheetsChart],
    ]);
  }

  async run(
    providerType: string,
    model: string,
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    tools: ToolDefinition[],
    res: WriteStream,
    signal: AbortSignal,
    sessionId?: number,
    projectPath?: string,
    providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' },
  ): Promise<string> {
    this.state = AgentState.PLANNING;

    let activeTools = tools;
    let finalText = '';
    const downloadLinks: string[] = [];
    let messages = this.llmController.buildMessages(systemPrompt, history, userMessage);

    while (!signal.aborted) {
      this.state = AgentState.EXECUTING;

      let text: string;
      let toolCalls: Array<{ name: string; arguments: unknown }>;
      try {
        const stepResult = await this.executeStep(
          model, messages, activeTools, signal, providerConfig, res, sessionId, providerType,
        );
        text = stepResult.text;
        toolCalls = stepResult.toolCalls;

        if (stepResult.usage && sessionId) {
          this.usageService.record({
            sessionId,
            modelName: model,
            providerType,
            promptTokens: stepResult.usage.promptTokens,
            completionTokens: stepResult.usage.completionTokens,
            totalTokens: stepResult.usage.totalTokens,
          }).catch(() => {});
        }
      } catch {
        break;
      }

      if (text && sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'assistant', text);
      }
      finalText += text;

      if (toolCalls.length === 0) break;

      let reasoningContent: string | undefined;
      messages = this.addToolCallsToMessages(messages, text, toolCalls, reasoningContent);

      for (let ti = 0; ti < toolCalls.length; ti++) {
        if (signal.aborted) break;
        const tc = toolCalls[ti];
        const name = tc.name;
        const toolCallId = `call_${ti}_${name}`;
        const args = this.normalizeArgs(tc.arguments);

        res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
        }

        const toolInput = JSON.stringify(args);
        const transcript = this.buildTranscript(messages);
        const decision = await this.permissionsService.decide(name, toolInput, transcript, sessionId);

        if (decision.action === 'allow') {
          // execute tool — fall through to executeTool below
        } else if (decision.action === 'deny') {
          const denialResult = `Tool '${name}' is not permitted by workspace policy.${decision.reason ? ' ' + decision.reason : ''}`;
          res.write(`data: ${JSON.stringify({ toolResult: { name, result: denialResult } })}\n\n`);
          if (sessionId) {
            await this.sessionsService.saveMessage(sessionId, 'tool', denialResult, name, true);
          }
          messages.push({ role: 'tool', content: denialResult, toolCallId });
          continue;
        } else if (decision.action === 'ask') {
          const approvalId = crypto.randomUUID();
          res.write(`data: ${JSON.stringify({ toolApprovalRequired: { id: approvalId, name, args } })}\n\n`);

          const approved = await this.approvalManager.requestApproval(approvalId, name, args, sessionId ?? 0);

          if (approved) {
            // execute tool — fall through to executeTool below
          } else {
            res.write(`data: ${JSON.stringify({ toolResult: { name, result: 'Tool execution denied by user' } })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'tool', 'Tool execution denied by user', name, true);
            }
            messages.push({ role: 'tool', content: 'Tool execution denied by user', toolCallId });
            continue;
          }
        }

        let result: string | undefined;
        if (name === 'spawn_subagent') {
          const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
          const task = String(argsObj.task ?? '');
          const profileSlug = argsObj.profile ? String(argsObj.profile) : undefined;
          if (!task) {
            result = 'Error: spawn_subagent requires a "task" parameter';
          } else {
            let promptOverride: string | undefined;
            let allowedTools: string | undefined;
            if (profileSlug) {
              const profile = await this.agentProfilesService.findBySlug(profileSlug);
              if (!profile || !profile.enabled) {
                result = `Error: unknown agent profile "${profileSlug}"`;
              } else {
                promptOverride = profile.systemPrompt;
                allowedTools = profile.allowedTools;
              }
            }
            if (result === undefined) {
              const subTools = filterSubagentTools(activeTools, allowedTools);
              try {
                result = await this.subagentService.spawn(
                  task, providerType, model, providerConfig, subTools, signal, res, sessionId,
                  projectPath, promptOverride,
                );
              } catch (e) {
                result = `Error: Subagent failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
              }
            }
          }
        } else if (name === 'delegate') {
          const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
          const tasks = argsObj.tasks;
          const taskList = Array.isArray(tasks) ? tasks.map(String) : [];
          const profileSlug = argsObj.profile ? String(argsObj.profile) : undefined;

          if (taskList.length === 0) {
            result = 'Error: delegate requires a non-empty "tasks" array';
          } else {
            let promptOverride: string | undefined;
            let allowedTools: string | undefined;
            if (profileSlug) {
              const profile = await this.agentProfilesService.findBySlug(profileSlug);
              if (!profile || !profile.enabled) {
                result = `Error: unknown agent profile "${profileSlug}"`;
              } else {
                promptOverride = profile.systemPrompt;
                allowedTools = profile.allowedTools;
              }
            }
            if (result === undefined) {
              const subTools = filterSubagentTools(activeTools, allowedTools);
              try {
                result = await this.subagentService.delegate(
                  taskList, providerType, model, providerConfig, subTools, signal, res, sessionId,
                  projectPath, promptOverride,
                );
              } catch (e) {
                result = `Error: Delegate failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
              }
            }
          }
        } else {
          try {
            result = await this.executeTool(name, args, { sessionId: sessionId ?? 0, projectPath });
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
          }
        }

        if (result.startsWith('[PLAN_CREATED]')) {
          const idMatch = result.match(/id=(\d+)/);
          const approvalMatch = result.match(/requireApproval=(\w+)/);
          const titleMatch = result.match(/title="([^"]*)"/);

          const planId = idMatch ? parseInt(idMatch[1], 10) : 0;
          const requireApproval = approvalMatch ? approvalMatch[1] === 'true' : true;

          if (planId > 0) {
            const plan = await this.plansService.findOne(planId);

            res.write(`data: ${JSON.stringify({
              plan: {
                id: plan.id,
                title: plan.title,
                status: plan.status,
                steps: plan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
              },
            })}\n\n`);

            await this.savePlanExecutionMessage(sessionId, plan);

            if (requireApproval) {
              res.write('data: [DONE]\n\n');
              return finalText;
            } else {
              await this.executePlan(planId, providerType, model, systemPrompt, activeTools, providerConfig, signal, res, sessionId, projectPath);
              return finalText;
            }
          }
        }

        res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'tool', result, name, true);
        }

        messages.push({ role: 'tool', content: result, toolCallId });

        const linkMatch = result.match(/\[Download[^\]]+\]\(([^)]+)\)/);
        if (linkMatch) downloadLinks.push(linkMatch[1]);

        if (name === 'search_knowledge') {
          messages = await this.handleKnowledgeResult(messages, result, res, sessionId);
        }
      }
    }

    this.state = AgentState.RESPONDING;
    if (!signal.aborted) {
      for (const link of downloadLinks) {
        if (!finalText.includes(link)) {
          finalText += `\n\n📥 [Tải file xuống](${link})`;
        }
      }

      if (sessionId) {
        this.eventEmitter.emit('agent.idle', {
          sessionId,
          providerType,
          model,
          providerConfig,
        });
      }
      res.write('data: [DONE]\n\n');
    }

    return finalText;
  }

  async executePlan(
    planId: number,
    providerType: string,
    model: string,
    systemPrompt: string,
    tools: ToolDefinition[],
    providerConfig: { baseUrl: string; key?: string },
    signal: AbortSignal,
    res: WriteStream,
    sessionId?: number,
    projectPath?: string,
  ): Promise<void> {
    const plan = await this.plansService.findOne(planId);
    await this.plansService.updateStatus(planId, 'EXECUTING');

    const sortedSteps = [...plan.steps]
      .filter(s => s.status !== 'DONE')
      .sort((a, b) => a.order - b.order);

    let currentStepId: number | null = null;

    for (const step of sortedSteps) {
      currentStepId = step.id;
      if (signal.aborted) break;
      await this.plansService.updateStepStatus(step.id, 'DOING');
      if (!signal.aborted) res.write(
        `data: ${JSON.stringify({ planStepUpdate: { planId, stepId: step.id, status: 'DOING' } })}\n\n`,
      );
      if (sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'system', `Executing step: ${step.text}`);
      }

      try {
        const stepSystemPrompt = `${systemPrompt}\n\nYou are executing plan step ${step.order + 1}: "${step.text}". Complete only this step.`;
        const messages = this.llmController.buildMessages(stepSystemPrompt, [], step.text);
        await this.runForStep(model, messages, tools, providerConfig, res, sessionId, signal, providerType, projectPath);

        if (signal.aborted) break;
        await this.plansService.updateStepStatus(step.id, 'DONE');
        if (!signal.aborted) res.write(
          `data: ${JSON.stringify({ planStepUpdate: { planId, stepId: step.id, status: 'DONE' } })}\n\n`,
        );
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'system', `Step completed: ${step.text}`);
        }
      } catch {
        if (signal.aborted) break;
        await this.plansService.updateStepStatus(step.id, 'FAILED');
        if (!signal.aborted) res.write(
          `data: ${JSON.stringify({ planStepUpdate: { planId, stepId: step.id, status: 'FAILED' } })}\n\n`,
        );
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'system', `Step failed: ${step.text}`);
        }
      }
    }

    if (signal.aborted) {
      res.write(`data: ${JSON.stringify({ planInterrupted: { planId, stepId: currentStepId, reason: 'user_stopped' } })}\n\n`);
      res.write('data: [DONE]\n\n');
      if (sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'system', '[Plan execution interrupted by user]');
      }
      await this.plansService.setInterrupted(planId);
    } else {
      await this.plansService.updateStatus(planId, 'DONE');
      res.write('data: [DONE]\n\n');
    }
  }

  private async savePlanExecutionMessage(sessionId: number | undefined, plan: { id: number; title: string; status: string; steps: Array<{ id: number; order: number; text: string; status: string }> }) {
    if (sessionId) {
      await this.sessionsService.saveMessage(
        sessionId, 'plan',
        JSON.stringify({
          id: plan.id, title: plan.title, status: plan.status,
          steps: plan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
        }),
      );
      await this.sessionsService.saveMessage(
        sessionId, 'system',
        `[Plan] ${plan.title} — ${plan.steps.length} steps created`,
      );
    }
  }

  async runPlanMode(
    taskText: string,
    providerType: string,
    model: string,
    providerConfig: { baseUrl: string; key?: string },
    sessionId: number,
    res: WriteStream,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) {
      res.write('data: [DONE]\n\n');
      return;
    }

    const planningPrompt =
      'You are in Plan Mode. Output ONLY a JSON object — no prose, no markdown, no code fences.\n' +
      'Format: { "title": "short plan title", "steps": ["step 1", "step 2", ...] }\n' +
      'Maximum 10 steps. Be specific and actionable.';

    res.write(`data: ${JSON.stringify({ thinking: 'Generating plan...' })}\n\n`);

    const messages: OllamaMessage[] = [
      { role: 'system', content: planningPrompt },
      { role: 'user', content: taskText },
    ];

    let fullText = '';
    const stream = this.llmController.stream(
      providerType, model, messages, [], signal ?? new AbortController().signal,
      providerConfig.baseUrl, providerConfig.key,
    );

    for await (const chunk of stream) {
      if (chunk.type === 'token' && chunk.token) fullText += chunk.token;
      if (chunk.type === 'error') break;
      if (chunk.type === 'done') break;
    }

    let planData: { title: string; steps: string[] };
    try {
      planData = JSON.parse(fullText) as { title: string; steps: string[] };
      if (!planData.title || !Array.isArray(planData.steps)) throw new Error('invalid shape');
    } catch {
      res.write(
        `data: ${JSON.stringify({ error: 'Agent failed to produce a valid plan. Try again.' })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      return;
    }

    const plan = await this.plansService.create(sessionId, planData.title, planData.steps);

    if (sessionId) {
      await this.sessionsService.saveMessage(sessionId, 'system', `[Plan] ${plan.title} — ${plan.steps.length} steps created`);
      await this.sessionsService.saveMessage(sessionId, 'plan', JSON.stringify({
        id: plan.id, title: plan.title, status: plan.status, steps: plan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
      }));
    }

    res.write(
      `data: ${JSON.stringify({
        plan: {
          id: plan.id,
          title: plan.title,
          status: plan.status,
          steps: plan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
        },
      })}\n\n`,
    );
    res.write('data: [DONE]\n\n');
  }

  private async executeStep(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    providerConfig: { baseUrl: string; key?: string },
    res: WriteStream,
    sessionId?: number,
    providerType: string = 'ollama',
  ): Promise<{ text: string; toolCalls: Array<{ name: string; arguments: unknown }>; reasoningContent?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    let text = '';
    const toolCalls: Array<{ name: string; arguments: unknown }> = [];
    let reasoningContent = '';
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    const stream = this.llmController.stream(
      providerType, model, messages, tools, signal,
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
          if (chunk.toolCall) {
            toolCalls.push(chunk.toolCall);
            if (chunk.reasoningContent) reasoningContent = chunk.reasoningContent;
          }
          break;
        case 'error':
          res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
          throw new Error(chunk.error);
        case 'done':
          if (chunk.usage) {
            usage = chunk.usage;
          }
          break;
      }
    }

    return { text, toolCalls, reasoningContent: reasoningContent || undefined, usage };
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
    reasoningContent?: string,
  ): OllamaMessage[] {
    return [
      ...messages,
      {
        role: 'assistant',
        content: text || '',
        reasoningContent,
        toolCalls: toolCalls.map((tc, i) => ({
          id: `call_${i}_${tc.name}`,
          function: { name: tc.name, arguments: this.normalizeArgs(tc.arguments) },
        })),
      },
    ];
  }

  private async handleKnowledgeResult(
    messages: OllamaMessage[],
    result: string,
    res: WriteStream,
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

  private async executeTool(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const executor = this.executorMap.get(name);
    if (executor) return executor.execute(args, context);
    const mcpResult = await this.mcpService.tryExecute(name, args);
    if (mcpResult !== null) return mcpResult;
    return `Error: Unknown tool: ${name}`;
  }

  private buildTranscript(messages: OllamaMessage[]): string {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  private async runForStep(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    providerConfig: { baseUrl: string; key?: string },
    res: WriteStream,
    sessionId?: number,
    parentSignal?: AbortSignal,
    providerType: string = 'ollama',
    projectPath?: string,
  ): Promise<void> {
    const signal = parentSignal ?? new AbortController().signal;
    let currentMessages = [...messages];
    let iterations = 0;

    while (!signal.aborted && iterations < MAX_ITERATIONS) {
      iterations++;
      const { text, toolCalls, reasoningContent } = await this.executeStep(
        model, currentMessages, tools, signal, providerConfig, res, sessionId, providerType,
      );

      if (toolCalls.length === 0) {
        if (text && sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'assistant', text);
        }
        break;
      }

      currentMessages = this.addToolCallsToMessages(currentMessages, text, toolCalls, reasoningContent);

      for (let ti = 0; ti < toolCalls.length; ti++) {
        const tc = toolCalls[ti];
        const name = tc.name;
        const toolCallId = `call_${ti}_${name}`;
        const args = this.normalizeArgs(tc.arguments);
        res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
        }

        const toolInput = JSON.stringify(args);
        const transcript = this.buildTranscript(currentMessages);
        const decision = await this.permissionsService.decide(name, toolInput, transcript, sessionId);

        if (decision.action === 'allow') {
          // execute tool — fall through to executeTool below
        } else if (decision.action === 'deny') {
          const denialResult = `Tool '${name}' is not permitted by workspace policy.${decision.reason ? ' ' + decision.reason : ''}`;
          res.write(`data: ${JSON.stringify({ toolResult: { name, result: denialResult } })}\n\n`);
          if (sessionId) {
            await this.sessionsService.saveMessage(sessionId, 'tool', denialResult, name, true);
          }
          currentMessages.push({ role: 'tool', content: denialResult, toolCallId });
          continue;
        } else if (decision.action === 'ask') {
          const approvalId = crypto.randomUUID();
          res.write(`data: ${JSON.stringify({ toolApprovalRequired: { id: approvalId, name, args } })}\n\n`);

          const approved = await this.approvalManager.requestApproval(approvalId, name, args, sessionId ?? 0);

          if (approved) {
            // execute tool — fall through to executeTool below
          } else {
            res.write(`data: ${JSON.stringify({ toolResult: { name, result: 'Tool execution denied by user' } })}\n\n`);
            if (sessionId) {
              await this.sessionsService.saveMessage(sessionId, 'tool', 'Tool execution denied by user', name, true);
            }
            currentMessages.push({ role: 'tool', content: 'Tool execution denied by user', toolCallId });
            continue;
          }
        }

        let result: string;
        try {
          result = await this.executeTool(name, args, { sessionId: sessionId ?? 0, projectPath });
        } catch (e) {
          result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
        res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'tool', result, name, true);
        }
        currentMessages.push({ role: 'tool', content: result, toolCallId });
      }
    }
  }
}
