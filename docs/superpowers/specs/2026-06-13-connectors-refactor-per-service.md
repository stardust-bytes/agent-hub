# Connectors Refactor: Per-Service Approach

## Motivation

Current implementation uses 1 Google connector with 3 services (Gmail, Calendar, Drive) under 1 OAuth flow. User wants each service as an independent connector with its own OAuth flow and full scopes.

## Changes

### Data Model

Remove `services` field from `Connector` model. Each connector is now 1 service = 1 row:

| Connector type | Scope | Tools |
|---|---|---|
| `google_gmail` | `https://mail.google.com/` | google_gmail_search/read/send/draft/labels |
| `google_calendar` | `https://www.googleapis.com/auth/calendar` | google_calendar_list/create/update/availability |
| `google_drive` | `https://www.googleapis.com/auth/drive` | google_drive_search/read/list/upload |

### OAuth Flow

Generic endpoint, lookup scope by `type`:

```
GET /api/connectors/oauth/auth-url?type=google_gmail&clientId=...&clientSecret=...&redirectUri=...
GET /api/connectors/oauth/callback?type=google_gmail&code=...
```

### Backend Modifications

- `GoogleOAuthService`: accept `type` param, map to scope dynamically
- `ConnectorController`: replace `google/auth-url` + `google/callback` with `oauth/auth-url` + `oauth/callback`
- `GmailService`: `findByType('google_gmail')` instead of `findByType('google')`
- `GoogleCalendarService`: `findByType('google_calendar')`
- `GoogleDriveService`: `findByType('google_drive')`
- `Connector` Prisma model: remove `services` field (deprecated), add new migration

### Frontend

3 separate connector rows. No sub-service expansion.

### Files to Modify

- `backend/prisma/schema.prisma` — remove `services` field
- `backend/src/connector/providers/google/google-oauth.service.ts` — accept type param, dynamic scope
- `backend/src/connector/connector.service.ts` — remove services logic
- `backend/src/connector/dto/upsert-connector.dto.ts` — remove services field
- `backend/src/connector/connector.controller.ts` — generic OAuth endpoints
- `backend/src/connector/providers/google/gmail.service.ts` — findByType('google_gmail')
- `backend/src/connector/providers/google/google-calendar.service.ts` — findByType('google_calendar')
- `backend/src/connector/providers/google/google-drive.service.ts` — findByType('google_drive')
- `backend/src/connector/connector.module.ts` — minor update
- `frontend/src/components/ConnectorsView.vue` — 3 separate rows
- `backend/prisma/seed.ts` — update tool names (already done)

## Migration

Safe: `services` column removed (never used in production). Existing single "google" connector (if any) becomes stale — user reconnects per service.
