import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { AgentRunState } from '../dto/agent-run-state';
import { ToolsService } from '../../tools/tools.service';
import { McpService } from '../mcp/mcp.service';
import { CoworkService } from '../../cowork/cowork.service';
import { ModePolicyService } from '../../mode-policy/mode-policy.service';
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
  ) {}

  async build(
    runState: AgentRunState,
    sessionId: number,
    mode: string = 'agent',
    systemPromptOverride?: string,
  ): Promise<AgentContext> {
    const tools = await this.getEnabledTools(mode);
    const project = await this.cowork.getProject();

    const systemPrompt = systemPromptOverride || this.buildSystemPrompt(tools, project, mode);

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
    return history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  private buildSystemPrompt(tools: ToolDefinition[], projectPath?: string | null, mode: string = 'agent'): string {
    if (mode === 'chat') {
      return [
        'You are a helpful AI assistant.',
        'Answer user questions using the available tools when needed.',
        'Use web_search and web_fetch to find current information.',
        '',
        'Respond in the same language the user writes in.',
      ].join('\n');
    }

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
      'System Environment:',
      `  Platform: ${process.platform}`,
      '',
      `Current date: ${dateStr}`,
      `Current time: ${timeStr}`,
    );

    if (mode === 'agent') {
      const agentPaths = this.modePolicy.resolveAllowedPaths('agent');
      const agentOutputPath = agentPaths[0] || '{workspaceRoot}/agent-output';
      lines.push(
        '',
        'When writing files, use relative paths (e.g., "output.txt").',
        `Files will be saved to: ${agentOutputPath}/session_{sessionId}`,
        'Files written here are automatically downloadable via links returned by write_file.',
      );
    }

    if (mode === 'cowork' && projectPath) {
      lines.push('',
        `Current working project: ${projectPath}`,
        'File operations are available in this directory.',
      );
    }

    return lines.join('\n');
  }

  private async getEnabledTools(mode: string = 'agent'): Promise<ToolDefinition[]> {
    const dbTools = await this.toolsService.findEnabled();
    const tools = this.modePolicy.getEnabledTools(mode, dbTools);

    if (mode === 'cowork') {
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
    }
    return tools;
  }
}
