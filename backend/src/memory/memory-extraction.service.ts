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

const MIN_CONTENT_LENGTH = 20;

const EXCLUDE_PATTERNS = /^(\s*why|how|what|when|where|can you|could you|would you|is there|are there|do you|does this|is it)\b/i;

const NEGATION_PATTERN = /\b(don't|doesn't|isn't|aren't|wasn't|weren't|won't|wouldn't|shouldn't|haven't|hasn't|hadn't|not\s+(?:a|the|my|this|that))\b/i;

const GREETING_PATTERN = /^(hi|hello|hey|thanks|thank you|okay|ok|sure|great|awesome|got it|i see|understood)\b/i;

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

    const userPatterns = /(?:I am|my role|my name|I work|I'm a|my job|I specialize)\s+(.+?)(?:\.|!|\?|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = userPatterns.exec(content)) !== null) {
      const raw = m[0].trim();
      const preceding = this.getPrecedingContext(content, m.index);
      if (this.isValidMemory(raw, preceding)) {
        const detail = m[1].trim();
        results.push({ type: 'USER', title: `User: ${detail.substring(0, 50)}`, content: raw });
      }
    }

    const feedbackPatterns = /(?:remember that|prefer\s+\w+(?:ing|s|e)?\s|important\s+(?:to|that|point|note|thing)|lesson learned|good practice|best practice|key takeaway|trick is|rule of thumb)[^.]*/gi;
    while ((m = feedbackPatterns.exec(content)) !== null) {
      const raw = m[0].trim();
      const preceding = this.getPrecedingContext(content, m.index);
      if (this.isValidMemory(raw, preceding)) {
        const label = raw.includes('lesson') ? 'Lesson' : raw.includes('prefer') ? 'Preference' : raw.includes('important') ? 'Important' : raw.includes('practice') ? 'Best practice' : raw.includes('trick') ? 'Tip' : 'Feedback';
        results.push({ type: 'FEEDBACK', title: label, content: raw });
      }
    }

    const projectPatterns = /(?:deadline\s+(?:for|is)|release\s+(?:date|plan|version|cycle)|sprint\s+(?:goal|planning|review|retro)|milestone\s+\w+|merge\s+freeze|deploy(?:ment)?\s+(?:schedule|plan|pipeline|window|process))[^.]*/gi;
    while ((m = projectPatterns.exec(content)) !== null) {
      const raw = m[0].trim();
      const preceding = this.getPrecedingContext(content, m.index);
      if (this.isValidMemory(raw, preceding)) {
        const label = raw.includes('deadline') ? 'Deadline' : raw.includes('release') ? 'Release' : raw.includes('sprint') ? 'Sprint' : raw.includes('milestone') ? 'Milestone' : raw.includes('merge') ? 'Merge freeze' : raw.includes('deploy') ? 'Deployment' : 'Project';
        results.push({ type: 'PROJECT', title: label, content: raw });
      }
    }

    const referencePatterns = /(?:tracked?\s+in|refer\s+to|docs?\s+at|documented\s+(?:in|at|on)|see\s+(?:this|the|our|my)|wiki\s+(?:page|link|entry)|ticket\s+#?\d+|linear\s+#?\d+|jira\s+#?\d+|notion\s+(?:link|page|doc)|slack\s+(?:thread|message|channel))[^.]*/gi;
    while ((m = referencePatterns.exec(content)) !== null) {
      const raw = m[0].trim();
      const preceding = this.getPrecedingContext(content, m.index);
      if (this.isValidMemory(raw, preceding)) {
        results.push({ type: 'REFERENCE', title: 'Reference', content: raw });
      }
    }

    return results;
  }

  private getPrecedingContext(content: string, matchIndex: number): string {
    const before = content.substring(0, matchIndex).trim();
    const lastSentence = before.split(/[.!?]\s*/).pop() || '';
    return lastSentence.trim();
  }

  private isValidMemory(text: string, precedingText?: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CONTENT_LENGTH) return false;
    if (EXCLUDE_PATTERNS.test(trimmed)) return false;
    if (GREETING_PATTERN.test(trimmed)) return false;
    if (trimmed.endsWith('?')) return false;

    const combined = precedingText ? precedingText + ' ' + trimmed : trimmed;
    if (NEGATION_PATTERN.test(combined)) return false;

    return true;
  }
}
