import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';

interface IdleEvent {
  sessionId: number;
  providerType: string;
  model: string;
  providerConfig: { baseUrl: string; key?: string };
}

@Injectable()
export class MemoryExtractionService {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('agent.idle')
  async extract(event: IdleEvent) {
    const { sessionId } = event;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!session || session.messages.length === 0) return;

    const recentContent = session.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => m.content)
      .join('\n');

    const memories = this.classifyMemories(recentContent);
    for (const mem of memories) {
      const existing = await this.prisma.memory.findFirst({
        where: {
          type: mem.type,
          title: { contains: mem.title.substring(0, 30) },
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (!existing) {
        await this.memoryService.create({
          type: mem.type as any,
          title: mem.title,
          content: mem.content,
          metadata: JSON.stringify({ source: 'auto-extract', sessionId }),
        });
      }
    }
  }

  private classifyMemories(content: string): Array<{ type: string; title: string; content: string }> {
    const results: Array<{ type: string; title: string; content: string }> = [];

    const userPatterns = /(?:I am|my role|my name|I work|I'm a)\s+([^.]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = userPatterns.exec(content)) !== null) {
      results.push({ type: 'USER', title: 'User context', content: m[0] });
    }

    const feedbackPatterns = /(?:remember|don't|never|always|prefer|important|note that|lesson learned)[^.]*/gi;
    while ((m = feedbackPatterns.exec(content)) !== null) {
      results.push({ type: 'FEEDBACK', title: 'Feedback', content: m[0] });
    }

    const projectPatterns = /(?:deadline|release|sprint|milestone|version|merge freeze|project|deploy)[^.]*/gi;
    while ((m = projectPatterns.exec(content)) !== null) {
      results.push({ type: 'PROJECT', title: 'Project context', content: m[0] });
    }

    const referencePatterns = /(?:tracked in|see |refer to|docs? at|wiki|ticket|linear|jira|notion|slack)[^.]*/gi;
    while ((m = referencePatterns.exec(content)) !== null) {
      results.push({ type: 'REFERENCE', title: 'Reference', content: m[0] });
    }

    return results;
  }
}
