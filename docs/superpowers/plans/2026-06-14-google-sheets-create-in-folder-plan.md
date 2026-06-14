# Google Sheets Create in Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `google_sheets_create` to create spreadsheets inside a specific Drive folder via optional `parentFolderId`.

**Architecture:** Modify `GoogleSheetsService.create()` to accept optional `parentFolderId`. When provided, use `drive.files.create` with `mimeType: 'application/vnd.google-apps.spreadsheet'` and `parents: [parentFolderId]` instead of `sheets.spreadsheets.create`. If `initialTab` is also provided, rename the default sheet via `sheets.spreadsheets.batchUpdate`.

**Tech Stack:** NestJS, googleapis (Drive v3 + Sheets v4), Jest

---

### Task 1: Service tests for parentFolderId

**Files:**
- Modify: `backend/src/connector/providers/google/google-sheets.service.spec.ts`

- [ ] **Step 1: Add `create` to mockDriveClient and write failing tests**

Add `create` to the Drive mock, then add three new test cases inside the `create` describe block:

```ts
const mockDriveClient = {
  files: { list: jest.fn(), create: jest.fn() },
};
```

Append to the `create` describe block (after line 145):

```ts
it('creates in folder when parentFolderId is provided', async () => {
  oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
  mockDriveClient.files.create.mockResolvedValue({
    data: { id: 'newId123456789012345', name: 'My Sheet' },
  });
  const result = await service.create('My Sheet', undefined, 'folderId123');
  expect(mockDriveClient.files.create).toHaveBeenCalledWith({
    requestBody: { name: 'My Sheet', mimeType: 'application/vnd.google-apps.spreadsheet', parents: ['folderId123'] },
    fields: 'id,name',
  });
  expect(result).toBe('Created spreadsheet: My Sheet (id: newId123456789012345)');
});

it('creates in folder and renames initial tab', async () => {
  oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
  mockDriveClient.files.create.mockResolvedValue({
    data: { id: 'newId123456789012345', name: 'My Sheet' },
  });
  mockSheetsClient.spreadsheets.get.mockResolvedValue({
    data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
  });
  mockSheetsClient.spreadsheets.batchUpdate.mockResolvedValue({});
  const result = await service.create('My Sheet', 'Data', 'folderId123');
  expect(mockDriveClient.files.create).toHaveBeenCalled();
  expect(mockSheetsClient.spreadsheets.batchUpdate).toHaveBeenCalledWith({
    spreadsheetId: 'newId123456789012345',
    requestBody: {
      requests: [{ updateSheetProperties: { properties: { sheetId: 0, title: 'Data' }, fields: 'title' } }],
    },
  });
  expect(result).toBe('Created spreadsheet: My Sheet (id: newId123456789012345)');
});

it('still works without parentFolderId using sheets API', async () => {
  oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
  mockSheetsClient.spreadsheets.create.mockResolvedValue({
    data: { spreadsheetId: 'sheetsId123456789012345', properties: { title: 'Legacy' } },
  });
  const result = await service.create('Legacy');
  expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalled();
  expect(result).toBe('Created spreadsheet: Legacy (id: sheetsId123456789012345)');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/connector/providers/google/google-sheets.service.spec.ts --verbose`
Expected: 2 existing tests pass, 3 new tests fail because `create()` doesn't accept `parentFolderId` yet

- [ ] **Step 3: Implement the service change**

In `google-sheets.service.ts`, replace the `create` method:

```ts
async create(title: string, initialTab?: string, parentFolderId?: string): Promise<string> {
  if (parentFolderId) {
    const drive = await this.getDrive();
    const res = await drive.files.create({
      requestBody: { name: title, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [parentFolderId] },
      fields: 'id,name',
    });
    const spreadsheetId = res.data.id!;
    if (initialTab) {
      const sheets = await this.getSheets();
      const sheetRes = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetId = sheetRes.data.sheets?.[0]?.properties?.sheetId ?? 0;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ updateSheetProperties: { properties: { sheetId, title: initialTab }, fields: 'title' } }],
        },
      });
    }
    return `Created spreadsheet: ${res.data.name!} (id: ${spreadsheetId})`;
  }
  const sheets = await this.getSheets();
  const requestBody: Record<string, unknown> = { properties: { title } };
  if (initialTab) requestBody.sheets = [{ properties: { title: initialTab } }];
  const res = await sheets.spreadsheets.create({ requestBody });
  return `Created spreadsheet: ${res.data.properties!.title} (id: ${res.data.spreadsheetId})`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/connector/providers/google/google-sheets.service.spec.ts --verbose`
Expected: All 7 tests pass (2 existing + 3 new + 2 existing from other describe blocks)

- [ ] **Step 5: Commit**

```bash
git add backend/src/connector/providers/google/google-sheets.service.ts backend/src/connector/providers/google/google-sheets.service.spec.ts
git commit -m "feat: add parentFolderId support to GoogleSheetsService.create"
```

---

### Task 2: Executor tests and implementation

**Files:**
- Modify: `backend/src/tools/executors/google-sheets-create.executor.ts`
- Modify: `backend/src/tools/executors/google-sheets-create.executor.spec.ts`

- [ ] **Step 1: Add test for parentFolderId in executor spec**

Add to `google-sheets-create.executor.spec.ts` inside the describe block:

```ts
it('passes parentFolderId to service', async () => {
  service.create.mockResolvedValue('Created spreadsheet: Report (id: newId123456789012345)');
  const result = await executor.execute({ title: 'Report', initialTab: 'Data', parentFolderId: 'folder123' });
  expect(service.create).toHaveBeenCalledWith('Report', 'Data', 'folder123');
  expect(result).toBe('Created spreadsheet: Report (id: newId123456789012345)');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/tools/executors/google-sheets-create.executor.spec.ts --verbose`
Expected: 3 existing pass, 1 new fails (executor doesn't forward parentFolderId)

- [ ] **Step 3: Add parentFolderId param to executor**

In `google-sheets-create.executor.ts`:

```ts
readonly parameters = {
  type: 'object' as const,
  properties: {
    title: { type: 'string', description: 'Spreadsheet title' },
    initialTab: { type: 'string', description: 'Name for the first tab (optional, defaults to "Sheet1")' },
    parentFolderId: { type: 'string', description: 'Drive folder ID to create the spreadsheet in (optional, defaults to root)' },
  },
  required: ['title'] as string[],
};

async execute(args: Record<string, unknown>): Promise<string> {
  try {
    return await this.sheets.create(
      args.title as string,
      args.initialTab as string | undefined,
      args.parentFolderId as string | undefined,
    );
  } catch (e: unknown) {
    return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/tools/executors/google-sheets-create.executor.spec.ts --verbose`
Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/google-sheets-create.executor.ts backend/src/tools/executors/google-sheets-create.executor.spec.ts
git commit -m "feat: add parentFolderId param to google_sheets_create tool"
```

---

### Task 3: Update seed data

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Update google_sheets_create tool definition in seed**

Replace line 56:

```ts
{ name: 'google_sheets_create', description: 'Create a new Google Sheets spreadsheet. Parameters: title (required), initialTab (optional name for the first tab), parentFolderId (optional Drive folder ID).', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Spreadsheet title"},"initialTab":{"type":"string","description":"Name for the first tab (optional)"},"parentFolderId":{"type":"string","description":"Drive folder ID to create in (optional)"}},"required":["title"]}', enabled: false },
```

- [ ] **Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: update seed data for google_sheets_create parentFolderId"
```
