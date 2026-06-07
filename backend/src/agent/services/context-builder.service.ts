import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { AgentRunState } from '../dto/agent-run-state';

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
  constructor(private readonly prisma: PrismaService) {}

  async build(
    runState: AgentRunState,
    sessionId: number,
    systemPromptOverride?: string,
  ): Promise<AgentContext> {
    const tools = this.getDefaultTools();

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
      '- If results are found: synthesize into a coherent answer. Cite each fact inline with [Source: "filename", §N]. Cite all sources that agree.',
      '- If no results AND the question is about internal documents (reports, contracts, procedures, company-specific data): DO NOT use general knowledge. Acknowledge the gap, then either ask 1-2 clarifying questions (if the query is vague) or suggest uploading relevant documents.',
      '- If no results AND the question is general knowledge (concepts, how-to, definitions): answer from your own knowledge with a clear disclaimer such as "Based on general knowledge (not from your documents):..."',
      '',
      'Respond in the same language the user writes in.',
      'Use the provided tools when appropriate to fulfill user requests.',
      '',
      `Current date: ${dateStr}`,
      `Current time: ${timeStr}`,
    );

    return lines.join('\n');
  }

  private getDefaultTools(): ToolDefinition[] {
    return [
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
  }
}
