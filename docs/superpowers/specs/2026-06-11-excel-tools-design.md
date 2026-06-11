# Excel Manipulation Tools

## Overview

Add 5 new agent tools for Excel file (.xlsx) manipulation: read, write, sheet management, and chart creation. Uses `exceljs` library — zero external dependencies, no LibreOffice required.

## Tools

### 1. `read_excel`

Read data from an Excel file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path to .xlsx file |
| `sheet` | string | no | Sheet name (default: first sheet) |
| `range` | string | no | Cell range like "A1:D10" (default: all used cells) |

**Returns:** Markdown table of cell data.

**Error:** `Error: File not found` if path doesn't exist.

### 2. `write_excel`

Write data to an Excel file. Creates file if it doesn't exist. Creates the default "Sheet1" sheet if the file is new.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path to .xlsx file |
| `operations` | array | yes | Array of operation objects (see below) |

**Operation types:**

| Type | Key Fields | Description |
|------|-----------|-------------|
| `write_cell` | `sheet`, `cell`, `value`, `style?` | Write a single cell |
| `write_row` | `sheet`, `cell`, `values[]`, `style?` | Write a row starting at cell |
| `write_column` | `sheet`, `cell`, `values[]`, `style?` | Write a column starting at cell |
| `formula` | `sheet`, `cell`, `formula` | Write a formula (e.g. `SUM(B1:B5)`) |
| `merge` | `sheet`, `range` | Merge cells (e.g. `A1:C1`) |
| `style` | `sheet`, `range`, `style` | Apply style to a range |
| `column_width` | `sheet`, `column`, `width` | Set column width |

**Style object:**
```json
{ "bold": true, "italic": true, "fontSize": 12, "fontColor": "FF0000",
  "fillColor": "FFFF00", "numberFormat": "#,##0",
  "border": true, "horizontalAlignment": "center" }
```

### 3. `excel_add_sheet`

Add a new sheet to an existing workbook.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path to .xlsx file |
| `sheet` | string | yes | Name for the new sheet |

### 4. `list_excel_sheets`

List all sheet names in a workbook.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path to .xlsx file |

**Returns:** `Sheets: Sheet1, Sheet2, Sheet3`

### 5. `excel_chart`

Add a chart to an existing sheet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path to .xlsx file |
| `sheet` | string | yes | Sheet name |
| `type` | string | yes | Chart type: `bar`, `line`, `pie`, `column` |
| `title` | string | no | Chart title |
| `dataRange` | string | yes | Source data range (e.g. `B2:D5`) |
| `categoriesRange` | string | no | Category labels range (e.g. `A2:A5`) |

## File Structure

```
backend/src/
├── excel/
│   ├── excel.module.ts              — NestJS module
│   ├── excel.service.ts             — Core logic via exceljs
│   ├── excel.service.spec.ts
│   └── executors/
│       ├── read-excel.executor.ts
│       ├── read-excel.executor.spec.ts
│       ├── write-excel.executor.ts
│       ├── write-excel.executor.spec.ts
│       ├── excel-add-sheet.executor.ts
│       ├── excel-chart.executor.ts
│       └── list-excel-sheets.executor.ts
```

## Integration

### New Dependencies

```json
"exceljs": "^4.4.0"
```

### Registration

1. `ExcelModule` with `ExcelService` as provider + exported
2. Import `ExcelModule` in `AppModule`
3. All 5 executors registered in `AgentModule` (injected into `AgentLoopService`'s executor map)
4. 5 tool definitions added to `prisma/seed.ts`
5. Path validation via existing `isPathAllowed()` in each executor

### Path Security

All file paths are validated against `ALLOWED_PATHS` (same as `write_file`/`read_file`):
- `./workspace_data`
- `os.tmpdir()`
- `USERPROFILE`/`HOME`
- `process.cwd()`

## Error Handling

| Scenario | Response |
|----------|----------|
| File not found (read) | `Error: File not found: path` |
| Invalid .xlsx format | `Error: Invalid Excel file` |
| Sheet not found | `Error: Sheet "name" not found. Available: sheet1, sheet2` |
| Path not allowed | `Error: Path is not permitted` |
| ExcelJS error | `Error: Excel operation failed: details` |

## Testing

```bash
npm install exceljs
npx jest src/excel/           # Excel service + executors
npx jest src/agent            # integration with agent loop
```

Tests use `exceljs` directly (no mocking) with temp files in `os.tmpdir()`.
