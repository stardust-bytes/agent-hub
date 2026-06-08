# Section-Aware Citation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace chunk index (`§N`) in citations with document section numbers (`§I`, `§2.1`, `§A`). Fallback to chunk index if no heading structure.

**Architecture:** New `parseHeadings()` function detects section boundaries from document text. Section-aware chunking replaces raw character-split. `ChunkRecord` gains `section` field. LanceDB schema updated. Agent prompt cites section number.

**Tech Stack:** NestJS, Prisma, LanceDB, mammoth, pdf-parse, TypeScript

---

## Files

| Type | File |
|------|------|
| Modify | `backend/src/knowledge/knowledge.service.ts` |
| Modify | `backend/src/agent/providers/ollama.provider.ts` |
| Modify | `backend/src/agent/services/context-builder.service.ts` |
| Modify | `backend/src/knowledge/knowledge.controller.ts` (if add re-index endpoint) |

---

### Task 1: Add `section` to ChunkRecord + update LanceDB init

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`

- [ ] **Step 1: Update ChunkRecord interface**

Replace line 9-16:
```ts
interface ChunkRecord {
  id: string;
  fileId: number;
  filename: string;
  chunkIndex: number;
  section: string;
  text: string;
  vector: number[];
}
```

- [ ] **Step 2: Update initLanceDB to detect schema change**

Replace the `initLanceDB` method (lines 34-45):

```ts
private async initLanceDB() {
  if (!fs.existsSync(this.lancedbDir)) fs.mkdirSync(this.lancedbDir, { recursive: true });
  const db = await lancedb.connect(this.lancedbDir);
  const tables = await db.tableNames();
  if (tables.includes('chunks')) {
    this.table = await db.openTable('chunks');
    const schema = await this.table.schema;
    const hasSection = schema.fields.some((f: any) => f.name === 'section');
    if (!hasSection) {
      await db.dropTable('chunks');
      this.table = await db.createTable('chunks', [
        { id: 'init', fileId: 0, filename: '', chunkIndex: 0, section: '', text: '', vector: new Array(768).fill(0) },
      ], { mode: 'overwrite' });
    }
  } else {
    this.table = await db.createTable('chunks', [
      { id: 'init', fileId: 0, filename: '', chunkIndex: 0, section: '', text: '', vector: new Array(768).fill(0) },
    ], { mode: 'overwrite' });
  }
}
```

---

### Task 2: Implement `parseHeadings()`

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`

- [ ] **Step 1: Add `parseHeadings()` method**

Add this method after `chunkText()`:

```ts
private parseHeadings(text: string, mimeType: string): Array<{ number: string; title: string; startPos: number }> {
  const headings: Array<{ number: string; title: string; startPos: number }> = []
  const lines = text.split('\n')
  let headingCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    let sectionNum = ''

    // Markdown headings
    const mdMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (mdMatch) {
      sectionNum = mdMatch[2].match(/^([\d.A-Za-z]+)[.\s)]/)?.[1] || `${headingCount + 1}`
      headings.push({ number: sectionNum, title: mdMatch[2], startPos: lines.slice(0, i).join('\n').length })
      headingCount++
      continue
    }

    // Roman numeral / decimal heading patterns: I. 1. 1.1 A. Chapter 1, Section 2
    const patternMatch = line.match(/^(I{1,3}|IV|V|VI{0,3}|IX|X|[1-9]\d*)(?:\.([1-9]\d*))*[.\s)]+(.+)/)
    if (patternMatch) {
      sectionNum = patternMatch[1]
      if (patternMatch[2]) sectionNum += '.' + patternMatch[2]
      headings.push({ number: sectionNum, title: patternMatch[3], startPos: lines.slice(0, i).join('\n').length })
      headingCount++
      continue
    }

    // "Chapter N" / "Section N" pattern
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
```

---

### Task 3: Update `extractText()` for DOCX headings

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`

- [ ] **Step 1: Switch DOCX extraction to HTML mode**

Replace the DOCX branch in `extractText()` (lines 168-171):

```ts
if (ext === '.docx') {
  const result = await mammoth.convertToHtml({ path: filepath });
  const html = result.value || '';
  // Convert HTML headings to markdown-style for parseHeadings to handle
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
```

---

### Task 4: Update `chunkText()` to section-aware logic

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`

- [ ] **Step 1: Add section-aware chunking**

Rename old `chunkText` to `legacyChunkText`. Add new section-aware method:

```ts
private chunkText(text: string, chunkSize: number, overlap: number): Array<{ text: string; section: string }> {
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
```

---

### Task 5: Update `processFile()` and `search()` for section field

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`

- [ ] **Step 1: Update processFile() to use new chunkText**

Replace the chunk loop in `processFile()` (lines 104-117):

```ts
const rawChunks = this.chunkText(content, 512, 50);
const records: ChunkRecord[] = [];

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
  });
}
```

- [ ] **Step 2: Update search() to return section**

Replace the search result mapping (lines 156-160):

```ts
return results.filter(r => r.fileId > 0).map(r => ({
  filename: r.filename,
  section: r.section,
  chunkIndex: r.chunkIndex,
  text: r.text,
}));
```

---

### Task 6: Update agent prompt and citation format

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`
- Modify: `backend/src/agent/providers/ollama.provider.ts`

- [ ] **Step 1: Update system prompt**

In `context-builder.service.ts`, replace line 70:
```ts
'- If results are found: synthesize into a coherent answer. Cite each fact inline with [Source: "filename", §N]. Cite all sources that agree.',
```

With:
```ts
'- If results are found: synthesize into a coherent answer. Cite each fact inline with [Source: "filename", §N]. §N is the document section number (e.g., §I, §2.1, §A). Use the section number from the chunk metadata. Cite all sources that agree.',
```

- [ ] **Step 2: Update citation format in knowledge result**

In `ollama.provider.ts`, find the line with `chunkIndex` in the KB result rendering (around line 264). Replace:
```ts
`[${i + 1}] Source: "${c.filename}", §${c.chunkIndex}\n${c.text}`
```

With:
```ts
`[${i + 1}] Source: "${c.filename}", §${c.section || c.chunkIndex}\n${c.text}`
```

Update the result type to include `section`:
```ts
const kbResult = results.map((c: { filename: string; section: string; chunkIndex: number; text: string }, i: number) => {
```

---

### Task 7: Handle re-indexing existing files

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`
- Modify: `backend/src/knowledge/knowledge.controller.ts`

- [ ] **Step 1: Add re-index endpoint**

In `knowledge.controller.ts`, add:
```ts
@Post('reindex')
async reindexAll() {
  await this.knowledgeService.reindexAll();
  return { ok: true };
}
```

- [ ] **Step 2: Add reindexAll() method**

In `knowledge.service.ts`, add:
```ts
async reindexAll() {
  const files = await this.prisma.knowledgeFile.findMany({ where: { status: 'ready' } });
  for (const file of files) {
    await this.processFile(file.id);
  }
}
```

---

### Task 8: Run tests and verify build

- [ ] **Step 1: Run backend tests**

Run: `npx jest`
Expected: 85 passes (or existing count). New tests for `parseHeadings()` may be added.

- [ ] **Step 2: Run frontend build**

Run: `cd ../frontend && npm run build`
Expected: vue-tsc passes, vite build succeeds.
