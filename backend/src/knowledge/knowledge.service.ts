import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KnowledgeService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = path.resolve(this.config.get<string>('UPLOAD_DIR', './workspace_data/uploads'));
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async findAll() {
    return this.prisma.knowledgeFile.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(filename: string, size: number, mimeType: string) {
    const filepath = path.join(this.uploadDir, `${Date.now()}-${filename}`);
    return this.prisma.knowledgeFile.create({
      data: { filename, filepath, size, mimeType, status: 'indexing' },
    });
  }

  async updateStatus(id: number, status: string, chunkCount?: number) {
    return this.prisma.knowledgeFile.update({
      where: { id },
      data: { status, ...(chunkCount !== undefined ? { chunkCount } : {}) },
    });
  }

  async remove(id: number) {
    const file = await this.prisma.knowledgeFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`KnowledgeFile ${id} not found`);
    try { if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath); } catch { /* ignore */ }
    return this.prisma.knowledgeFile.delete({ where: { id } });
  }

  async search(query: string): Promise<Array<{ filename: string; text: string }>> {
    // Phase 5a: implement LanceDB vector search
    // For now, return empty — RAG is wired but inactive without indexed data
    return [];
  }
}
