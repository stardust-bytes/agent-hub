import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
const mammoth = require('mammoth');

interface ChunkRecord {
  id: string;
  fileId: number;
  filename: string;
  chunkIndex: number;
  text: string;
  vector: number[];
}

@Injectable()
export class KnowledgeService {
  private readonly uploadDir: string;
  private readonly lancedbDir: string;
  private table: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = path.resolve(this.config.get<string>('UPLOAD_DIR', './workspace_data/uploads'));
    this.lancedbDir = path.resolve('./workspace_data/lancedb');
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
    this.initLanceDB().catch(() => {});
  }

  private async initLanceDB() {
    if (!fs.existsSync(this.lancedbDir)) fs.mkdirSync(this.lancedbDir, { recursive: true });
    const db = await lancedb.connect(this.lancedbDir);
    const tables = await db.tableNames();
    if (tables.includes('chunks')) {
      this.table = await db.openTable('chunks');
    } else {
      this.table = await db.createTable('chunks', [
        { id: 'init', fileId: 0, filename: '', chunkIndex: 0, text: '', vector: new Array(768).fill(0) },
      ], { mode: 'overwrite' });
    }
  }

  private async ensureTable() {
    if (!this.table) await this.initLanceDB();
  }

  private async embed(text: string): Promise<number[]> {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
    const res = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
    });
    if (!res.ok) throw new Error(`embedding failed: ${res.status}`);
    const data = await res.json() as { embedding: number[] };
    return data.embedding;
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

  async processFile(id: number) {
    const file = await this.prisma.knowledgeFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`KnowledgeFile ${id} not found`);

    try {
      const content = await this.extractText(file.filepath, file.mimeType);
      if (!content) {
        await this.updateStatus(id, 'error');
        return;
      }

      const chunks = this.chunkText(content, 512, 50);
      const records: ChunkRecord[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const vector = await this.embed(chunks[i]);
        records.push({
          id: `${file.id}-${i}`,
          fileId: file.id,
          filename: file.filename,
          chunkIndex: i,
          text: chunks[i],
          vector,
        });
      }

      await this.ensureTable();
      await this.table.add(records);

      await this.prisma.knowledgeFile.update({
        where: { id },
        data: { status: 'ready', chunkCount: chunks.length },
      });
    } catch {
      await this.updateStatus(id, 'error');
    }
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

    try {
      await this.ensureTable();
      await this.table.delete(`fileId = ${id}`);
    } catch { /* ignore */ }

    return this.prisma.knowledgeFile.delete({ where: { id } });
  }

  async search(query: string): Promise<Array<{ filename: string; text: string }>> {
    try {
      const vector = await this.embed(query);
      await this.ensureTable();
      const results = await this.table.search(vector).limit(5).toArray() as ChunkRecord[];
      return results.filter(r => r.fileId > 0).map(r => ({ filename: r.filename, text: r.text }));
    } catch {
      return [];
    }
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
    try { return fs.readFileSync(filepath, 'utf-8'); } catch { return null; }
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
