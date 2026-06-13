import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { AgentRunState } from '../dto/agent-run-state';
import { ToolsService } from '../../tools/tools.service';
import { McpService } from '../mcp/mcp.service';
import { CoworkService } from '../../cowork/cowork.service';
import { ModePolicyService } from '../../mode-policy/mode-policy.service';
import { MemoryService } from '../../memory/memory.service';
import { ToolDefinition } from '../../mode-policy/mode-policy.config';
export { ToolDefinition };

export interface AgentContext {
  systemPrompt: string;
  messages: OllamaMessage[];
  tools: ToolDefinition[];
}

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: ToolsService,
    private readonly mcpService: McpService,
    private readonly cowork: CoworkService,
    private readonly modePolicy: ModePolicyService,
    private readonly memoryService: MemoryService,
  ) {}

  async build(
    runState: AgentRunState,
    sessionId: number,
    systemPromptOverride?: string,
  ): Promise<AgentContext> {
    const tools = await this.getEnabledTools();
    const project = await this.cowork.getProject();
    const memoryContext = await this.memoryService.getContextMemories();

    const systemPrompt = systemPromptOverride || this.buildSystemPrompt(tools, project, memoryContext);

    const messages = await this.loadChatHistory(sessionId);

    return { systemPrompt, messages, tools };
  }

  addUserMessage(context: AgentContext, content: string): void {
    context.messages.push({ role: 'user', content });
  }

  addAssistantMessage(context: AgentContext, content: string): void {
    context.messages.push({ role: 'assistant', content });
  }

  private async loadChatHistory(sessionId: number): Promise<OllamaMessage[]> {
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    const validRoles = new Set(['system', 'user', 'assistant', 'tool']);
    return history
      .filter(m => validRoles.has(m.role))
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  private buildSystemPrompt(tools: ToolDefinition[], projectPath?: string | null, memoryContext?: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

    const lines: string[] = [
      'You are a helpful AI assistant with access to the following tools:',
    ];

    for (const tool of tools) {
      lines.push(`- ${tool.function.name}: ${tool.function.description}`);
    }

    lines.push('',
      '',
      'TOOL RE-EXECUTION RULE (CRITICAL):',
      'You MUST call the appropriate tool EVERY time the user requests an action, even if you previously called the same tool.',
      'Previous tool calls in this conversation do NOT satisfy new requests with different parameters.',
      'Never respond with just text describing what you would do — always execute the tool with the actual parameters.',
      '',
      'TOOL PRIORITY RULE:',
      'When a task can be done by both a native tool (e.g., google_drive_*, google_gmail_*, google_calendar_*) and an MCP tool (mcp__*), ALWAYS prefer the native tool first.',
      'Only fall back to MCP tools if the native tool cannot fulfill the request or returns an error.',
      'Native tools are faster, more reliable, and better integrated with connected accounts.',
    );

    lines.push('',
      '',
      'When to use create_plan:',
      '- Call create_plan for complex multi-step tasks that need sequential coordination.',
      '- Always set requireApproval=false — plans execute automatically.',
      '- The user trusts you to decide when and how to break down work.',
      '- Do not ask for approval or confirmation before executing plans.',
      '- Do NOT use create_plan for single-step tasks — use the appropriate tool directly.',
    );
    lines.push('',
      '',
      'When handling complex multi-step tasks:',
      '- Use the delegate tool to run subtasks in parallel workers for independent sub-tasks like reading multiple files, processing separate datasets, or searching different sources.',
      '- Break the task into self-contained subtasks — each must be completable without seeing other subtask results.',
      '- Do NOT wait for user approval — delegate automatically.',
      '- After all subtasks complete, synthesize the results into a coherent answer.',
      '- Each subtask description should include all context needed (file paths, search queries, instructions).',
      '- Do NOT use delegate for single-step tasks — use the appropriate tool directly.',
    );

    lines.push('',
      'When handling knowledge base searches (search_knowledge tool):',
      '- If results are found: synthesize into a coherent answer. Cite each fact inline with [Source: "filename", §N]. §N is the document section number (e.g., §I, §2.1, §A). Use the section number from the chunk metadata. Cite all sources that agree.',
      '- If no results AND the question is about internal documents (reports, contracts, procedures, company-specific data): DO NOT use general knowledge. Acknowledge the gap, then either ask 1-2 clarifying questions (if the query is vague) or suggest uploading relevant documents.',
      '- If no results AND the question is general knowledge (concepts, how-to, definitions): answer from your own knowledge with a clear disclaimer such as "Based on general knowledge (not from your documents):..."',
      '',
      'To ask the user for structured input, output a form using:',
      '```form',
      '<label>Field name: <input name="field_name" placeholder="Enter..."></label>',
      '<label>Choice: <select name="choice"><option>A</option><option>B</option></select></label>',
      '<button type="submit">Submit</button>',
      '```',
      'Supported: <input>, <select><option>, <textarea>, <label>, <button type="submit">.',
      'When the user submits, you will receive the data as a JSON object.',
      '',
      'Respond in the same language the user writes in.',
      'Use the provided tools when appropriate to fulfill user requests.',
      '',
      'Task and Note Management Policy:',
      '- Task tools (create_task, update_task, delete_tasks, convert_note_to_task)',
      '  and note tools (create_note, update_note, delete_note) must ONLY be used',
      '  when the user explicitly requests task or note management.',
      '- Do NOT create, modify, or delete tasks or notes autonomously.',
      '- Read-only tools (list_tasks, get_task, list_notes) may be used to check',
      '  existing data when contextually relevant.',
      '',
      'System Environment:',
      `  Platform: ${process.platform}`,
      '',
      `Current date: ${dateStr}`,
      `Current time: ${timeStr}`,
    );

    if (projectPath) {
      lines.push('',
        `Current working project: ${projectPath}`,
        '',
        'FILE CREATION RULES (CRITICAL):',
        '- To create or write any file, you MUST call the appropriate tool: write_file, write_word, write_excel, etc.',
        '- NEVER claim you created a file in your text response without calling the tool first.',
        '- Saying "I have created the file" in text does NOT actually create the file — only a tool call does.',
        '- After calling a write tool, the result will confirm the file was created.',
        '- If a tool is not available for the file type you need, use write_file for plain text files.',
      );
    }

    lines.push('',
      '',
      'When using browser automation tools (mcp__playwright__browser_*):',
      '',
      'GENERAL WORKFLOW (apply to ANY website):',
      '',
      'Step 1: Call browser_navigate to open the target URL.',
      'Step 2: Call browser_snapshot to get the accessibility tree of the page.',
      '   The snapshot shows all interactive elements — buttons, links, text boxes, menus, and their labels.',
      '   Read the snapshot carefully to understand the page structure before taking any action.',
      '',
      'Step 3: Call browser_click or browser_type using the EXACT element reference from the snapshot.',
      '   The target parameter must be copied exactly from the snapshot output.',
      '',
      'Step 4: ALWAYS call browser_snapshot again after ANY action.',
      '   This is the most important rule. Never skip it.',
      '   The page changes after every click or type — you need the updated snapshot to know what to do next.',
      '',
      'Step 5: Repeat steps 3-4 until the task is complete.',
      '',
      'SAVING SNAPSHOTS FOR LATER REVIEW:',
      '- Use browser_snapshot with a "filename" parameter to save the snapshot to a file:',
      '    browser_snapshot({ filename: "step-1-after-navigation.md" })',
      '- Use browser_take_screenshot with a "filename" parameter to save a screenshot image:',
      '    browser_take_screenshot({ filename: "screenshot-1.png" })',
      '- All saved files go to ./workspace_data/mcp_data/ directory (project root).',
      '- To review a saved snapshot later, use the read_file tool:',
      '    read_file({ path: "./workspace_data/mcp_data/step-1.md" })',
      '',
      'ADDITIONAL TIPS:',
      '- browser_wait_for({ time: 2 }) — wait 2 seconds after navigation or slow page updates.',
      '- browser_handle_dialog({ accept: true }) — dismiss alerts, confirmations, prompts.',
      '- browser_press_key({ key: "Enter" }) — keyboard shortcuts like Enter, Escape, Tab, ArrowDown.',
      '- browser_tabs({ action: "new", url: "..." }) — open a new tab.',
      '- If a snapshot does not show the element you need, the page may need scrolling or a menu may need to be opened first.',
      '',
      'KEY PRINCIPLE: Never assume the page state after an action. Always take a fresh snapshot.',
      'The accessibility tree is the single source of truth for what is on the page.',
    );

    lines.push('',
      '',
      'DOWNLOAD LINK RULE (CRITICAL):',
      'When no project is connected, write_file/write_word/write_excel tool results contain a [Download "file"](...) link.',
      'If you see a download link in the tool result, you MUST include it in your final response so the user can click it.',
      'Example: [Download "report.docx"](api/files/agent/123/download)',
      'If the tool result says "Written to" a path (project connected), just report the file path.',
    );

    if (memoryContext && memoryContext !== '## Persistent Memory') {
      lines.push('', memoryContext);
    }

    return lines.join('\n');
  }

  private async getEnabledTools(): Promise<ToolDefinition[]> {
    const dbTools = await this.toolsService.findEnabled();
    const tools = this.modePolicy.getEnabledTools('cowork', dbTools);

    try {
      const mcpTools = await this.mcpService.getAllTools();
      for (const t of mcpTools) {
        tools.push({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description ?? '',
            parameters: t.parameters,
          },
        });
      }
    } catch { /* MCP not available */ }

    return tools;
  }
}
