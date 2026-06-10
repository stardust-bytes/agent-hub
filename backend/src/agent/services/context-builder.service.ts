import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { AgentRunState } from '../dto/agent-run-state';
import { ToolsService } from '../../tools/tools.service';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

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
  ) {}

  async build(
    runState: AgentRunState,
    sessionId: number,
    systemPromptOverride?: string,
  ): Promise<AgentContext> {
    const tools = await this.getEnabledTools();

    const systemPrompt = systemPromptOverride || this.buildSystemPrompt(tools);

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

  private buildSystemPrompt(tools: ToolDefinition[]): string {
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
      `  Current Working Directory: ${process.cwd()}`,
      `  User Home: ${process.env.USERPROFILE || process.env.HOME || '(unknown)'}`,
      '',
      `Current date: ${dateStr}`,
      `Current time: ${timeStr}`,
    );

    return lines.join('\n');
  }

  private async getEnabledTools(): Promise<ToolDefinition[]> {
    const dbTools = await this.toolsService.findEnabled();
    return dbTools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: JSON.parse(t.parameters),
      },
    }));
  }
}
