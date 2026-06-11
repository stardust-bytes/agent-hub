import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryGateway } from './memory.gateway';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { MEMORY_PROMPT_LIMITS, MEMORY_DEDUP_WINDOW_MS } from './memory.constants';
import { createHash } from 'crypto';

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MemoryGateway,
  ) {}

  async findAll(dto?: SearchMemoryDto) {
    const where: any = {};
    if (dto?.type) where.type = dto.type;
    if (dto?.sessionId) where.sessionId = Number(dto.sessionId);
    if (dto?.search) {
      where.OR = [
        { title: { contains: dto.search } },
        { content: { contains: dto.search } },
      ];
    }
    return this.prisma.memory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateMemoryDto) {
    if (await this.isDuplicate(dto.title, dto.content)) {
      const existing = await this.findSimilar(dto.title, dto.type as any);
      if (existing) {
        const updated = await this.prisma.memory.update({
          where: { id: existing.id },
          data: {
            content: existing.content + '\n\n' + dto.content,
            updatedAt: new Date(),
          },
        });
        this.gateway.emitUpdated(updated);
        return updated;
      }
    }

    const memory = await this.prisma.memory.create({
      data: {
        type: dto.type,
        title: dto.title,
        content: dto.content,
        metadata: JSON.stringify({
          source: 'manual',
          hash: this.hashContent(dto.title, dto.content),
        }),
      },
    });
    this.gateway.emitCreated(memory);
    return memory;
  }

  async update(id: string, dto: UpdateMemoryDto) {
    await this.findOneOrFail(id);
    const memory = await this.prisma.memory.update({
      where: { id },
      data: {
        ...dto,
      },
    });
    this.gateway.emitUpdated(memory);
    return memory;
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    const memory = await this.prisma.memory.delete({ where: { id } });
    this.gateway.emitDeleted(memory.id);
    return memory;
  }

  async findOne(id: string) {
    const memory = await this.prisma.memory.findUnique({ where: { id } });
    if (!memory) throw new NotFoundException(`Memory ${id} not found`);
    return memory;
  }

  async getContextMemories(): Promise<string> {
    const memories = await this.prisma.memory.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const grouped: Record<string, string[]> = { USER: [], FEEDBACK: [], PROJECT: [], REFERENCE: [] };
    for (const m of memories) {
      const type = m.type;
      if (grouped[type] && grouped[type].length < (MEMORY_PROMPT_LIMITS as any)[type]) {
        grouped[type].push(`- ${m.title}: ${m.content.split('\n')[0]}`);
      }
    }

    const lines: string[] = ['## Persistent Memory'];
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length > 0) {
        lines.push('', `### ${type.charAt(0) + type.slice(1).toLowerCase()}`, ...items);
      }
    }

    return lines.join('\n');
  }

  private async isDuplicate(title: string, content: string): Promise<boolean> {
    const hash = this.hashContent(title, content);
    const cutoff = new Date(Date.now() - MEMORY_DEDUP_WINDOW_MS);
    const existing = await this.prisma.memory.findFirst({
      where: {
        createdAt: { gte: cutoff },
        metadata: { contains: hash },
      },
    });
    return !!existing;
  }

  private async findSimilar(title: string, type: string) {
    return this.prisma.memory.findFirst({
      where: {
        type,
        title: { contains: title.substring(0, 20) },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private hashContent(title: string, content: string): string {
    return createHash('sha256').update(title + content).digest('hex');
  }

  private async findOneOrFail(id: string) {
    return this.findOne(id);
  }
}
