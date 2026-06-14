# Google Sheets Create in Folder

## Problem

`google_sheets_create` currently creates spreadsheets at Drive root only. Users need
to create spreadsheets inside a specific Drive folder.

## Design

### Service (`google-sheets.service.ts`)

Add optional `parentFolderId` param to `create()`:

- **With `parentFolderId`:** Use `drive.files.create` with
  `mimeType: 'application/vnd.google-apps.spreadsheet'` and `parents: [parentFolderId]`.
  If `initialTab` is set, rename Sheet1 via `sheets.spreadsheets.batchUpdate`.
- **Without `parentFolderId`:** Keep existing `sheets.spreadsheets.create` path
  (backward compatible).

### Executor (`google-sheets-create.executor.ts`)

Add `parentFolderId` (optional string) to tool parameters. Pipe through to service.

### Seed (`prisma/seed.ts`)

Update tool description and parameters schema for `google_sheets_create`.

### Files Changed

| File | Change |
|---|---|
| `backend/src/connector/providers/google/google-sheets.service.ts` | Modify `create()` signature and logic |
| `backend/src/connector/providers/google/google-sheets.service.spec.ts` | Add tests for parentFolderId |
| `backend/src/tools/executors/google-sheets-create.executor.ts` | Add parentFolderId param |
| `backend/src/tools/executors/google-sheets-create.executor.spec.ts` | Add test for parentFolderId |
| `backend/prisma/seed.ts` | Update tool definition |

### API Contract (tool)

```json
{
  "name": "google_sheets_create",
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "initialTab": { "type": "string" },
      "parentFolderId": { "type": "string" }
    },
    "required": ["title"]
  }
}
```

### Error Handling

- `parentFolderId` not found or inaccessible → Drive API returns 404 → executor
  returns `Error: ...`
- No other error handling needed — existing try/catch in executor is sufficient
