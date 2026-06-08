# Section-Aware Citation — Design Spec

## Overview

Replace chunk index (`§N`) in citations with actual document section numbers (e.g., `§I`, `§2.1`, `§A`). Falls back to chunk index if no heading structure is detected.

## Architecture

### 1. Section Parsing

New `parseHeadings(text: string, mimeType: string): Array<{ number: string; title: string; startPos: number }>`

**DOCX:** Switch `mammoth.extractRawText()` → `mammoth.convertToHtml()`. Parse `<h1>`, `<h2>`, `<h3>` tags from HTML output to extract heading hierarchy and section numbering.

**PDF:** `pdf-parse` output preserves heading-like lines. Detect patterns: `I.`, `1.1`, `Chapter N`, `SECTION N` at line start.

**Markdown:** Parse `# `, `## `, `### ` headings directly. Extract existing numbering from heading text.

**Plain text:** Same pattern detection as PDF.

**No heading detected →** return empty array (fallback to chunk index).

### 2. Section-Aware Chunking

Replace current `chunkText()` with section-boundary-aware logic:

```
sections = parseHeadings(text, mimeType)
if sections is empty:
    fall back to legacy chunkText()

for each section in sections:
    sectionText = text[section.startPos .. nextSection.startPos]
    if sectionText.length > chunkSize:
        subChunks = splitByCharCount(sectionText, 512, 50)
        for sc in subChunks:
            chunks.push({ text: sc, section: section.number })
    else:
        chunks.push({ text: sectionText, section: section.number })
```

### 3. Data Model

```ts
interface ChunkRecord {
  id: string;
  fileId: number;
  filename: string;
  chunkIndex: number;
  section: string;       // "I", "2.1", "A" or "" for no heading
  text: string;
  vector: number[];
}
```

LanceDB table needs to be recreated with new schema → all existing files must be re-indexed.

### 4. Citation Format

**Knowledge search result** (`ollama.provider.ts:264`):
```ts
`[${i + 1}] Source: "${c.filename}", §${c.section || c.chunkIndex}\n${c.text}`
```

**System prompt** (`context-builder.service.ts:70`):
```
'Cite each fact inline with [Source: "filename", §N]. §N is the document section number (e.g., §I, §2.1, §A). Use the section number from the chunk metadata.'
```

### 5. Search

```ts
async search(query: string): Promise<Array<...>> {
  // ... existing embedding + vector search
  return results.map(r => ({
    filename: r.filename,
    section: r.section,
    chunkIndex: r.chunkIndex,
    text: r.text,
  }))
}
```

TopK remains `limit(5)`. Chunk size remains 512, overlap 50.

## Files Changed

| File | Change |
|------|--------|
| `backend/src/knowledge/knowledge.service.ts` | `ChunkRecord` add `section`; `parseHeadings()`; section-aware `chunkText()`; `extractText()` DOCX mode; `search()` return `section`; LanceDB table recreation |
| `backend/src/agent/providers/ollama.provider.ts` | Citation format uses `section` over `chunkIndex` |
| `backend/src/agent/services/context-builder.service.ts` | System prompt updated with section citation guidance |

## Re-indexing

Existing files in LanceDB have old schema. On deploy:
1. Drop `chunks` table
2. Create new table with `section` column
3. All files with status `ready` get re-processed via `processFile()`
