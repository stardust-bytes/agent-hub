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
  section: string;
  text: string;
  vector: number[];
  type: 'summary' | 'chunk';
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
      try {
        await this.table.add([{
          id: '_schema_ok', fileId: -1, filename: '', chunkIndex: 0, section: '', text: '',
          vector: new Array(768).fill(0), type: 'chunk',
        }]);
        await this.table.delete("id = '_schema_ok'");
      } catch {
        await db.dropTable('chunks');
        this.table = await db.createTable('chunks', [
          { id: 'init', fileId: 0, filename: '', chunkIndex: 0, section: '', text: '', vector: new Array(768).fill(0), type: 'chunk' },
        ]);
      }
    } else {
      this.table = await db.createTable('chunks', [
        { id: 'init', fileId: 0, filename: '', chunkIndex: 0, section: '', text: '', vector: new Array(768).fill(0), type: 'chunk' },
      ]);
    }
  }

  private async ensureTable() {
    if (!this.table) await this.initLanceDB();
  }

  private async embed(text: string): Promise<number[]> {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
    const model = this.config.get<string>('EMBED_MODEL', 'nomic-embed-text');
    const res = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      // If embed model not found, try pulling it
      if (res.status === 404) {
        await fetch(`${ollamaUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, stream: false }),
        });
        const retry = await fetch(`${ollamaUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
        });
        if (!retry.ok) throw new Error(`embedding failed after pull: ${retry.status}`);
        const data = await retry.json() as { embedding: number[] };
        return data.embedding;
      }
      throw new Error(`embedding failed: ${res.status}`);
    }
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

  private async generateSummary(text: string): Promise<string | null> {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
    const model = this.config.get<string>('SUMMARY_MODEL', 'llama3.2');
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `Write a 2-3 sentence summary of the main topics and key information in this document:\n\n${text.substring(0, 6000)}`,
          stream: false,
          options: { num_predict: 200 },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { response: string };
      return data.response.trim();
    } catch {
      return null;
    }
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

      const records: ChunkRecord[] = [];

      const summary = await this.generateSummary(content);
      if (summary) {
        const summaryVector = await this.embed(summary);
        records.push({
          id: `summary-${file.id}`,
          fileId: file.id,
          filename: file.filename,
          chunkIndex: -1,
          section: '',
          text: summary,
          vector: summaryVector,
          type: 'summary',
        });
      }

      const rawChunks = this.chunkText(content, 512, 50);
      for (let i = 0; i < rawChunks.length; i++) {
        const vector = await this.embed(rawChunks[i].text);
        records.push({
          id: `${file.id}-${i}`,
          fileId: file.id,
          filename: file.filename,
          chunkIndex: i,
          section: rawChunks[i].section,
          text: rawChunks[i].text,
          vector,
          type: 'chunk',
        });
      }

      await this.ensureTable();
      await this.table.add(records);

      await this.prisma.knowledgeFile.update({
        where: { id },
        data: { status: 'ready', chunkCount: rawChunks.length },
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      await this.prisma.knowledgeFile.update({
        where: { id },
        data: { status: 'error', errorMessage },
      });
    }
  }

  async updateStatus(id: number, status: string, chunkCount?: number) {
    return this.prisma.knowledgeFile.update({
      where: { id },
      data: { status, ...(chunkCount !== undefined ? { chunkCount } : {}) },
    });
  }

  async reindexAll() {
    const files = await this.prisma.knowledgeFile.findMany({ where: { status: 'ready' } });
    const db = await lancedb.connect(this.lancedbDir);
    await db.dropTable('chunks');
    this.table = null;
    await this.ensureTable();
    for (const file of files) {
      await this.processFile(file.id);
    }
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

  async search(query: string): Promise<Array<{ filename: string; section: string; chunkIndex: number; text: string }>> {
    try {
      const vector = await this.embed(query);
      await this.ensureTable();

      const chunkResults = await this.table.search(vector)
        .where("type = 'chunk'")
        .limit(10)
        .toArray() as ChunkRecord[];

      return chunkResults
        .filter(r => r.fileId > 0)
        .map(r => ({
          filename: r.filename,
          section: r.section,
          chunkIndex: r.chunkIndex,
          text: r.text,
        }));
    } catch {
      return [];
    }
  }

  private async extractText(filepath: string, mimeType: string): Promise<string | null> {
    const ext = path.extname(filepath).toLowerCase();
    if (ext === '.docx') {
      const result = await mammoth.convertToHtml({ path: filepath });
      const html = result.value || '';
      return html
        .replace(/<h1[^>]*>/gi, '# ')
        .replace(/<h2[^>]*>/gi, '## ')
        .replace(/<h3[^>]*>/gi, '### ')
        .replace(/<\/h[1-3]>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
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

  private parseHeadings(text: string, _mimeType: string): Array<{ number: string; title: string; startPos: number }> {
    const headings: Array<{ number: string; title: string; startPos: number }> = []
    const lines = text.split('\n')
    let headingCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      let sectionNum = ''

      const mdMatch = line.match(/^(#{1,6})\s+(.+)/)
      if (mdMatch) {
        sectionNum = mdMatch[2].match(/^(\d+(?:\.\d+)*)[.\s)]/)?.[1]
          || mdMatch[2].match(/^([IVXLCDM]+)[.\s)]/)?.[1]
          || `${headingCount + 1}`
        headings.push({ number: sectionNum, title: mdMatch[2], startPos: lines.slice(0, i).join('\n').length })
        headingCount++
        continue
      }

      const patternMatch = line.match(/^(I{1,3}|IV|V|VI{0,3}|IX|X|[1-9]\d*)(?:\.([1-9]\d*))*[.\s)]+(.+)/)
      if (patternMatch) {
        sectionNum = patternMatch[1]
        if (patternMatch[2]) sectionNum += '.' + patternMatch[2]
        headings.push({ number: sectionNum, title: patternMatch[3], startPos: lines.slice(0, i).join('\n').length })
        headingCount++
        continue
      }

      const chapterMatch = line.match(/^(Chapter|Section|Bài|Chương)\s+([\dIVXLCDM]+)[.:\s]+(.+)/i)
      if (chapterMatch) {
        sectionNum = chapterMatch[2]
        headings.push({ number: sectionNum, title: chapterMatch[3], startPos: lines.slice(0, i).join('\n').length })
        headingCount++
        continue
      }
    }

    return headings
  }

  private chunkText(text: string, chunkSize: number, overlap: number): Array<{ text: string; section: string }> {
    try {
      const sections = this.parseHeadings(text, '');
      if (sections.length === 0) {
        return this.legacyChunkText(text, chunkSize, overlap).map(t => ({ text: t, section: '' }));
      }

      const result: Array<{ text: string; section: string }> = [];
      for (let i = 0; i < sections.length; i++) {
        const start = sections[i].startPos;
        const end = i + 1 < sections.length ? sections[i + 1].startPos : text.length;
        let sectionText = text.slice(start, end).trim();
        if (!sectionText) continue;

        if (sectionText.length > chunkSize) {
          const subChunks = this.legacyChunkText(sectionText, chunkSize, overlap);
          for (const sc of subChunks) {
            result.push({ text: sc, section: sections[i].number });
          }
        } else {
          result.push({ text: sectionText, section: sections[i].number });
        }
      }
      return result;
    } catch {
      return this.legacyChunkText(text, chunkSize, overlap).map(t => ({ text: t, section: '' }));
    }
  }

  private legacyChunkText(text: string, chunkSize: number, overlap: number): string[] {
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
