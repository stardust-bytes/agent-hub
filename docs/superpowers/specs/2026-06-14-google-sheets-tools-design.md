# Google Sheets Tool Integration — Design Spec

**Date:** 2026-06-14
**Status:** Approved

---

## Overview

Add Google Sheets read/write/create/format/chart capabilities to the agent tool system. Implemented as 8 new executors following the existing Google connector pattern (Gmail, Calendar, Drive). Requires a new `google_sheets` connector type in `SCOPE_MAP` — no new connector infrastructure needed.

---

## Architecture

### Connector

No new OAuth infrastructure. One addition to `SCOPE_MAP` in `google-oauth.service.ts`:

```ts
google_sheets: [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
],
```

`drive.readonly` scope enables spreadsheet resolution by name (Drive search). The existing `GoogleOAuthService` handles token exchange, storage, and refresh automatically.

User connects via Connectors UI (same flow as Gmail/Drive). The connector is stored as `type: "google_sheets"` in the `Connector` table.

### New Service

`connector/providers/google/google-sheets.service.ts`

- `getSheets()` — returns `google.sheets({ version: 'v4', auth })` using `getAuthenticatedClient('google_sheets')`. Throws `Error('Google Sheets not connected')` if no token.
- `getDrive()` — returns `google.drive({ version: 'v3', auth })` for name-based resolution.
- `resolveSpreadsheetId(spreadsheet: string): Promise<string>` — if `spreadsheet` matches a Sheets URL or bare ID pattern (`/^[a-zA-Z0-9_-]{25,}$/`), return as-is. Otherwise, search Drive (`mimeType='application/vnd.google-apps.spreadsheet' and name contains '...'`) and return the first result ID. Throws `Error('Spreadsheet not found: ...')` if no match.

All public methods call `resolveSpreadsheetId` internally when they receive a `spreadsheet` param, so executors never handle resolution themselves.

### Executors (8 total)

Location: `tools/executors/google-sheets-*.executor.ts`

All executors follow this pattern: inject `GoogleSheetsService`, wrap `execute()` in try/catch, return `Error: ${e.message}` on failure.

| Executor class | Tool name | Parameters (required*) |
|---|---|---|
| `GoogleSheetsReadExecutor` | `google_sheets_read` | `spreadsheet`*, `range`*, `tab?` |
| `GoogleSheetsListTabsExecutor` | `google_sheets_list_tabs` | `spreadsheet`* |
| `GoogleSheetsUpdateExecutor` | `google_sheets_update` | `spreadsheet`*, `range`*, `values`*, `tab?` |
| `GoogleSheetsAppendExecutor` | `google_sheets_append` | `spreadsheet`*, `values`*, `tab?` |
| `GoogleSheetsCreateExecutor` | `google_sheets_create` | `title`*, `initialTab?` |
| `GoogleSheetsAddTabExecutor` | `google_sheets_add_tab` | `spreadsheet`*, `tabName`* |
| `GoogleSheetsFormatExecutor` | `google_sheets_format` | `spreadsheet`*, `range`*, `tab?`, `format`* |
| `GoogleSheetsChartExecutor` | `google_sheets_chart` | `spreadsheet`*, `tab`*, `type`*, `dataRange`*, `categoriesRange?`, `title?` |

**`spreadsheet`** param accepts spreadsheet ID (from URL) or human name ("Báo cáo Q2"). `tab` defaults to the first sheet when omitted.

**`format`** object supports: `bold?: boolean`, `italic?: boolean`, `fontSize?: number`, `fontColor?: string` (hex), `fillColor?: string` (hex), `numberFormat?: string` (pattern like `#,##0.00`), `border?: boolean`.

**`type`** for chart: `BAR | LINE | PIE | COLUMN` (maps to Sheets API `BasicChartType`).

**Output formats:**
- `read` → markdown table
- `list_tabs` → `Tab: "Sheet1" (1000 rows × 26 cols)\nTab: "Data" (500 rows × 10 cols)\n...`
- `update` / `append` → `Updated N cells.` / `Appended N rows.`
- `create` → `Created spreadsheet: <title> (id: <spreadsheetId>)`
- `add_tab` → `Added tab "<name>" to spreadsheet.`
- `format` → `Formatted range <range>.`
- `chart` → `Chart added to tab "<tab>".`

---

## Wiring Points (3 files touched)

### 1. `google-oauth.service.ts`
Add `google_sheets` entry to `SCOPE_MAP`.

### 2. `tools.module.ts` + `agent-loop.service.ts`
Import and add all 8 executors to the `EXECUTORS` array in both files.

### 3. `prisma/seed.ts`
Add 8 entries to `DEFAULT_TOOLS`. All `enabled: false` by default (user enables via Tools UI). Descriptions written for LLM consumption — specific, with parameter hints.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Not connected | Service throws `Error('Google Sheets not connected')` → executor returns `Error: Google Sheets not connected` |
| Name not found | Service throws `Error('Spreadsheet not found: Báo cáo Q2')` → executor returns that string |
| Invalid range | Sheets API error propagated → `Error: <API message>` |
| Drive search fails | Propagated as above |

---

## Testing

**`google-sheets.service.spec.ts`** — mock `GoogleOAuthService.getAuthenticatedClient()`.
- Test `resolveSpreadsheetId`: ID passthrough, Drive search hit, Drive search miss (throws).
- Test each public method: happy path with mocked Sheets/Drive API responses.

**Per-executor spec** (`google-sheets-read.executor.spec.ts` etc.) — mock `GoogleSheetsService`.
- Happy path: returns expected string format.
- Not-connected: returns `Error: Google Sheets not connected`.
- Not-found: returns `Error: Spreadsheet not found: ...`.

---

## What Is NOT in Scope

- No UI changes to Connectors panel — existing OAuth connect flow handles `google_sheets` automatically once `SCOPE_MAP` entry is added.
- No new Prisma schema — no DB model needed.
- No changes to `connector.service.ts` or `connector.controller.ts`.
- No batch multi-spreadsheet operations.
- No formula evaluation (write formula strings as values; Sheets evaluates them natively).
