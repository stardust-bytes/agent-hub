import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
const mammoth = require('mammoth');

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
    const files = await this.prisma.knowledgeFile.findMany({ where: { status: 'ready' } });
    const results: Array<{ filename: string; text: string; score: number }> = [];
    const q = query.toLowerCase();

    for (const file of files) {
      try {
        const content = await this.extractText(file.filepath, file.mimeType);
        if (!content) continue;
        const chunks = this.chunkText(content, 512, 50);
        for (const chunk of chunks) {
          const lower = chunk.toLowerCase();
          let score = 0;
          if (lower.includes(q)) score = q.length / lower.length;
          if (score > 0) results.push({ filename: file.filename, text: chunk, score });
        }
      } catch { /* skip unreadable files */ }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5).map(({ filename, text }) => ({ filename, text }));
  }

  private async extractText(filepath: string, mimeType: string): Promise<string | null> {
    const ext = path.extname(filepath).toLowerCase();
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filepath });
      return result.value || null;
    }
    if (ext === '.pdf') {
      try {
        const pdf = require('pdf-parse');
        const buf = fs.readFileSync(filepath);
        const data = await pdf(buf);
        return data.text || null;
      } catch { return null; }
    }
    try {
      return fs.readFileSync(filepath, 'utf-8');
    } catch { return null; }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    if (text.length <= chunkSize) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }
}
