# connector/ — Agent Context

External service connector management. Handles OAuth-based account connections for third-party services (Google, Notion, Slack, GitHub). Each connector stores OAuth tokens and exposes tools for the agent loop.

## Responsibility

- `ConnectorService` — CRUD for connector accounts (type, config/tokens, enabled state)
- `GoogleOAuthService` — Google OAuth2 flow: auth URL generation, token exchange, token refresh with auto-persistence
- `GmailService` — Gmail API wrapper: search, read, send, draft, labels
- `GoogleCalendarService` — Calendar API wrapper: list, create, update, availability
- `GoogleDriveService` — Drive API wrapper: search, read, list, upload
- `GoogleSheetsService` — Sheets API v4: read/listTabs/update/append/create/addTab/format/chart + resolveSpreadsheetId
- `GitHubService` — GitHub REST API wrapper via Octokit: repo search, issue CRUD, PR listing, commit history
- `SlackService` — Slack Web API wrapper: send message, list channels, conversation history, message search
- `NotionService` — Notion SDK wrapper: search pages/databases, get page content, create/update pages, query databases

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
    ├── google/
    │   ├── google-oauth.service.ts       — OAuth2 URL gen, token exchange, refresh
    │   ├── gmail.service.ts              — Gmail API (search/read/send/draft/labels)
    │   ├── google-calendar.service.ts    — Calendar API (list/create/update/availability)
    │   ├── google-drive.service.ts       — Drive API (search/read/list/upload)
    │   └── google-sheets.service.ts     — Sheets API v4: read/listTabs/update/append/create/addTab/format/chart + resolveSpreadsheetId
    ├── github/
    │   └── github.service.ts            — GitHub REST API via Octokit (search repos, issue CRUD, PR listing, commits)
    ├── slack/
    │   └── slack.service.ts             — Slack Web API (send message, list channels, history, search)
    └── notion/
        └── notion.service.ts            — Notion SDK (search, get page, create/update page, query database)
```

## API Endpoints

Base path: `/api/connectors`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/connectors` | List all connector accounts |
| `POST` | `/api/connectors` | Upsert connector by type (saves config including clientId/clientSecret or token) |
| `PATCH` | `/api/connectors/:id` | Update connector |
| `DELETE` | `/api/connectors/:id` | Delete connector |
| `GET` | `/api/connectors/oauth/auth-url` | Get OAuth URL (query: type) — reads clientId/clientSecret from DB or env |
| `POST` | `/api/connectors/oauth/confirm` | Confirm OAuth (body: state, code) — exchanges code for tokens and updates connector |
| `GET` | `/api/connectors/google-types` | List Google OAuth connector type slugs |

## Auth Method

- Google services: OAuth 2.0 (client ID + secret, redirect URI, token exchange). Credentials can be entered via the UI (stored in DB) or set via environment variables (`GOOGLE_*_CLIENT_ID`/`GOOGLE_*_CLIENT_SECRET`) as fallback.
- GitHub: Personal Access Token (stored in connector config as `{ token }`)
- Slack: Bot Token (stored in connector config as `{ token }`)
- Notion: Internal Integration Token (stored in connector config as `{ token }`)

## Tools Registered (Google)

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
| `google_drive_create_folder` | `GoogleDriveCreateFolderExecutor` | GoogleDriveService |
| `google_sheets_read` | `GoogleSheetsReadExecutor` | GoogleSheetsService |
| `google_sheets_list_tabs` | `GoogleSheetsListTabsExecutor` | GoogleSheetsService |
| `google_sheets_update` | `GoogleSheetsUpdateExecutor` | GoogleSheetsService |
| `google_sheets_append` | `GoogleSheetsAppendExecutor` | GoogleSheetsService |
| `google_sheets_create` | `GoogleSheetsCreateExecutor` | GoogleSheetsService |
| `google_sheets_add_tab` | `GoogleSheetsAddTabExecutor` | GoogleSheetsService |
| `google_sheets_format` | `GoogleSheetsFormatExecutor` | GoogleSheetsService |
| `google_sheets_chart` | `GoogleSheetsChartExecutor` | GoogleSheetsService |

## Tools Registered (GitHub)

| Tool Name | Executor | Service |
|---|---|---|
| `github_search_repos` | `GitHubSearchReposExecutor` | GitHubService |
| `github_get_repo` | `GitHubGetRepoExecutor` | GitHubService |
| `github_search_issues` | `GitHubSearchIssuesExecutor` | GitHubService |
| `github_list_issues` | `GitHubListIssuesExecutor` | GitHubService |
| `github_create_issue` | `GitHubCreateIssueExecutor` | GitHubService |
| `github_get_issue` | `GitHubGetIssueExecutor` | GitHubService |
| `github_list_pull_requests` | `GitHubListPullRequestsExecutor` | GitHubService |
| `github_get_pull_request` | `GitHubGetPullRequestExecutor` | GitHubService |
| `github_list_commits` | `GitHubListCommitsExecutor` | GitHubService |

## Tools Registered (Slack)

| Tool Name | Executor | Service |
|---|---|---|
| `slack_send_message` | `SlackSendMessageExecutor` | SlackService |
| `slack_list_channels` | `SlackListChannelsExecutor` | SlackService |
| `slack_get_history` | `SlackGetHistoryExecutor` | SlackService |
| `slack_search` | `SlackSearchExecutor` | SlackService |

## Tools Registered (Notion)

| Tool Name | Executor | Service |
|---|---|---|
| `notion_search` | `NotionSearchExecutor` | NotionService |
| `notion_get_page` | `NotionGetPageExecutor` | NotionService |
| `notion_create_page` | `NotionCreatePageExecutor` | NotionService |
| `notion_update_page` | `NotionUpdatePageExecutor` | NotionService |
| `notion_query_database` | `NotionQueryDatabaseExecutor` | NotionService |

## Dependencies

- `googleapis` — Google API client library
- `@octokit/rest` — GitHub REST API client
- `@slack/web-api` — Slack Web API client
- `@notionhq/client` — Notion SDK client
- ConnectorModule imported by AgentModule and ToolsModule

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

## Testing

```bash
npx jest src/connector          # connector service + controller tests
npx jest src/tools/executors/google-*  # executor tests
```

## Testing

```bash
npx jest src/connector          # connector service + controller tests
npx jest src/tools/executors/google-*  # executor tests
```
