# connector/ — Agent Context

External service connector management. Handles OAuth-based account connections for third-party services (Google, Notion, Slack, GitHub). Each connector stores OAuth tokens and exposes tools for the agent loop.

## Responsibility

- `ConnectorService` — CRUD for connector accounts (type, config/tokens, enabled state)
- `GoogleOAuthService` — Google OAuth2 flow: auth URL generation, token exchange, token refresh with auto-persistence
- `GmailService` — Gmail API wrapper: search, read, send, draft, labels
- `GoogleCalendarService` — Calendar API wrapper: list, create, update, availability
- `GoogleDriveService` — Drive API wrapper: search, read, list, upload

## Files

```
connector/
├── connector.module.ts
├── connector.controller.ts       — REST + OAuth endpoints
├── connector.service.ts          — CRUD for Connector model
├── dto/
│   ├── upsert-connector.dto.ts   — @IsString, @IsOptional, @IsBoolean, @IsArray, @IsObject
│   ├── update-connector.dto.ts   — PartialType(UpsertConnectorDto)
│   └── oauth-confirm.dto.ts      — @IsString state, code
└── providers/
    └── google/
        ├── google-oauth.service.ts       — OAuth2 URL gen, token exchange, refresh
        ├── gmail.service.ts              — Gmail API (search/read/send/draft/labels)
        ├── google-calendar.service.ts    — Calendar API (list/create/update/availability)
        ├── google-drive.service.ts       — Drive API (search/read/list/upload)
        └── google-sheets.service.ts     — Sheets API v4: read/listTabs/update/append/create/addTab/format/chart + resolveSpreadsheetId
```

## API Endpoints

Base path: `/api/connectors`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/connectors` | List all connector accounts |
| `POST` | `/api/connectors` | Upsert connector by type |
| `PATCH` | `/api/connectors/:id` | Update connector |
| `DELETE` | `/api/connectors/:id` | Delete connector |
| `GET` | `/api/connectors/oauth/auth-url` | Get OAuth URL (query: type) |
| `POST` | `/api/connectors/oauth/confirm` | Confirm OAuth (body: state, code) |

## Tools Registered

| Tool Name | Executor | Service |
|---|---|---|
| `google_gmail_search` | `GoogleGmailSearchExecutor` | GmailService |
| `google_gmail_read` | `GoogleGmailReadExecutor` | GmailService |
| `google_gmail_send` | `GoogleGmailSendExecutor` | GmailService |
| `google_gmail_draft` | `GoogleGmailDraftExecutor` | GmailService |
| `google_gmail_labels` | `GoogleGmailLabelsExecutor` | GmailService |
| `google_calendar_list` | `GoogleCalendarListExecutor` | GoogleCalendarService |
| `google_calendar_create` | `GoogleCalendarCreateExecutor` | GoogleCalendarService |
| `google_calendar_update` | `GoogleCalendarUpdateExecutor` | GoogleCalendarService |
| `google_calendar_availability` | `GoogleCalendarAvailabilityExecutor` | GoogleCalendarService |
| `google_drive_search` | `GoogleDriveSearchExecutor` | GoogleDriveService |
| `google_drive_read` | `GoogleDriveReadExecutor` | GoogleDriveService |
| `google_drive_list` | `GoogleDriveListExecutor` | GoogleDriveService |
| `google_drive_upload` | `GoogleDriveUploadExecutor` | GoogleDriveService |
| `google_sheets_read` | `GoogleSheetsReadExecutor` | GoogleSheetsService |
| `google_sheets_list_tabs` | `GoogleSheetsListTabsExecutor` | GoogleSheetsService |
| `google_sheets_update` | `GoogleSheetsUpdateExecutor` | GoogleSheetsService |
| `google_sheets_append` | `GoogleSheetsAppendExecutor` | GoogleSheetsService |
| `google_sheets_create` | `GoogleSheetsCreateExecutor` | GoogleSheetsService |
| `google_sheets_add_tab` | `GoogleSheetsAddTabExecutor` | GoogleSheetsService |
| `google_sheets_format` | `GoogleSheetsFormatExecutor` | GoogleSheetsService |
| `google_sheets_chart` | `GoogleSheetsChartExecutor` | GoogleSheetsService |

## OAuth Scopes

- Mail: `https://mail.google.com/`
- Calendar: `https://www.googleapis.com/auth/calendar`
- Drive: `https://www.googleapis.com/auth/drive`
- Sheets: `https://www.googleapis.com/auth/spreadsheets`
- Sheets (Drive search): `https://www.googleapis.com/auth/drive.readonly`

## Data Model

```prisma
model Connector {
  id        String   @id @default(cuid())
  type      String                    // "google", "notion", "slack", "github"
  account   String?                   // JSON: { name, email, avatar }
  config    String   @default("{}")   // JSON: { clientId, clientSecret, redirectUri, tokens: {...} }
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Dependencies

- `googleapis` — Google API client library
- ConnectorModule imported by AgentModule and ToolsModule

## Testing

```bash
npx jest src/connector          # connector service + controller tests
npx jest src/tools/executors/google-*  # executor tests
```
