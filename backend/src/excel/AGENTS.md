# excel/ — Agent Context

Excel spreadsheet processing module. Handles .xlsx read/write/chart operations for the AI agent via `exceljs`.

## Files

```
excel/
├── excel.module.ts
├── excel.service.ts
├── excel.service.spec.ts
└── executors/
    ├── read-excel.executor.ts
    ├── write-excel.executor.ts
    ├── list-excel-sheets.executor.ts
    ├── excel-add-sheet.executor.ts
    └── excel-chart.executor.ts
```

## Services

### ExcelService

- `readSheet(filePath, options?)` — reads a sheet (optional `sheet`, `range`) → markdown table.
- write operations — `WriteOperation` supports `write_cell`, `write_row`, `write_column`, `formula`, `merge`, `style`, `column_width`; cell styling via `CellStyle` (bold, italic, fontSize, fontColor, fillColor, numberFormat, border).
- sheet/chart management — add sheets and embed charts.

## Agent Tools

| Tool name | Executor | Description |
|---|---|---|
| `read_excel` | `ReadExcelExecutor` | Read a sheet/range → markdown table |
| `write_excel` | `WriteExcelExecutor` | Apply write operations to a workbook |
| `list_excel_sheets` | `ListExcelSheetsExecutor` | List sheet/tab names in a workbook |
| `excel_add_sheet` | `ExcelAddSheetExecutor` | Add a new sheet to a workbook |
| `excel_chart` | `ExcelChartExecutor` | Add a chart to a sheet |

Executors are registered as providers in `AgentModule`; agent-mode writes route to `agent-output/`.

## Dependencies

- exceljs (.xlsx read/write)
- WorkspaceService (path validation)
- PrismaService (AgentFile record creation)

## Testing

```bash
npx jest src/excel     # ExcelService unit tests
```
