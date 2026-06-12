# Word Processing + Agent Output Storage — Design Spec

## Goal

Integrate Word (.docx) document processing tools so the AI agent can read, create, and edit Word documents. Additionally, establish a unified agent output storage system (agent-output/) for files created by AI in agent mode, covering both Word and Excel tools.

## Scope

- Backend: Word module (read/write/edit .docx), AgentOutput module (list + download agent-generated files)
- Frontend: AgentOutputView component for browsing/downloading agent-generated files
- Update: Excel executors adopt agent-output routing (matching write-file pattern)
- Out of scope: PDF conversion, legacy .doc format, Word document preview/rendering in UI, Knowledge Base changes

## Architecture

### Backend modules

| Module | Location | Purpose |
|---|---|---|
| `WordModule` | `backend/src/word/` | WordService + executors (read-word, write-word, edit-word) |
| `AgentOutputModule` | `backend/src/agent-output/` | REST endpoints to list + download agent-output files |

### WordModule

Files:
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

**WordService** — 3 methods:
- `read(filePath)` — uses mammoth.convertToHtml with styleMap to preserve bold, italic, underline, tables, lists, headings. Parses HTML result into structured format: `{ content, tables: Table[], metadata: { author?, createdDate?, modifiedDate?, headingCount } }`. Tables extracted separately as markdown-formatted grids.
- `write(filePath, content)` — uses `docx` npm package. Accepts markdown content, parses into docx Document objects (Paragraph, Table, Heading, TextRun with formatting). Creates new .docx file.
- `edit(filePath, operations)` — reads existing .docx, applies operations (insertParagraph, insertTable, replaceText, appendContent), writes back.

**Agent tool executors:**

| Executor | Tool name | Args | Behavior |
|---|---|---|---|
| `ReadWordExecutor` | `read_word` | `{ path: string }` | Reads .docx → returns structured markdown + tables + metadata |
| `WriteWordExecutor` | `write_word` | `{ path, content }` | Creates .docx from markdown; agent-mode routes to agent-output/ |
| `EditWordExecutor` | `edit_word` | `{ path, operations }` | Modifies existing .docx; agent-mode routes to agent-output/ |

### AgentOutputModule

```
agent-output/
├── agent-output.module.ts
├── agent-output.controller.ts
└── agent-output.service.ts
```

**API endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/agent-output` | List files in `{workspaceRoot}/agent-output/` — returns `[{ filename, size, modifiedAt }]` |
| `GET` | `/api/agent-output/:filename/download` | Stream file download |

### Mode-aware storage (update Excel executors)

Currently Excel executors (write-excel, add-sheet, excel-chart) do not implement mode-aware path routing. They need to follow the exact pattern from `write-file.executor.ts`:

```
if (context?.mode === 'agent') {
  // route to {workspaceRoot}/agent-output/session_{sessionId}/
} else {
  // cowork: use original path (local workspace folder)
}
```

Files to update:
- `backend/src/excel/executors/write-excel.executor.ts`
- `backend/src/excel/executors/excel-add-sheet.executor.ts`
- `backend/src/excel/executors/excel-chart.executor.ts`

### Frontend

**New component: `AgentOutputView.vue`**
- Lists files from `GET /api/agent-output`
- File name, size, modified date, download button
- Click download → `GET /api/agent-output/:filename/download`
- Uses same terminal aesthetic (font-mono, cyber colors, no shadows, max rounded)
- i18n keys: `agentOutput.*`

**Navigation update:**
- SidebarNav.vue — add `agent-output` view with `HiDownload` icon
- BottomTabBar.vue — add `agent-output` view
- AppShell.vue — add `'agent-output'` to `activeView` union type + conditional rendering

**i18n keys to add:**

| Key | vi | en |
|---|---|---|
| `nav.agentOutput` | "Kết quả" | "Outputs" |
| `agentOutput.header` | "KẾT QUẢ AGENT" | "AGENT OUTPUTS" |
| `agentOutput.empty` | "Chưa có file nào" | "No files yet" |
| `agentOutput.download` | "Tải" | "Download" |
| `agentOutput.filename` | "File" | "File" |
| `agentOutput.size` | "Kích thước" | "Size" |
| `agentOutput.modified` | "Sửa lúc" | "Modified" |

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `docx` | latest | Create and edit .docx files programmatically |
| `mammoth` | ^1.12.0 | Already present — read .docx to structured HTML |

## Data flow

### Read Word (agent mode)
1. User: "đọc file report.docx"
2. Agent calls `read-word({ path: 'report.docx' })`
3. Executor resolves full path via WorkspaceService
4. WordService.read() → mammoth → structured content
5. Returns markdown text + tables to agent context
6. Agent responds with summary/content

### Write Word (agent mode)
1. User: "tạo file báo cáo.docx với nội dung..."
2. Agent calls `write-word({ path: 'báo cáo.docx', content: '...markdown...' })`
3. Executor routes to `{workspaceRoot}/agent-output/session_{sessionId}/báo cáo.docx`
4. Creates AgentFile record in DB
5. Returns download link: `[Download](api/agent-output/báo cáo.docx/download)`
6. User can download from AgentOutputView or click link in chat

### Write Excel (agent mode) — updated
1. User: "tạo file data.xlsx"
2. Agent calls `write-excel({ path: 'data.xlsx', operations: [...] })`
3. Executor routes to `agent-output/session_{sessionId}/data.xlsx` (same as write-file)
4. Creates AgentFile record
5. Returns download link

## Error handling

- Invalid .docx → "Error: không thể đọc file. File có thể bị hỏng hoặc không phải định dạng .docx."
- File not found → "Error: không tìm thấy file tại đường dẫn..."
- Path not allowed → "Error: đường dẫn không được phép."
- Validation: all executors validate path extension is `.docx`

## Testing

- WordService: unit tests with sample .docx fixtures
- Executors: mocked WordService, test mode-aware path routing
- AgentOutputController: e2e tests for list + download
- Existing Excel executor tests: update to verify agent-output routing
