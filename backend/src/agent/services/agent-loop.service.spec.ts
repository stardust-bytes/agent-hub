import { Test, TestingModule } from '@nestjs/testing';
import { AgentLoopService } from './agent-loop.service';
import { LLMControllerService } from './llm-controller.service';
import { SessionsService } from '../../sessions/sessions.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
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
import { UsageService } from '../../usage/usage.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PermissionsService } from './permissions.service';
import { ApprovalManagerService } from './approval-manager.service';
import { PlansService } from '../../plans/plans.service';
import { McpService } from '../mcp/mcp.service';
import { SubagentService } from '../subagent/subagent.service';
import { AgentProfilesService } from '../../agent-profiles/agent-profiles.service';
import { StreamChunk } from '../providers/llm-provider.interface';
import { Response } from 'express';

function mockRes(): Response {
  return {
    write: jest.fn(() => true),
    end: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
  } as any;
}

async function* asyncGen<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

function buildStreamMock(...responses: StreamChunk[][]) {
  const genFns = responses.map((items) => () => asyncGen(items));
  let idx = 0;
  return jest.fn().mockImplementation(() => {
    const fn = genFns[Math.min(idx++, genFns.length - 1)];
    return fn();
  });
}

const DONE: StreamChunk = { type: 'done' };

describe('AgentLoopService', () => {
  let service: AgentLoopService;
  let llmController: LLMControllerService;
  let sessionsService: SessionsService;
  let webFetch: WebFetchExecutor;
  let webSearch: WebSearchExecutor;
  let createTask: CreateTaskExecutor;
  let permissionsService: { decide: jest.Mock };
  let plansService: typeof mockPlansService;
  let createPlanExec: { name: string; execute: jest.Mock };
  let agentProfilesService: { findBySlug: jest.Mock };
  let subagentService: { spawn: jest.Mock; delegate: jest.Mock };

  const defaultTools = [
    { type: 'function' as const, function: { name: 'web_search', description: 'Search the web', parameters: {} } },
    { type: 'function' as const, function: { name: 'web_fetch', description: 'Fetch a URL', parameters: {} } },
    { type: 'function' as const, function: { name: 'create_task', description: 'Create a task', parameters: {} } },
  ];
  const mockPlansService = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateStepStatus: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentLoopService,
        {
          provide: LLMControllerService,
          useValue: {
            stream: jest.fn(),
            buildMessages: jest.fn().mockImplementation(
              (prompt: string, history: any[], msg: string) => [
                { role: 'system', content: prompt },
                ...history,
                { role: 'user', content: msg },
              ],
            ),
          },
        },
        { provide: SessionsService, useValue: { saveMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: KnowledgeService, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
        { provide: CreateTaskExecutor, useValue: { name: 'create_task', execute: jest.fn() } },
        { provide: UpdateTaskExecutor, useValue: { name: 'update_task', execute: jest.fn() } },
        { provide: ListTasksExecutor, useValue: { name: 'list_tasks', execute: jest.fn() } },
        { provide: GetTaskExecutor, useValue: { name: 'get_task', execute: jest.fn() } },
        { provide: DeleteTasksExecutor, useValue: { name: 'delete_tasks', execute: jest.fn() } },
        { provide: SearchKnowledgeExecutor, useValue: { name: 'search_knowledge', execute: jest.fn() } },
        { provide: WebFetchExecutor, useValue: { name: 'web_fetch', execute: jest.fn() } },
        { provide: WebSearchExecutor, useValue: { name: 'web_search', execute: jest.fn() } },
        { provide: CreateNoteExecutor, useValue: { name: 'create_note', execute: jest.fn() } },
        { provide: UpdateNoteExecutor, useValue: { name: 'update_note', execute: jest.fn() } },
        { provide: ListNotesExecutor, useValue: { name: 'list_notes', execute: jest.fn() } },
        { provide: DeleteNoteExecutor, useValue: { name: 'delete_note', execute: jest.fn() } },
        { provide: ConvertNoteToTaskExecutor, useValue: { name: 'convert_note_to_task', execute: jest.fn() } },
        { provide: WriteFileExecutor, useValue: { name: 'write_file', execute: jest.fn() } },
        { provide: ReadFileExecutor, useValue: { name: 'read_file', execute: jest.fn() } },
        { provide: ListDirectoryExecutor, useValue: { name: 'list_directory', execute: jest.fn() } },
        { provide: RunCommandExecutor, useValue: { name: 'run_command', execute: jest.fn() } },
        { provide: GrepExecutor, useValue: { name: 'grep', execute: jest.fn() } },
        { provide: GlobExecutor, useValue: { name: 'glob', execute: jest.fn() } },
        { provide: ResumePlanExecutor, useValue: { name: 'resume_plan', execute: jest.fn() } },
        { provide: CreatePlanExecutor, useValue: { name: 'create_plan', execute: jest.fn() } },
        { provide: ReadExcelExecutor, useValue: { name: 'read_excel', execute: jest.fn() } },
        { provide: WriteExcelExecutor, useValue: { name: 'write_excel', execute: jest.fn() } },
        { provide: ExcelAddSheetExecutor, useValue: { name: 'excel_add_sheet', execute: jest.fn() } },
        { provide: ListExcelSheetsExecutor, useValue: { name: 'list_excel_sheets', execute: jest.fn() } },
        { provide: ExcelChartExecutor, useValue: { name: 'excel_chart', execute: jest.fn() } },
        { provide: PermissionsService, useValue: { decide: jest.fn().mockResolvedValue({ action: 'allow' }) } },
        { provide: ApprovalManagerService, useValue: { requestApproval: jest.fn().mockResolvedValue(true) } },
        { provide: PlansService, useValue: mockPlansService },
        { provide: McpService, useValue: { tryExecute: jest.fn().mockResolvedValue(null) } },
        { provide: SubagentService, useValue: { spawn: jest.fn().mockResolvedValue('subagent result'), delegate: jest.fn().mockResolvedValue('delegate result') } },
        { provide: AgentProfilesService, useValue: { findBySlug: jest.fn().mockResolvedValue(null) } },
        { provide: ReadWordExecutor, useValue: { name: 'read_word', execute: jest.fn() } },
        { provide: WriteWordExecutor, useValue: { name: 'write_word', execute: jest.fn() } },
        { provide: EditWordExecutor, useValue: { name: 'edit_word', execute: jest.fn() } },
        { provide: GoogleGmailSearchExecutor, useValue: { name: 'google_gmail_search', execute: jest.fn() } },
        { provide: GoogleGmailReadExecutor, useValue: { name: 'google_gmail_read', execute: jest.fn() } },
        { provide: GoogleGmailSendExecutor, useValue: { name: 'google_gmail_send', execute: jest.fn() } },
        { provide: GoogleGmailDraftExecutor, useValue: { name: 'google_gmail_draft', execute: jest.fn() } },
        { provide: GoogleGmailLabelsExecutor, useValue: { name: 'google_gmail_labels', execute: jest.fn() } },
        { provide: GoogleCalendarListExecutor, useValue: { name: 'google_calendar_list', execute: jest.fn() } },
        { provide: GoogleCalendarCreateExecutor, useValue: { name: 'google_calendar_create', execute: jest.fn() } },
        { provide: GoogleCalendarUpdateExecutor, useValue: { name: 'google_calendar_update', execute: jest.fn() } },
        { provide: GoogleCalendarAvailabilityExecutor, useValue: { name: 'google_calendar_availability', execute: jest.fn() } },
        { provide: GoogleDriveSearchExecutor, useValue: { name: 'google_drive_search', execute: jest.fn() } },
        { provide: GoogleDriveReadExecutor, useValue: { name: 'google_drive_read', execute: jest.fn() } },
        { provide: GoogleDriveListExecutor, useValue: { name: 'google_drive_list', execute: jest.fn() } },
        { provide: GoogleDriveUploadExecutor, useValue: { name: 'google_drive_upload', execute: jest.fn() } },
        { provide: GoogleDriveCreateFolderExecutor, useValue: { name: 'google_drive_create_folder', execute: jest.fn() } },
        { provide: GoogleSheetsReadExecutor, useValue: { name: 'google_sheets_read', execute: jest.fn() } },
        { provide: GoogleSheetsListTabsExecutor, useValue: { name: 'google_sheets_list_tabs', execute: jest.fn() } },
        { provide: GoogleSheetsUpdateExecutor, useValue: { name: 'google_sheets_update', execute: jest.fn() } },
        { provide: GoogleSheetsAppendExecutor, useValue: { name: 'google_sheets_append', execute: jest.fn() } },
        { provide: GoogleSheetsCreateExecutor, useValue: { name: 'google_sheets_create', execute: jest.fn() } },
        { provide: GoogleSheetsAddTabExecutor, useValue: { name: 'google_sheets_add_tab', execute: jest.fn() } },
        { provide: GoogleSheetsFormatExecutor, useValue: { name: 'google_sheets_format', execute: jest.fn() } },
        { provide: GoogleSheetsChartExecutor, useValue: { name: 'google_sheets_chart', execute: jest.fn() } },
        { provide: UsageService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(AgentLoopService);
    llmController = module.get(LLMControllerService);
    sessionsService = module.get(SessionsService);
    webFetch = module.get(WebFetchExecutor);
    webSearch = module.get(WebSearchExecutor);
    createTask = module.get(CreateTaskExecutor);
    permissionsService = module.get(PermissionsService);
    plansService = module.get(PlansService);
    createPlanExec = module.get(CreatePlanExecutor);
    agentProfilesService = module.get(AgentProfilesService);
    subagentService = module.get(SubagentService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Basic flow', () => {
    it('Planning → Executing (no tool calls) → Responding → Done', async () => {
      llmController.stream = buildStreamMock(
        [{ type: 'token', token: 'Hello from AI' }, DONE],
      );

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'hi',
        defaultTools, res, signal, undefined,
      );

      expect(result).toBe('Hello from AI');
      expect(llmController.stream).toHaveBeenCalledTimes(1);
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('Tool call flow', () => {
    it('Planning → Executing (tool call) → Evaluating → Executing (next step)', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'test query' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'Here are the search results' }, DONE],
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('Found relevant results');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'search for X',
        defaultTools, res, signal, undefined,
      );

      expect(result).toBe('Here are the search results');
      expect(webSearch.execute).toHaveBeenCalledWith({ q: 'test query' }, { sessionId: 0 });
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ toolCall: { name: 'web_search', args: { q: 'test query' } } }) + '\n\n',
      );
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ toolResult: { name: 'web_search', result: 'Found relevant results' } }) + '\n\n',
      );
      expect(llmController.stream).toHaveBeenCalledTimes(2);
    });
  });

  describe('Max iterations', () => {
    it('generates a closing message when LLM returns text without tool calls', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'test' } },
      };
      const closeToken: StreamChunk = {
        type: 'token',
        token: 'I tried searching but could not find the results you wanted. Would you like to try a different approach?',
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [closeToken, DONE],
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('Succeed');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'loop',
        defaultTools, res, signal, 1,
      );

      expect(llmController.stream).toHaveBeenCalledTimes(11);
      expect(result).toContain('Would you like to try a different approach');
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('Permissions', () => {
    it('skips denied tool and emits denial toolResult', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_fetch', arguments: { url: 'http://example.com' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'I cannot fetch that URL' }, DONE],
      );
      permissionsService.decide.mockImplementation(async (name: string) =>
        name === 'web_fetch' ? { action: 'deny' } : { action: 'allow' },
      );

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'fetch URL',
        defaultTools, res, signal, undefined,
      );

      expect(webFetch.execute).not.toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ toolResult: { name: 'web_fetch', result: "Tool 'web_fetch' is not permitted by workspace policy." } }) + '\n\n',
      );
      expect(result).toBe('I cannot fetch that URL');
    });
  });

  describe('Agent profile dispatch', () => {
    it('returns an error tool result for an unknown agent profile slug', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'spawn_subagent', arguments: { task: 'do something', profile: 'nope' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'Done' }, DONE],
      );
      agentProfilesService.findBySlug.mockResolvedValue(null);

      const res = mockRes();
      const signal = new AbortController().signal;
      await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'spawn with bad profile',
        defaultTools, res, signal, undefined,
      );

      expect(agentProfilesService.findBySlug).toHaveBeenCalledWith('nope');
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('unknown agent profile'),
      );
    });

    it('applies the profile system prompt and scoped tools to a spawned sub-agent', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'spawn_subagent', arguments: { task: 'research X', profile: 'researcher' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'Done' }, DONE],
      );
      agentProfilesService.findBySlug.mockResolvedValue({
        slug: 'researcher', enabled: true, systemPrompt: 'You research.', allowedTools: '["web_search"]',
      });

      const res = mockRes();
      const signal = new AbortController().signal;
      await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'spawn with profile',
        defaultTools, res, signal, undefined,
      );

      expect(agentProfilesService.findBySlug).toHaveBeenCalledWith('researcher');
      expect(subagentService.spawn).toHaveBeenCalledTimes(1);
      const callArgs = subagentService.spawn.mock.calls[0];
      expect(callArgs[0]).toBe('research X');
      const passedToolNames = (callArgs[4] as Array<{ function: { name: string } }>).map(t => t.function.name);
      expect(passedToolNames).toEqual(['web_search']);
      expect(callArgs[9]).toBe('You research.');
    });

    it('returns an error and does not delegate when the profile is disabled', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'delegate', arguments: { tasks: ['a', 'b'], profile: 'off' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'Done' }, DONE],
      );
      agentProfilesService.findBySlug.mockResolvedValue({
        slug: 'off', enabled: false, systemPrompt: 'x', allowedTools: '*',
      });

      const res = mockRes();
      const signal = new AbortController().signal;
      await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'delegate with disabled profile',
        defaultTools, res, signal, undefined,
      );

      expect(subagentService.delegate).not.toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('unknown agent profile'));
    });
  });

  describe('runPlanMode', () => {
    const planConfig = { baseUrl: 'http://localhost:11434' };

    it('emits thinking event, then plan event, then DONE', async () => {
      const res = mockRes();
      const planJson = JSON.stringify({ title: 'Test Plan', steps: ['Do A', 'Do B'] });
      (llmController.stream as jest.Mock) = buildStreamMock([
        { type: 'token', token: planJson },
        DONE,
      ]);
      const createdPlan = {
        id: 42,
        title: 'Test Plan',
        status: 'PENDING',
        steps: [
          { id: 1, planId: 42, order: 0, text: 'Do A', status: 'TODO' },
          { id: 2, planId: 42, order: 1, text: 'Do B', status: 'TODO' },
        ],
      };
      mockPlansService.create.mockResolvedValue(createdPlan);

      await service.runPlanMode('Do A and B', 'ollama', 'llama3.2', planConfig, 1, res);

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"thinking"')
      );
      expect(mockPlansService.create).toHaveBeenCalledWith(1, 'Test Plan', ['Do A', 'Do B']);
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"plan"')
      );
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });

    it('emits error event when LLM returns non-JSON', async () => {
      const res = mockRes();
      (llmController.stream as jest.Mock) = buildStreamMock([
        { type: 'token', token: 'not valid json here' },
        DONE,
      ]);

      await service.runPlanMode('task', 'ollama', 'llama3.2', planConfig, 1, res);

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
      expect(mockPlansService.create).not.toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('PLAN_CREATED detection', () => {
    it('emits plan SSE and [DONE] when requireApproval=true, skips toolResult', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'create_plan', arguments: { title: 'Test Plan', steps: ['Step 1'] } },
      };
      llmController.stream = buildStreamMock(
        [{ type: 'token', token: 'I will create a plan' }, toolCall, DONE],
      );
      createPlanExec.execute.mockResolvedValue('[PLAN_CREATED] id=1 requireApproval=true title="Test Plan"');
      mockPlansService.findOne.mockResolvedValue({
        id: 1,
        title: 'Test Plan',
        status: 'PENDING',
        steps: [{ id: 10, planId: 1, order: 0, text: 'Step 1', status: 'TODO' }],
      });

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'create a plan',
        defaultTools, res, signal, 1,
      );

      expect(result).toBe('I will create a plan');
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ plan: { id: 1, title: 'Test Plan', status: 'PENDING', steps: [{ id: 10, order: 0, text: 'Step 1', status: 'TODO' }] } }) + '\n\n',
      );
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockPlansService.findOne).toHaveBeenCalledWith(1);
      expect(mockPlansService.updateStatus).not.toHaveBeenCalledWith(1, 'EXECUTING');
      const toolResultCalls = (res.write as jest.Mock).mock.calls.filter(
        (c: string[]) => typeof c[0] === 'string' && c[0].includes('"toolResult"') && c[0].includes('create_plan'),
      );
      expect(toolResultCalls.length).toBe(0);
    });

    it('calls executePlan when requireApproval=false', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'create_plan', arguments: { title: 'Auto Plan', steps: ['Step 1'] } },
      };
      llmController.stream = buildStreamMock(
        [{ type: 'token', token: 'Auto creating plan' }, toolCall, DONE],
        [{ type: 'token', token: 'Step 1 done' }, DONE],
      );
      createPlanExec.execute.mockResolvedValue('[PLAN_CREATED] id=2 requireApproval=false title="Auto Plan"');
      mockPlansService.findOne.mockResolvedValue({
        id: 2,
        title: 'Auto Plan',
        status: 'APPROVED',
        steps: [{ id: 20, planId: 2, order: 0, text: 'Step 1', status: 'TODO' }],
      });

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'auto plan',
        defaultTools, res, signal, 1,
      );

      expect(result).toBe('Auto creating plan');
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"plan"'),
      );
      expect(mockPlansService.updateStatus).toHaveBeenCalledWith(2, 'EXECUTING');
      expect(createPlanExec.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('executePlan', () => {
    const planConfig = { baseUrl: 'http://localhost:11434' };
    const tools = [
      { type: 'function' as const, function: { name: 'list_tasks', description: 'List', parameters: {} } },
    ];

    it('executes each step and emits planStepUpdate DOING then DONE', async () => {
      const res = mockRes();
      const plan = {
        id: 7,
        title: 'My Plan',
        status: 'APPROVED',
        steps: [
          { id: 10, planId: 7, order: 0, text: 'Step one', status: 'TODO' },
          { id: 11, planId: 7, order: 1, text: 'Step two', status: 'TODO' },
        ],
      };
      mockPlansService.findOne.mockResolvedValue(plan);
      mockPlansService.updateStatus.mockResolvedValue({ ...plan, status: 'EXECUTING' });
      mockPlansService.updateStepStatus.mockResolvedValue({ id: 10, status: 'DOING' });

      (llmController.stream as jest.Mock) = buildStreamMock(
        [{ type: 'token', token: 'Done step 1' }, DONE],
        [{ type: 'token', token: 'Done step 2' }, DONE],
      );

      await service.executePlan(7, 'ollama', 'llama3.2', 'System prompt', tools, planConfig, new AbortController().signal, res);

      expect(mockPlansService.updateStatus).toHaveBeenCalledWith(7, 'EXECUTING');

      const writeCalls = (res.write as jest.Mock).mock.calls.map(c => c[0] as string);
      const doingCalls = writeCalls.filter(s => s.includes('"DOING"'));
      const doneCalls = writeCalls.filter(s => s.includes('"DONE"'));
      expect(doingCalls.length).toBe(2);
      expect(doneCalls.length).toBe(2);

      expect(writeCalls[writeCalls.length - 1]).toBe('data: [DONE]\n\n');
    });

    it('saves LLM response as assistant message for each step', async () => {
      const res = mockRes();
      const plan = {
        id: 7, title: 'My Plan', status: 'APPROVED',
        steps: [
          { id: 10, planId: 7, order: 0, text: 'Step one', status: 'TODO' },
        ],
      };
      mockPlansService.findOne.mockResolvedValue(plan);
      mockPlansService.updateStatus.mockResolvedValue({ ...plan, status: 'EXECUTING' });
      mockPlansService.updateStepStatus.mockResolvedValue({});

      (llmController.stream as jest.Mock) = buildStreamMock(
        [{ type: 'token', token: 'Response text from LLM' }, DONE],
      );

      await service.executePlan(7, 'ollama', 'llama3.2', 'System prompt', tools, planConfig, new AbortController().signal, res, 1);

      expect(sessionsService.saveMessage).toHaveBeenCalledWith(1, 'assistant', 'Response text from LLM');
    });

    it('marks step FAILED and continues when LLM stream emits error', async () => {
      const res = mockRes();
      const plan = {
        id: 7,
        title: 'Plan',
        status: 'APPROVED',
        steps: [
          { id: 10, planId: 7, order: 0, text: 'Failing step', status: 'TODO' },
          { id: 11, planId: 7, order: 1, text: 'Good step', status: 'TODO' },
        ],
      };
      mockPlansService.findOne.mockResolvedValue(plan);
      mockPlansService.updateStatus.mockResolvedValue({});
      mockPlansService.updateStepStatus.mockResolvedValue({});

      (llmController.stream as jest.Mock) = buildStreamMock(
        [{ type: 'error', error: 'LLM error' }, DONE],
        [{ type: 'token', token: 'Step 2 OK' }, DONE],
      );

      await service.executePlan(7, 'ollama', 'llama3.2', 'System', tools, planConfig, new AbortController().signal, res);

      const writeCalls = (res.write as jest.Mock).mock.calls.map(c => c[0] as string);
      const failedCalls = writeCalls.filter(s => s.includes('"FAILED"'));
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
      expect(writeCalls[writeCalls.length - 1]).toBe('data: [DONE]\n\n');
    });
  });

  describe('Stop / Abort signal', () => {
    async function* slowGen<T>(items: T[], delayMs: number): AsyncGenerator<T> {
      for (const item of items) {
        await new Promise(r => setTimeout(r, delayMs));
        yield item;
      }
    }

    it('stops the loop when aborted between iterations — LLM not called again', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'test' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'should not happen' }, DONE],
      );
      permissionsService.decide.mockImplementation(() =>
        new Promise(r => setTimeout(() => r({ action: 'allow' }), 50)),
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('result');

      const ctrl = new AbortController();
      const res = mockRes();

      const promise = service.run(
        'ollama', 'llama3', 'You are helpful', [], 'test',
        defaultTools, res, ctrl.signal, undefined,
      );

      await new Promise(r => setTimeout(r, 10));
      ctrl.abort();

      await promise;
      expect(llmController.stream).toHaveBeenCalledTimes(1);
      expect(webSearch.execute).not.toHaveBeenCalled();
      expect(res.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
    });

    it('prevents tool execution when aborted before first tool', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'secret' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'I cannot search' }, DONE],
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('SHOULD NOT RUN');

      const ctrl = new AbortController();
      ctrl.abort();
      const res = mockRes();

      await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'test',
        defaultTools, res, ctrl.signal, undefined,
      );

      expect(webSearch.execute).not.toHaveBeenCalled();
      expect(llmController.stream).toHaveBeenCalledTimes(0);
      expect(res.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
    });

    it('enforces MAX_MAIN_ITERATIONS and emits limit message', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'loop' } },
      };
      const responses: StreamChunk[][] = [];
      for (let i = 0; i < 52; i++) {
        responses.push([toolCall, DONE]);
      }
      llmController.stream = buildStreamMock(...responses);
      (webSearch.execute as jest.Mock).mockResolvedValue('ok');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'loop',
        defaultTools, res, signal, 1,
      );

      expect(llmController.stream).toHaveBeenCalledTimes(50);
      expect(result).toContain('maximum number of iterations');
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });

    it('stops subagent spawn when signal is aborted during resolveProfile', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'spawn_subagent', arguments: { task: 'do work', profile: 'researcher' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'Done' }, DONE],
      );
      agentProfilesService.findBySlug.mockImplementation(() =>
        new Promise(r => setTimeout(() => r({
          slug: 'researcher', enabled: true, systemPrompt: 'You research.', allowedTools: '["web_search"]',
        }), 50)),
      );

      const ctrl = new AbortController();
      const res = mockRes();

      const promise = service.run(
        'ollama', 'llama3', 'You are helpful', [], 'spawn',
        defaultTools, res, ctrl.signal, 1,
      );

      await new Promise(r => setTimeout(r, 10));
      ctrl.abort();

      await promise;
      expect(subagentService.spawn).not.toHaveBeenCalled();
    });
  });
});
