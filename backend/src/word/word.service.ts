import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

export interface WordReadResult {
  content: string;
  tables: string[];
  metadata: {
    headingCount: number;
    paragraphCount: number;
  };
}

export interface WordEditOperation {
  type: 'append' | 'replace';
  content?: string;
  target?: string;
  replacement?: string;
}

@Injectable()
export class WordService {
  async read(filePath: string): Promise<WordReadResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const result = await mammoth.convertToHtml({ path: filePath });
    const html = result.value || '';

    const headingCount = (html.match(/<h[1-6][^>]*>/gi) || []).length;
    const paragraphCount = (html.match(/<p[^>]*>/gi) || []).length;

    const tables = this.extractTables(html);
    const content = this.htmlToMarkdown(html);

    return {
      content,
      tables,
      metadata: { headingCount, paragraphCount },
    };
  }

  async write(filePath: string, content: string): Promise<string> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const buffer = await this.renderMarkdownToDocx(content);
    await fs.promises.writeFile(filePath, buffer);
    return `Created ${filePath}`;
  }

  async edit(filePath: string, operations: WordEditOperation[]): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const result = await mammoth.convertToHtml({ path: filePath });
    let html = result.value || '';

    for (const op of operations) {
      if (op.type === 'append') {
        const textToAppend = op.content ?? '';
        html += `<p>${textToAppend.replace(/\n/g, '<br/>')}</p>`;
      } else if (op.type === 'replace' && op.target) {
        const escaped = op.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(escaped, 'g'), op.replacement ?? '');
      }
    }

    const text = this.htmlToMarkdown(html);
    const buffer = await this.renderMarkdownToDocx(text);
    await fs.promises.writeFile(filePath, buffer);
    return `Updated ${filePath} with ${operations.length} operation(s)`;
  }

  private htmlToMarkdown(html: string): string {
    return html
      .replace(/<h1[^>]*>/gi, '# ')
      .replace(/<h2[^>]*>/gi, '## ')
      .replace(/<h3[^>]*>/gi, '### ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<strong[^>]*>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<em[^>]*>/gi, '*')
      .replace(/<\/em>/gi, '*')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractTables(html: string): string[] {
    const tables: string[] = [];
    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const rows: string[][] = [];
      const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableMatch[0])) !== null) {
        const cells: string[] = [];
        const cellRegex = /<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi;
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(rowMatch[0])) !== null) {
          const cellText = cellMatch[0].replace(/<[^>]+>/g, '').trim();
          cells.push(cellText);
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) {
        const header = rows[0];
        const separator = header.map(() => '---');
        const dataRows = rows.slice(1).map(r => `| ${r.join(' | ')} |`);
        tables.push(`| ${header.join(' | ')} |\n| ${separator.join(' | ')} |\n${dataRows.join('\n')}`);
      }
    }
    return tables;
  }

  private async renderMarkdownToDocx(markdown: string): Promise<Uint8Array> {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

    const lines = markdown.split('\n');
    const children: import('docx').Paragraph[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        children.push(new Paragraph({ spacing: { after: 200 } }));
        continue;
      }

      if (trimmed.startsWith('### ')) {
        children.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (trimmed.startsWith('## ')) {
        children.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (trimmed.startsWith('# ')) {
        children.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1 }));
      } else if (trimmed.startsWith('- ')) {
        children.push(new Paragraph({ text: trimmed.slice(2), bullet: { level: 0 } }));
      } else {
        const boldMatch = trimmed.match(/\*\*(.+?)\*\*/);
        if (boldMatch) {
          const parts = trimmed.split(/\*\*(.+?)\*\*/);
          children.push(new Paragraph({
            children: parts.map((part, idx) => new TextRun({ text: part, bold: idx % 2 === 1 })),
          }));
        } else {
          children.push(new Paragraph({ text: trimmed }));
        }
      }
    }

    const doc = new Document({ sections: [{ children }] });
    return Packer.toBuffer(doc);
  }
}
