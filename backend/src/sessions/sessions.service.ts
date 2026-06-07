import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.session.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async create() {
    return this.prisma.session.create({ data: {} });
  }

  async remove(id: number) {
    return this.prisma.session.delete({ where: { id } });
  }

  async getMessages(sessionId: number) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getHistory(sessionId: number): Promise<OllamaMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  async saveMessage(sessionId: number, role: 'user' | 'assistant', content: string) {
    return this.prisma.chatMessage.create({
      data: { sessionId, role, content },
    });
  }

  async autoTitle(sessionId: number, firstMessage: string): Promise<void> {
    const count = await this.prisma.chatMessage.count({ where: { sessionId, role: 'user' } });
    if (count > 1) return;
    const title = firstMessage.split(' ').slice(0, 5).join(' ');
    await this.prisma.session.update({ where: { id: sessionId }, data: { title } });
  }
}
