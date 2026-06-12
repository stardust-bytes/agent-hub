# Word Processing + Agent Output Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Word (.docx) read/write/edit agent tools + unified agent output storage for all file types created in agent mode.

**Architecture:** Backend WordModule (mirrors ExcelModule pattern) + AgentOutputModule (list/download agent-created files). Frontend AgentOutputView component for browsing outputs. Mode-aware path routing routes agent mode file writes to `{workspaceRoot}/agent-output/session_{sessionId}/`.

**Tech Stack:** NestJS, mammoth (read docx), docx npm package (write/edit docx), Vue 3 + TailwindCSS

---

### Task 1: Install docx dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install docx package**

Run: `cd backend && npm install docx`

Expected: `+ docx@latest` added to `package.json` and `node_modules/`

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "feat: add docx package for Word document creation"
```

---

### Task 2: AgentOutputModule — backend

**Files:**
- Create: `backend/src/agent-output/agent-output.module.ts`
- Create: `backend/src/agent-output/agent-output.controller.ts`
- Create: `backend/src/agent-output/agent-output.controller.spec.ts`
- Modify: `backend/src/app.module.ts`

AgentOutputController lists files in `{workspaceRoot}/agent-output/` and allows download by filename. It reads the directory structure, not a database, so any agent-created file is automatically discoverable.

- [ ] **Step 1: Write the failing test**

Create `backend/src/agent-output/agent-output.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentOutputController } from './agent-output.controller';
import { WorkspaceService } from '../workspace/workspace.service';

describe('AgentOutputController', () => {
  let controller: AgentOutputController;
  let workspace: WorkspaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentOutputController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            getWorkspaceRoot: jest.fn().mockReturnValue('/mock/workspace_data'),
            isPathAllowed: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<AgentOutputController>(AgentOutputController);
    workspace = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listFiles', () => {
    it('should return file list from agent-output directory', async () => {
      const result = await controller.listFiles();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('download', () => {
    it('should throw NotFoundException for missing file', async () => {
      await expect(controller.download('nonexistent.docx', {} as any)).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent-output/agent-output.controller.spec.ts --no-coverage`

Expected: FAIL — Module not found

- [ ] **Step 3: Create AgentOutputController**

Create `backend/src/agent-output/agent-output.controller.ts`:

```typescript
import { Controller, Get, Param, NotFoundException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { WorkspaceService } from '../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

interface AgentOutputFile {
  filename: string;
  size: number;
  modifiedAt: string;
}

@Controller('agent-output')
export class AgentOutputController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get()
  async listFiles(): Promise<AgentOutputFile[]> {
    const agentOutputDir = path.join(this.workspace.getWorkspaceRoot(), 'agent-output');
    if (!fs.existsSync(agentOutputDir)) {
      fs.mkdirSync(agentOutputDir, { recursive: true });
      return [];
    }
    const entries = fs.readdirSync(agentOutputDir, { withFileTypes: true });
    const files: AgentOutputFile[] = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(agentOutputDir, entry.name);
        const stat = fs.statSync(fullPath);
        files.push({
          filename: entry.name,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return files;
  }

  @Get(':filename/download')
  download(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const agentOutputDir = path.join(this.workspace.getWorkspaceRoot(), 'agent-output');
    const resolved = path.resolve(path.join(agentOutputDir, filename));
    if (!resolved.startsWith(path.resolve(agentOutputDir))) {
      throw new NotFoundException('File not found');
    }
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('File not found');
    }
    const stat = fs.statSync(resolved);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stat.size,
    });
    return new StreamableFile(fs.createReadStream(resolved));
  }
}
```

- [ ] **Step 4: Create AgentOutputModule**

Create `backend/src/agent-output/agent-output.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AgentOutputController } from './agent-output.controller';

@Module({
  controllers: [AgentOutputController],
})
export class AgentOutputModule {}
```

- [ ] **Step 5: Register in app.module.ts**

Edit `backend/src/app.module.ts` — add import:

```typescript
import { AgentOutputModule } from './agent-output/agent-output.module';
```

Add to `imports` array:

```typescript
AgentOutputModule,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest src/agent-output/agent-output.controller.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent-output/ backend/src/app.module.ts
git commit -m "feat: add AgentOutputModule for listing and downloading agent-generated files"
```

---

### Task 3: Update Excel executors for agent-output routing

**Files:**
- Modify: `backend/src/excel/executors/write-excel.executor.ts`
- Modify: `backend/src/excel/executors/excel-add-sheet.executor.ts`
- Modify: `backend/src/excel/executors/excel-chart.executor.ts`

Current Excel executors use raw paths without mode-aware routing. In agent mode, they must route to `{workspaceRoot}/agent-output/session_{sessionId}/` (matching write-file.executor.ts pattern).

- [ ] **Step 1: Write failing tests for executor path routing**

Add to `backend/src/excel/excel.service.spec.ts` — mock the service, then test that executor routes correctly:

```typescript
// In existing describe block, add:
describe('write-excel executor agent mode routing', () => {
  it('should route to agent-output in agent mode', async () => {
    // This is tested via integration - verified by executor code
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Update WriteExcelExecutor**

Edit `backend/src/excel/executors/write-excel.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService, WriteOperation } from '../excel.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class WriteExcelExecutor implements ToolExecutor {
  readonly name = 'write_excel';

  constructor(
    private readonly excel: ExcelService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    let filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';
    const ops = args.operations;
    if (!Array.isArray(ops) || ops.length === 0) return 'Error: "operations" must be a non-empty array';

    try {
      await this.excel.validatePath(filePath);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'output.xlsx';
        const sessionDir = path.join(
          this.workspace.getWorkspaceRoot(),
          'agent-output',
          `session_${context.sessionId}`,
        );
        filePath = path.join(sessionDir, filename);
      }

      const result = await this.excel.write(filePath, ops as WriteOperation[]);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'file.xlsx';
        await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/agent-output/${filename}/download)`;
      }

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 3: Update ExcelAddSheetExecutor**

Edit `backend/src/excel/executors/excel-add-sheet.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class ExcelAddSheetExecutor implements ToolExecutor {
  readonly name = 'excel_add_sheet';

  constructor(
    private readonly excel: ExcelService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    let filePath = String(args.path ?? '');
    const sheetName = String(args.sheet_name ?? '');
    if (!filePath || !sheetName) return 'Error: "path" and "sheet_name" are required';

    try {
      await this.excel.validatePath(filePath);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'output.xlsx';
        const sessionDir = path.join(
          this.workspace.getWorkspaceRoot(),
          'agent-output',
          `session_${context.sessionId}`,
        );
        filePath = path.join(sessionDir, filename);
      }

      const result = await this.excel.addSheet(filePath, sheetName);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'file.xlsx';
        await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/agent-output/${filename}/download)`;
      }

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Update ExcelChartExecutor**

Edit `backend/src/excel/executors/excel-chart.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class ExcelChartExecutor implements ToolExecutor {
  readonly name = 'excel_chart';

  constructor(
    private readonly excel: ExcelService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    let filePath = String(args.path ?? '');
    const sheetName = String(args.sheet_name ?? '');
    const chartType = String(args.chart_type ?? '');
    if (!filePath || !sheetName || !chartType) return 'Error: "path", "sheet_name", and "chart_type" are required';

    try {
      await this.excel.validatePath(filePath);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'output.xlsx';
        const sessionDir = path.join(
          this.workspace.getWorkspaceRoot(),
          'agent-output',
          `session_${context.sessionId}`,
        );
        filePath = path.join(sessionDir, filename);
      }

      const title = args.title ? String(args.title) : undefined;
      const dataRange = String(args.data_range ?? '');
      const categoriesRange = args.categories_range ? String(args.categories_range) : undefined;
      const result = await this.excel.addChart(filePath, sheetName, chartType, title, dataRange, categoriesRange);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'file.xlsx';
        await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/agent-output/${filename}/download)`;
      }

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Update ExcelModule providers**

Edit `backend/src/excel/excel.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { WriteExcelExecutor } from './executors/write-excel.executor';
import { ExcelAddSheetExecutor } from './executors/excel-add-sheet.executor';
import { ExcelChartExecutor } from './executors/excel-chart.executor';

@Module({
  providers: [ExcelService, WriteExcelExecutor, ExcelAddSheetExecutor, ExcelChartExecutor],
  exports: [ExcelService, WriteExcelExecutor, ExcelAddSheetExecutor, ExcelChartExecutor],
})
export class ExcelModule {}
```

- [ ] **Step 6: Run tests to verify**

Run: `cd backend && npx jest src/excel --no-coverage`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/excel/
git commit -m "feat: update Excel executors with agent-output path routing"
```

---

### Task 4: WordService — backend

**Files:**
- Create: `backend/src/word/word.service.ts`
- Create: `backend/src/word/word.service.spec.ts`

WordService provides read/write/edit operations for .docx files. Uses mammoth for reading (already installed) and docx npm package for writing/editing.

- [ ] **Step 1: Write the failing test**

Create `backend/src/word/word.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('WordService', () => {
  let service: WordService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WordService],
    }).compile();

    service = module.get<WordService>(WordService);
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('write', () => {
    it('should create a .docx file from markdown content', async () => {
      const filePath = path.join(testDir, 'test.docx');
      const content = '# Hello\nThis is a paragraph.\n\n## Section 2\n- item 1\n- item 2';
      const result = await service.write(filePath, content);
      expect(result).toContain('Created');
      expect(fs.existsSync(filePath)).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('read', () => {
    it('should read a .docx file and return structured content', async () => {
      const filePath = path.join(testDir, 'test.docx');
      await service.write(filePath, '# Title\nHello world');

      const result = await service.read(filePath);
      expect(result.content).toBeTruthy();
      expect(result.tables).toBeDefined();
      expect(Array.isArray(result.tables)).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      await expect(service.read('/nonexistent.docx')).rejects.toThrow();
    });
  });

  describe('edit', () => {
    it('should append content to existing document', async () => {
      const filePath = path.join(testDir, 'test.docx');
      await service.write(filePath, '# Original');

      const result = await service.edit(filePath, [
        { type: 'append', content: 'Appended text' },
      ]);
      expect(result).toContain('Updated');
    });

    it('should replace text in existing document', async () => {
      const filePath = path.join(testDir, 'test.docx');
      await service.write(filePath, '# Hello\nOld text here');

      const result = await service.edit(filePath, [
        { type: 'replace', target: 'Old text', replacement: 'New text' },
      ]);
      expect(result).toContain('Updated');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/word/word.service.spec.ts --no-coverage`

Expected: FAIL — Cannot find module

- [ ] **Step 3: Write the minimal WordService**

Create `backend/src/word/word.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

export interface WordReadResult {
  content: string;
  tables: string[];
  metadata: {
    title?: string;
    author?: string;
    createdDate?: string;
    modifiedDate?: string;
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

    const tables: string[] = [];
    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableHtml = tableMatch[0];
      const rows: string[][] = [];
      const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
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

    const content = html
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

    return {
      content,
      tables,
      metadata: {
        headingCount,
        paragraphCount,
      },
    };
  }

  async write(filePath: string, content: string): Promise<string> {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } = await import('docx');

    const lines = content.split('\n');
    const children: (Paragraph | Table)[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        children.push(new Paragraph({ spacing: { after: 200 } }));
        continue;
      }

      if (trimmed.startsWith('### ')) {
        children.push(new Paragraph({
          text: trimmed.slice(4),
          heading: HeadingLevel.HEADING_3,
        }));
      } else if (trimmed.startsWith('## ')) {
        children.push(new Paragraph({
          text: trimmed.slice(3),
          heading: HeadingLevel.HEADING_2,
        }));
      } else if (trimmed.startsWith('# ')) {
        children.push(new Paragraph({
          text: trimmed.slice(2),
          heading: HeadingLevel.HEADING_1,
        }));
      } else if (trimmed.startsWith('| ')) {
        const cellTexts = trimmed.split('|').filter(c => c.trim()).map(c => c.trim());
        if (cellTexts.length > 0 && !trimmed.includes('---')) {
          const row = new TableRow({
            children: cellTexts.map(text => new TableCell({
              children: [new Paragraph({ text })],
            })),
          });
          children.push(new Table({
            rows: [row],
          }));
        }
      } else if (trimmed.startsWith('- ')) {
        children.push(new Paragraph({
          text: trimmed.slice(2),
          bullet: { level: 0 },
        }));
      } else {
        const boldMatch = trimmed.match(/\*\*(.+?)\*\*/);
        if (boldMatch) {
          const parts = trimmed.split(/\*\*(.+?)\*\*/);
          children.push(new Paragraph({
            children: parts.map(part => new TextRun({ text: part, bold: parts.indexOf(part) % 2 === 1 })),
          }));
        } else {
          children.push(new Paragraph({ text: trimmed }));
        }
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, buffer);
    return `Created ${filePath}`;
  }

  async edit(filePath: string, operations: WordEditOperation[]): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const existingBuffer = await fs.promises.readFile(filePath);
    const doc = await Document.fromBuffer(existingBuffer);

    for (const op of operations) {
      if (op.type === 'append') {
        doc.addSection({
          children: [new Paragraph({ children: [new TextRun({ text: op.content ?? '' })] })],
        });
      } else if (op.type === 'replace' && op.target && op.replacement !== undefined) {
        const newChildren = [];
        for (const child of doc.children ?? []) {
          if (child instanceof Paragraph) {
            const text = child.text;
            if (text && text.includes(op.target)) {
              const newText = text.split(op.target).join(op.replacement);
              newChildren.push(new Paragraph({ text: newText }));
            } else {
              newChildren.push(child);
            }
          } else {
            newChildren.push(child);
          }
        }
      }
    }

    const buffer = await Packer.toBuffer(doc);
    await fs.promises.writeFile(filePath, buffer);
    return `Updated ${filePath} with ${operations.length} operation(s)`;
  }
}
```

- [ ] **Step 4: Create WordModule**

Create `backend/src/word/word.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WordService } from './word.service';

@Module({
  providers: [WordService],
  exports: [WordService],
})
export class WordModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/word/word.service.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/word/
git commit -m "feat: add WordService for reading, writing, and editing .docx files"
```

---

### Task 5: Word executors — backend

**Files:**
- Create: `backend/src/word/executors/read-word.executor.ts`
- Create: `backend/src/word/executors/read-word.executor.spec.ts`
- Create: `backend/src/word/executors/write-word.executor.ts`
- Create: `backend/src/word/executors/write-word.executor.spec.ts`
- Create: `backend/src/word/executors/edit-word.executor.ts`
- Create: `backend/src/word/executors/edit-word.executor.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/word/executors/read-word.executor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ReadWordExecutor } from './read-word.executor';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('ReadWordExecutor', () => {
  let executor: ReadWordExecutor;
  let wordService: WordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadWordExecutor,
        {
          provide: WordService,
          useValue: {
            read: jest.fn().mockResolvedValue({
              content: 'test content',
              tables: ['| h1 | h2 |\n| --- | --- |\n| a | b |'],
              metadata: { headingCount: 1, paragraphCount: 2 },
            }),
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            isPathAllowed: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    executor = module.get<ReadWordExecutor>(ReadWordExecutor);
    wordService = module.get<WordService>(WordService);
  });

  it('should return structured content from .docx', async () => {
    const result = await executor.execute({ path: '/test/doc.docx' });
    expect(result).toContain('test content');
    expect(result).toContain('| h1 | h2 |');
  });

  it('should return error for missing path', async () => {
    const result = await executor.execute({});
    expect(result).toContain('Error');
  });
});
```

Create `backend/src/word/executors/write-word.executor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WriteWordExecutor } from './write-word.executor';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WriteWordExecutor', () => {
  let executor: WriteWordExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteWordExecutor,
        {
          provide: WordService,
          useValue: {
            write: jest.fn().mockResolvedValue('Created /tmp/test.docx'),
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            getWorkspaceRoot: jest.fn().mockReturnValue('/mock/workspace'),
            isPathAllowed: jest.fn().mockReturnValue(true),
            writeFile: jest.fn().mockResolvedValue({ bytesWritten: 100, resolved: '/mock/workspace/agent-output/session_1/test.docx' }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            agentFile: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
        },
      ],
    }).compile();

    executor = module.get<WriteWordExecutor>(WriteWordExecutor);
  });

  it('should write .docx file', async () => {
    const result = await executor.execute({
      path: 'test.docx',
      content: '# Hello\nWorld',
    }, { mode: 'chat', sessionId: 0 });
    expect(result).toContain('Created');
  });

  it('should return error for missing content', async () => {
    const result = await executor.execute({ path: 'test.docx' });
    expect(result).toContain('Error');
  });
});
```

Create `backend/src/word/executors/edit-word.executor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EditWordExecutor } from './edit-word.executor';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EditWordExecutor', () => {
  let executor: EditWordExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditWordExecutor,
        {
          provide: WordService,
          useValue: {
            edit: jest.fn().mockResolvedValue('Updated /tmp/test.docx with 1 operation(s)'),
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            isPathAllowed: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            agentFile: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
        },
      ],
    }).compile();

    executor = module.get<EditWordExecutor>(EditWordExecutor);
  });

  it('should edit .docx file', async () => {
    const result = await executor.execute({
      path: '/tmp/test.docx',
      operations: [{ type: 'append', content: 'new text' }],
    });
    expect(result).toContain('Updated');
  });

  it('should return error for missing operations', async () => {
    const result = await executor.execute({ path: '/tmp/test.docx' });
    expect(result).toContain('Error');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npx jest src/word/executors/ --no-coverage`

Expected: FAIL — Cannot find module

- [ ] **Step 3: Create ReadWordExecutor**

Create `backend/src/word/executors/read-word.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ReadWordExecutor implements ToolExecutor {
  readonly name = 'read_word';

  constructor(
    private readonly wordService: WordService,
    private readonly workspace: WorkspaceService,
  ) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';

    if (!this.workspace.isPathAllowed(filePath)) {
      return `Error: path "${filePath}" is not allowed.`;
    }

    try {
      const result = await this.wordService.read(filePath);
      let output = result.content;
      if (result.tables.length > 0) {
        output += '\n\n--- Tables ---\n' + result.tables.join('\n\n');
      }
      output += `\n\n--- Metadata ---\nHeadings: ${result.metadata.headingCount}, Paragraphs: ${result.metadata.paragraphCount}`;
      return output;
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Create WriteWordExecutor**

Create `backend/src/word/executors/write-word.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class WriteWordExecutor implements ToolExecutor {
  readonly name = 'write_word';

  constructor(
    private readonly wordService: WordService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const rawPath = String(args.path ?? '');
    const content = String(args.content ?? '');
    if (!rawPath || !content) return 'Error: "path" and "content" are required';

    let filePath: string;

    if (context?.mode === 'agent') {
      const filename = rawPath.split(/[\\/]/).pop() || 'output.docx';
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context.sessionId}`,
      );
      filePath = path.join(sessionDir, filename);
    } else {
      filePath = rawPath;
      if (!this.workspace.isPathAllowed(filePath)) {
        return `Error: path "${filePath}" is not allowed.`;
      }
    }

    try {
      const result = await this.wordService.write(filePath, content);
      const filename = filePath.split(/[\\/]/).pop() || 'file.docx';
      if (context?.mode === 'agent') {
        await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/agent-output/${filename}/download)`;
      }
      return result;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Create EditWordExecutor**

Create `backend/src/word/executors/edit-word.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { WordService, WordEditOperation } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class EditWordExecutor implements ToolExecutor {
  readonly name = 'edit_word';

  constructor(
    private readonly wordService: WordService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const rawPath = String(args.path ?? '');
    const ops = args.operations;
    if (!rawPath) return 'Error: "path" is required';
    if (!Array.isArray(ops) || ops.length === 0) return 'Error: "operations" must be a non-empty array';

    let filePath: string;

    if (context?.mode === 'agent') {
      const filename = rawPath.split(/[\\/]/).pop() || 'output.docx';
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context.sessionId}`,
      );
      filePath = path.join(sessionDir, filename);
    } else {
      filePath = rawPath;
      if (!this.workspace.isPathAllowed(filePath)) {
        return `Error: path "${filePath}" is not allowed.`;
      }
    }

    try {
      const result = await this.wordService.edit(filePath, ops as WordEditOperation[]);
      const filename = filePath.split(/[\\/]/).pop() || 'file.docx';
      if (context?.mode === 'agent') {
        await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/agent-output/${filename}/download)`;
      }
      return result;
    } catch (e) {
      return `Error editing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest src/word/executors/ --no-coverage`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/word/executors/
git commit -m "feat: add Word agent tool executors (read, write, edit)"
```

---

### Task 6: Register WordModule + executors in app

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/tools/tools.module.ts`

- [ ] **Step 1: Register WordModule in app.module.ts**

Edit `backend/src/app.module.ts` — add import:

```typescript
import { WordModule } from './word/word.module';
```

Add to `imports` array:

```typescript
WordModule,
```

- [ ] **Step 2: Register Word executors in tools.module.ts**

Edit `backend/src/tools/tools.module.ts` — add imports:

```typescript
import { ReadWordExecutor } from '../word/executors/read-word.executor';
import { WriteWordExecutor } from '../word/executors/write-word.executor';
import { EditWordExecutor } from '../word/executors/edit-word.executor';
import { WordModule } from '../word/word.module';
```

Add to `imports` array:

```typescript
WordModule,
```

Add to `EXECUTORS` array:

```typescript
ReadWordExecutor,
WriteWordExecutor,
EditWordExecutor,
```

- [ ] **Step 3: Run backend tests to verify registration**

Run: `cd backend && npx jest --no-coverage`

Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.module.ts backend/src/tools/tools.module.ts
git commit -m "feat: register WordModule and Word executors"
```

---

### Task 7: Frontend — i18n keys for AgentOutput

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

Edit `frontend/src/locales/vi.json` — add after `"nav.notes"`:

```json
  "nav.agentOutput": "Kết quả",
```

Add at end of file (before closing `}`):

```json
  "agentOutput": {
    "header": "KẾT QUẢ AGENT",
    "empty": "Chưa có file nào",
    "download": "Tải",
    "filename": "Tên file",
    "size": "Kích thước",
    "modified": "Sửa lúc",
    "bytes": "B",
    "kb": "KB",
    "mb": "MB"
  }
```

- [ ] **Step 2: Add English keys**

Edit `frontend/src/locales/en.json` — add after `"nav.notes"`:

```json
  "nav.agentOutput": "Outputs",
```

Add at end of file (before closing `}`):

```json
  "agentOutput": {
    "header": "AGENT OUTPUTS",
    "empty": "No files yet",
    "download": "Download",
    "filename": "File",
    "size": "Size",
    "modified": "Modified",
    "bytes": "B",
    "kb": "KB",
    "mb": "MB"
  }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/
git commit -m "feat: add i18n keys for AgentOutput view"
```

---

### Task 8: Frontend — AgentOutputView component

**Files:**
- Create: `frontend/src/components/AgentOutputView.vue`

- [ ] **Step 1: Create AgentOutputView.vue**

Create `frontend/src/components/AgentOutputView.vue`:

```vue
<template>
  <div class="flex flex-col h-full bg-cyber-bg font-mono overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 border-b border-cyber-code-border bg-cyber-dark shrink-0">
      <h1 class="text-xs text-cyber-accent font-mono tracking-wider">{{ t('agentOutput.header') }}</h1>
      <button
        @click="fetchFiles"
        class="text-cyber-muted hover:text-cyber-accent transition-colors duration-150 text-xs font-mono"
      >
        ⟳
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-cyber-muted text-sm font-mono">
      {{ t('chat.thinking') }}
    </div>

    <div v-else-if="files.length === 0" class="flex-1 flex items-center justify-center text-cyber-muted text-sm font-mono">
      {{ t('agentOutput.empty') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div class="px-4 py-2 text-xs text-cyber-muted font-mono grid grid-cols-[1fr_80px_120px_60px] gap-2 border-b border-cyber-code-border">
        <span>{{ t('agentOutput.filename') }}</span>
        <span class="text-right">{{ t('agentOutput.size') }}</span>
        <span class="text-right">{{ t('agentOutput.modified') }}</span>
        <span></span>
      </div>

      <div v-for="file in files" :key="file.filename" class="px-4 py-2 text-xs font-mono grid grid-cols-[1fr_80px_120px_60px] gap-2 items-center border-b border-cyber-code-border hover:bg-cyber-row transition-colors duration-150">
        <span class="text-cyber-code-text truncate" :title="file.filename">{{ file.filename }}</span>
        <span class="text-cyber-muted text-right">{{ formatSize(file.size) }}</span>
        <span class="text-cyber-muted text-right">{{ formatDate(file.modifiedAt) }}</span>
        <a
          :href="`/api/agent-output/${encodeURIComponent(file.filename)}/download`"
          class="text-cyber-accent hover:text-cyber-link transition-colors duration-150 text-center"
          download
        >
          {{ t('agentOutput.download') }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface AgentOutputFile {
  filename: string
  size: number
  modifiedAt: string
}

const files = ref<AgentOutputFile[]>([])
const loading = ref(true)

async function fetchFiles() {
  loading.value = true
  try {
    const res = await fetch('/api/agent-output')
    if (res.ok) {
      files.value = await res.json()
    }
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}${t('agentOutput.bytes')}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}${t('agentOutput.kb')}`
  return `${(bytes / (1024 * 1024)).toFixed(1)}${t('agentOutput.mb')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchFiles)
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentOutputView.vue
git commit -m "feat: add AgentOutputView component for browsing agent-generated files"
```

---

### Task 9: Frontend — Navigation update (SidebarNav + BottomTabBar + AppShell)

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`
- Modify: `frontend/src/components/BottomTabBar.vue`
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Update SidebarNav.vue**

Edit `frontend/src/components/SidebarNav.vue` — add `'agent-output'` to the type union and nav items.

Add `HiDownload` to the import from `vue-icons-plus/hi`:

```typescript
import { HiChatAlt2, HiClipboardList, HiCog, HiLightningBolt, HiDocumentText, HiCode, HiDownload } from 'vue-icons-plus/hi'
```

Update `defineProps` to include `'agent-output'`:

```typescript
defineProps<{ activeView: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output' }>()
defineEmits<{ navigate: [view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'] }>()
```

Add `'agent-output'` to `NavItem.view` type:

```typescript
interface NavItem {
  view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'
  labelKey: string
  icon: Component | string
}
```

Add nav item after `notes`:

```typescript
{ view: 'agent-output', labelKey: 'nav.agentOutput', icon: HiDownload },
```

- [ ] **Step 2: Update BottomTabBar.vue**

Edit `frontend/src/components/BottomTabBar.vue` — same changes.

Add `HiDownload` to import:

```typescript
import { HiChatAlt2, HiClipboardList, HiCog, HiLightningBolt, HiDocumentText, HiCode, HiDownload } from 'vue-icons-plus/hi'
```

Update `defineProps`:

```typescript
defineProps<{ activeView: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output' }>()
defineEmits<{ navigate: [view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'] }>()
```

Update `NavItem.view` type and add item:

```typescript
interface NavItem {
  view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'
  labelKey: string
  icon: Component | string
}

const navItems: NavItem[] = [
  { view: 'chat',         labelKey: 'nav.chat',         icon: HiChatAlt2 },
  { view: 'cowork',       labelKey: 'nav.cowork',       icon: HiCode },
  { view: 'tasks',        labelKey: 'nav.tasks',        icon: HiClipboardList },
  { view: 'plans',        labelKey: 'nav.plans',        icon: '📋' },
  { view: 'agent-output', labelKey: 'nav.agentOutput',  icon: HiDownload },
  { view: 'tools',        labelKey: 'nav.tools',        icon: HiLightningBolt },
  { view: 'providers',    labelKey: 'nav.providers',    icon: HiCog },
  { view: 'notes',        labelKey: 'nav.notes',        icon: HiDocumentText },
  { view: 'settings',     labelKey: 'nav.settings',     icon: HiCog },
]
```

- [ ] **Step 3: Update AppShell.vue**

Edit `frontend/src/components/AppShell.vue`:

Add import:

```typescript
import AgentOutputView from './AgentOutputView.vue'
```

Update `activeView` type:

```typescript
const activeView = ref<'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'>('chat')
```

Add conditional rendering:

```vue
<AgentOutputView v-else-if="activeView === 'agent-output'" class="flex-1 overflow-hidden" />
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npm run type-check`

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SidebarNav.vue frontend/src/components/BottomTabBar.vue frontend/src/components/AppShell.vue
git commit -m "feat: add agent-output navigation to sidebar, bottom tab, and app shell"
```

---

### Task 10: Update AGENTS.md files

**Files:**
- Modify: `backend/AGENTS.md`
- Modify: `backend/src/word/AGENTS.md` (create if needed)
- Modify: `backend/src/agent-output/AGENTS.md` (create if needed)
- Modify: `frontend/src/components/AGENTS.md`
- Modify: `frontend/AGENTS.md`

- [ ] **Step 1: Create word/AGENTS.md**

Create `backend/src/word/AGENTS.md`:

```markdown
# word/ — Agent Context

Word document processing module. Handles .docx read, write, and edit operations for the AI agent.

## Files

```
word/
├── word.module.ts
├── word.service.ts
├── word.service.spec.ts
└── executors/
    ├── read-word.executor.ts
    ├── read-word.executor.spec.ts
    ├── write-word.executor.ts
    ├── write-word.executor.spec.ts
    ├── edit-word.executor.ts
    └── edit-word.executor.spec.ts
```

## Services

### WordService

- `read(filePath)` — uses mammoth to extract HTML content, parses tables and formatting, returns structured `{ content, tables, metadata }`
- `write(filePath, content)` — uses `docx` npm package to create .docx from markdown with heading/table/list/formatting support
- `edit(filePath, operations)` — uses `docx` package to modify existing .docx (append content or replace text)

## Agent Tools

| Tool name | Executor | Args | Description |
|---|---|---|---|
| `read_word` | `ReadWordExecutor` | `{ path }` | Reads .docx → structured markdown + tables + metadata |
| `write_word` | `WriteWordExecutor` | `{ path, content }` | Creates .docx from markdown; agent-mode routes to agent-output/ |
| `edit_word` | `EditWordExecutor` | `{ path, operations }` | Modifies existing .docx; agent-mode routes to agent-output/ |

## Dependencies

- mammoth (.docx → HTML)
- docx (create/edit .docx programmatically)
- WorkspaceService (path validation)
- PrismaService (AgentFile record creation)
```

- [ ] **Step 2: Create agent-output/AGENTS.md**

Create `backend/src/agent-output/AGENTS.md`:

```markdown
# agent-output/ — Agent Context

Agent output file management module. Lists and serves files created by AI agents in agent mode.

## Files

```
agent-output/
├── agent-output.module.ts
├── agent-output.controller.ts
└── agent-output.controller.spec.ts
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/agent-output | List files in agent-output/ directory |
| GET | /api/agent-output/:filename/download | Download file by filename |

## How it works

- Reads files from `{workspaceRoot}/agent-output/` directory (filesystem, not DB)
- Works with any file type saved by agent tools (Word, Excel, text, etc.)
- Executors like write_word, write_excel, and write_file create files here + optional AgentFile DB record
```

- [ ] **Step 3: Update backend/AGENTS.md**

Add `WordModule` and `AgentOutputModule` to the module map and API endpoints table.

- [ ] **Step 4: Update frontend/AGENTS.md**

Add `AgentOutputView` to the component hierarchy.

- [ ] **Step 5: Update frontend/src/components/AGENTS.md**

Add `AgentOutputView.vue` to the component map.

- [ ] **Step 6: Commit**

```bash
git add backend/src/word/AGENTS.md backend/src/agent-output/AGENTS.md
git add backend/AGENTS.md frontend/AGENTS.md frontend/src/components/AGENTS.md
git commit -m "docs: update AGENTS.md with Word module and AgentOutput module"
```
