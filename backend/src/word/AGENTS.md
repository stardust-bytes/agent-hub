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
- `edit(filePath, operations)` — uses mammoth round-trip to modify existing .docx (append content or replace text)

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
