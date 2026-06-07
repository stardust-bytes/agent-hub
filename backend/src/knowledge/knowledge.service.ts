import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    return this.prisma.knowledgeFile.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: number) {
    const file = await this.prisma.knowledgeFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`KnowledgeFile ${id} not found`);
    return this.prisma.knowledgeFile.delete({ where: { id } });
  }
}
