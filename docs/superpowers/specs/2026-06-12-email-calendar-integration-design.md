# Email & Calendar Integration — Design Spec

## Goal

Integrate Email (Gmail + IMAP/SMTP) and Google Calendar as agent tools so office workers can manage emails and calendar directly through chat.

## Scope

- Backend: EmailModule (4 executors: list, read, send, search, reply) + CalendarModule (4 executors: list events, create event, update event, check availability)
- Frontend: OAuth2 config UI in Settings → Providers (Google Client ID/Secret)
- Agent tools: 9 new tools exposed to the AI

## Architecture

### EmailModule

```
email/
├── email.module.ts
├── email.service.ts
├── providers/
│   ├── email-provider.interface.ts
│   ├── gmail.provider.ts
│   └── imap.provider.ts
├── executors/
│   ├── email-list.executor.ts
│   ├── email-read.executor.ts
│   ├── email-send.executor.ts
│   ├── email-search.executor.ts
│   └── email-reply.executor.ts
├── dto/
│   └── email-config.dto.ts
└── *.spec.ts
```

### CalendarModule

```
calendar/
├── calendar.module.ts
├── calendar.service.ts
├── providers/
│   ├── calendar-provider.interface.ts
│   └── google-calendar.provider.ts
├── executors/
│   ├── calendar-list-events.executor.ts
│   ├── calendar-create-event.executor.ts
│   ├── calendar-update-event.executor.ts
│   └── calendar-check-availability.executor.ts
├── dto/
│   └── calendar-config.dto.ts
└── *.spec.ts
```

### Settings — OAuth2 Config

- New section in Settings → Providers: "Google OAuth"
- Fields: Client ID, Client Secret, Redirect URI (auto-generated)
- Backend stores tokens in `Setting` table (key: `google.oauth.tokens`)

## Agent Tools

### Email Tool Definitions

| Tool name | Description | Parameters |
|---|---|---|
| `email_list` | List emails from inbox. Supports pagination and folder selection. | `{ folder, limit, offset }` |
| `email_read` | Read full content of a specific email by ID. Returns body, sender, date, attachments. | `{ id }` |
| `email_send` | Send an email. Supports To, CC, BCC, body (text/HTML), and file attachments. | `{ to, subject, body, cc?, bcc?, attachments? }` |
| `email_search` | Search emails by keyword, sender, date range. | `{ query, folder?, since?, until? }` |
| `email_reply` | Reply to or forward an existing email. | `{ id, body, mode? ("reply"\|"reply_all"\|"forward") }` |

### Calendar Tool Definitions

| Tool name | Description | Parameters |
|---|---|---|
| `calendar_list_events` | List calendar events within a date range. | `{ since?, until?, calendar? }` |
| `calendar_create_event` | Create a new calendar event with attendees. | `{ title, startTime, endTime, description?, attendees?, location? }` |
| `calendar_update_event` | Update or delete an existing event. | `{ id, title?, startTime?, endTime?, action? ("update"\|"delete") }` |
| `calendar_check_availability` | Check if a time slot is available. | `{ startTime, endTime, attendees? }` |

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `googleapis` | latest | Gmail + Calendar API |
| `nodemailer` | latest | SMTP email sending (IMAP mode) |
| `imap` | latest | IMAP email reading (generic email) |
| `mailparser` | latest | Parse email content |

## Data Flow

### Email — Gmail (OAuth2)
1. User configures Google Client ID/Secret in Settings
2. Backend initiates OAuth2 flow → user authorizes → tokens stored in DB
3. Agent calls `email_send` → `GmailProvider.send()` → Gmail API
4. Agent calls `email_list` → `GmailProvider.list()` → Gmail API

### Email — IMAP/SMTP
1. User configures IMAP/SMTP server in Settings (host, port, username, password)
2. Agent calls `email_send` → `ImapProvider.send()` → nodemailer via SMTP
3. Agent calls `email_list` → `ImapProvider.list()` → IMAP connection

### Calendar
1. Same OAuth2 flow as Gmail
2. Agent calls `calendar_create_event` → Google Calendar API
3. Response includes event ID, link for user to view

## Security

- OAuth2 tokens encrypted at rest in `Setting` table
- IMAP credentials stored encrypted
- Token refresh handled automatically by `googleapis`
- No email content logged to console

## Implementation Order

1. Dependencies: `googleapis`, `nodemailer`, `imap`, `mailparser`
2. EmailService + providers (Gmail, IMAP)
3. Email executors (list, read, send, search, reply)
4. CalendarService + GoogleCalendarProvider
5. Calendar executors (list events, create event, update event, check availability)
6. Settings UI: OAuth2 config + IMAP config
7. Seed.ts: add tool definitions
8. Register in AgentLoopService + app.module
