# Connectors — Google OAuth Integration Design

## Overview

Replace the old manual-config connectors with OAuth-based account connection, modeled after Claude Cowork's connector system. Users log in via OAuth (no API keys), approve scopes, and the agent gets access to the service's tools automatically.

## Scope

**Phase 1: Google** — Gmail, Google Calendar, Google Drive. Additional connectors (Notion, Slack, GitHub) deferred to future phases.

## Tool Naming Convention

- `google_gmail_*` — Gmail operations
- `google_calendar_*` — Calendar operations
- `google_drive_*` — Drive operations

Class naming: `GmailService`, `GoogleCalendarService`, `GoogleDriveService`.

## Data Model

Expand the existing `Connector` Prisma model:

```prisma
model Connector {
  id        String   @id @default(cuid())
  type      String   // "google", "notion", "slack", "github"
  services  String   // JSON: ["google_gmail", "google_calendar", "google_drive"]
  account   String?  // JSON: { email, name, avatar }
  config    String   // JSON: { tokens: { access_token, refresh_token, expiry_date }, scopes: [...] }
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Each third-party account = one `Connector` row. `services` lists which sub-services are active. `config` stores OAuth tokens. `account` stores display info (email, name).

## OAuth Flow

1. User clicks Connect on ConnectorsView
2. Backend generates OAuth URL with scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/drive.readonly`
3. Browser popup opens Google consent screen
4. User approves, Google redirects to callback with `code`
5. Backend exchanges `code` for tokens, saves to `Connector.config`, sets `enabled: true`
6. Frontend refreshes — connector shows Connected

## Backend Architecture

```
backend/src/connector/
├── connector.module.ts
├── connector.controller.ts
├── connector.service.ts
├── providers/
│   └── google/
│       ├── google-oauth.service.ts     — OAuth URL generation, token exchange, token refresh
│       ├── gmail.service.ts            — Gmail API calls (search, read, send, draft, labels)
│       ├── google-calendar.service.ts   — Calendar API calls (list, create, update, availability)
│       └── google-drive.service.ts     — Drive API calls (search, read, list, upload)
```

### Executors (per tool)

Each tool has an executor under `backend/src/tools/executors/`:
- `google-gmail-search.executor.ts`
- `google-gmail-read.executor.ts`
- `google-gmail-send.executor.ts`
- `google-gmail-draft.executor.ts`
- `google-gmail-labels.executor.ts`
- `google-calendar-list.executor.ts`
- `google-calendar-create.executor.ts`
- `google-calendar-update.executor.ts`
- `google-calendar-availability.executor.ts`
- `google-drive-search.executor.ts`
- `google-drive-read.executor.ts`
- `google-drive-list.executor.ts`
- `google-drive-upload.executor.ts`

Each executor checks if the Google connector is enabled before executing. If not, returns an error.

### Dependency Injection

Executors are injected into `AgentLoopService` and registered in `executorMap`:

```ts
executorMap.set('google_gmail_search', googleGmailSearchExecutor)
executorMap.set('google_gmail_read', googleGmailReadExecutor)
// ... etc
```

### Tool Definitions (seed.ts)

All tools added to `DEFAULT_TOOLS` with `enabled: false`. Enabled dynamically when user connects the Google connector.

## Frontend UI

ConnectorsView layout:

```
Header: "Connectors"

Google ───────────────────── ● Connected [Disconnect]
  ├─ Gmail ──── 5 tools     ● Active
  ├─ Calendar ─ 4 tools     ● Active
  └─ Drive ──── 4 tools     ● Active

Notion ───────────────────── ○ Disconnected [Connect]
Slack ────────────────────── ○ Disconnected [Connect]
GitHub ───────────────────── ○ Disconnected [Connect]
```

- 1 row per connector type
- Clicking Connect opens OAuth popup
- Connected connectors show sub-services with tool counts
- Disconnect removes OAuth tokens and disables all tools

## Files to Create

### Backend
- `backend/src/connector/providers/google/google-oauth.service.ts`
- `backend/src/connector/providers/google/gmail.service.ts`
- `backend/src/connector/providers/google/google-calendar.service.ts`
- `backend/src/connector/providers/google/google-drive.service.ts`
- `backend/src/connector/connector.module.ts` (update — add providers)
- `backend/src/connector/connector.controller.ts` (update — add OAuth endpoints)
- `backend/src/connector/connector.service.ts` (update — add findByType, account management)
- `backend/src/tools/executors/google-gmail-search.executor.ts`
- `backend/src/tools/executors/google-gmail-read.executor.ts`
- `backend/src/tools/executors/google-gmail-send.executor.ts`
- `backend/src/tools/executors/google-gmail-draft.executor.ts`
- `backend/src/tools/executors/google-gmail-labels.executor.ts`
- `backend/src/tools/executors/google-calendar-list.executor.ts`
- `backend/src/tools/executors/google-calendar-create.executor.ts`
- `backend/src/tools/executors/google-calendar-update.executor.ts`
- `backend/src/tools/executors/google-calendar-availability.executor.ts`
- `backend/src/tools/executors/google-drive-search.executor.ts`
- `backend/src/tools/executors/google-drive-read.executor.ts`
- `backend/src/tools/executors/google-drive-list.executor.ts`
- `backend/src/tools/executors/google-drive-upload.executor.ts`

### Frontend
- `frontend/src/components/ConnectorsView.vue` (rewrite)

### Prisma
- `backend/prisma/schema.prisma` (update Connector model with services, account fields)
- Migration file `YYYYMMDDHHMMSS_add_connector_services`

## Files to Delete

- `backend/src/oauth/` (old OAuth logic — replaced by connector/providers/google/google-oauth.service.ts. Remove oauth.module.ts from app.module.ts)

## Prisma Migration

Safe migration: add `services` (String, default '[]') and `account` (String?, optional) columns to Connector table. Both nullable — no data loss risk.

## Permission Model

No per-tool permission system (Always Allow / Needs Approval / Blocked). Connector tools follow a simple on/off model:
- Connector enabled → all its tools available
- Connector disabled → all its tools return error

## Dependencies

- `googleapis` (already installed via old email/calendar modules)
- `google-auth-library` (already a dependency of googleapis)

## Testing

- Google OAuth service: unit tests with mocked axios/fetch
- Each executor: unit tests with mocked service
- ConnectorService: test CRUD + OAuth flow
