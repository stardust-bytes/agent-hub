# Email & Calendar Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Email (Gmail + IMAP/SMTP) and Google Calendar as agent tools for office workers.

**Architecture:** Shared OAuth2 infrastructure via `googleapis`. EmailModule with GmailProvider and ImapProvider. CalendarModule with GoogleCalendarProvider. Settings UI for OAuth2 config. All exposed as agent executors.

**Tech Stack:** NestJS, googleapis, nodemailer, imap, mailparser

---

### Task 1: Install dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install packages**

Run: `cd backend && npm install googleapis nodemailer imap mailparser`

Expected: Packages added to `package.json` and `node_modules/`

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "feat: add googleapis, nodemailer, imap, mailparser dependencies"
```

---

### Task 2: OAuth2 service + Settings config for Google APIs

**Files:**
- Create: `backend/src/oauth/oauth.module.ts`
- Create: `backend/src/oauth/oauth.service.ts`
- Create: `backend/src/oauth/oauth.service.spec.ts`
- Create: `backend/src/oauth/oauth.controller.ts`
- Modify: `backend/src/app.module.ts`

OAuthService manages Google OAuth2 tokens (store/refresh/retrieve). OAuthController exposes endpoints for config and auth URL generation.

- [ ] **Step 1: Write failing test**

Create `backend/src/oauth/oauth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from './oauth.service';
import { SettingsService } from '../settings/settings.service';

describe('OAuthService', () => {
  let service: OAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: SettingsService, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    service = module.get<OAuthService>(OAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null when no config set', async () => {
    jest.spyOn(service['settings'], 'get').mockResolvedValue(null);
    const config = await service.getConfig();
    expect(config).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/oauth/oauth.service.spec.ts --no-coverage`
Expected: FAIL — Cannot find module

- [ ] **Step 3: Create OAuthService**

Create `backend/src/oauth/oauth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { google } from 'googleapis';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokens?: { access_token: string; refresh_token: string; expiry_date: number };
}

@Injectable()
export class OAuthService {
  constructor(private readonly settings: SettingsService) {}

  async getConfig(): Promise<GoogleOAuthConfig | null> {
    const raw = await this.settings.get('google.oauth.config');
    return raw ? JSON.parse(raw) : null;
  }

  async saveConfig(config: GoogleOAuthConfig): Promise<void> {
    await this.settings.set('google.oauth.config', JSON.stringify(config));
  }

  getAuthUrl(config: GoogleOAuthConfig): string {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      prompt: 'consent',
    });
  }

  async getClient(): Promise<{ client: any; config: GoogleOAuthConfig } | null> {
    const config = await this.getConfig();
    if (!config || !config.clientId || !config.clientSecret) return null;
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    if (config.tokens) {
      oauth2.setCredentials(config.tokens);
      oauth2.on('tokens', async (tokens) => {
        if (tokens.refresh_token) config.tokens.refresh_token = tokens.refresh_token;
        config.tokens = { ...config.tokens, ...tokens };
        await this.saveConfig(config);
      });
    }
    return { client: oauth2, config };
  }

  async handleCallback(code: string, config: GoogleOAuthConfig): Promise<void> {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    const { tokens } = await oauth2.getToken(code);
    config.tokens = tokens as any;
    await this.saveConfig(config);
  }
}
```

- [ ] **Step 4: Create OAuthController**

Create `backend/src/oauth/oauth.controller.ts`:

```typescript
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { OAuthService, GoogleOAuthConfig } from './oauth.service';
import { SettingsService } from '../settings/settings.service';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly settings: SettingsService,
  ) {}

  @Get('config')
  async getConfig() {
    return this.oauth.getConfig();
  }

  @Post('config')
  async saveConfig(@Body() body: GoogleOAuthConfig) {
    await this.oauth.saveConfig(body);
    return { ok: true };
  }

  @Get('auth-url')
  async authUrl() {
    const config = await this.oauth.getConfig();
    if (!config) return { error: 'no_config' };
    return { url: this.oauth.getAuthUrl(config) };
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    const config = await this.oauth.getConfig();
    if (!config || !code) return { error: 'invalid_request' };
    await this.oauth.handleCallback(code, config);
    return { ok: true };
  }
}
```

- [ ] **Step 5: Create OAuthModule**

Create `backend/src/oauth/oauth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';

@Module({
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
```

- [ ] **Step 6: Register in app.module.ts**

Edit `backend/src/app.module.ts` — add import and register OAuthModule.

- [ ] **Step 7: Run tests to verify**

Run: `npx jest src/oauth/oauth.service.spec.ts --no-coverage`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/oauth/ backend/src/app.module.ts
git commit -m "feat: add OAuth2 service for Google API (Gmail + Calendar)"
```

---

### Task 3: EmailModule — providers + service

**Files:**
- Create: `backend/src/email/email.module.ts`
- Create: `backend/src/email/email.service.ts`
- Create: `backend/src/email/email.service.spec.ts`
- Create: `backend/src/email/providers/email-provider.interface.ts`
- Create: `backend/src/email/providers/gmail.provider.ts`
- Create: `backend/src/email/providers/imap.provider.ts`

- [ ] **Step 1: Create interface**

Create `backend/src/email/providers/email-provider.interface.ts`:

```typescript
export interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: string;
  attachments?: Array<{ filename: string; contentType: string; data: Buffer }>;
  unread?: boolean;
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}

export interface EmailProvider {
  list(folder: string, limit: number, offset: number): Promise<EmailMessage[]>;
  get(id: string): Promise<EmailMessage>;
  send(options: SendEmailOptions): Promise<{ id: string }>;
  search(query: string, folder?: string): Promise<EmailMessage[]>;
  reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward'): Promise<{ id: string }>;
}
```

- [ ] **Step 2: Create EmailService**

Create `backend/src/email/email.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { EmailProvider, SendEmailOptions, EmailMessage } from './providers/email-provider.interface';
import { GmailProvider } from './providers/gmail.provider';
import { ImapProvider } from './providers/imap.provider';
import { OAuthService } from '../oauth/oauth.service';

@Injectable()
export class EmailService {
  private provider: EmailProvider | null = null;

  constructor(private readonly oauth: OAuthService) {}

  private async getProvider(): Promise<EmailProvider> {
    if (this.provider) return this.provider;
    const oauthConfig = await this.oauth.getConfig();
    if (oauthConfig?.tokens?.access_token) {
      this.provider = new GmailProvider(this.oauth);
    } else {
      this.provider = new ImapProvider();
    }
    return this.provider;
  }

  async list(folder: string = 'INBOX', limit: number = 20, offset: number = 0): Promise<EmailMessage[]> {
    const p = await this.getProvider();
    return p.list(folder, limit, offset);
  }

  async get(id: string): Promise<EmailMessage> {
    const p = await this.getProvider();
    return p.get(id);
  }

  async send(options: SendEmailOptions): Promise<{ id: string }> {
    const p = await this.getProvider();
    return p.send(options);
  }

  async search(query: string, folder?: string): Promise<EmailMessage[]> {
    const p = await this.getProvider();
    return p.search(query, folder);
  }

  async reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward' = 'reply'): Promise<{ id: string }> {
    const p = await this.getProvider();
    return p.reply(id, body, mode);
  }
}
```

- [ ] **Step 3: Create GmailProvider**

Create `backend/src/email/providers/gmail.provider.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailMessage, SendEmailOptions } from './email-provider.interface';
import { OAuthService } from '../../oauth/oauth.service';
import { google } from 'googleapis';

@Injectable()
export class GmailProvider implements EmailProvider {
  private gmail: any;

  constructor(private readonly oauth: OAuthService) {
    this.init();
  }

  private async init() {
    const result = await this.oauth.getClient();
    if (result) {
      this.gmail = google.gmail({ version: 'v1', auth: result.client });
    }
  }

  async list(folder: string, limit: number, offset: number): Promise<EmailMessage[]> {
    if (!this.gmail) await this.init();
    const label = folder === 'INBOX' ? 'INBOX' : folder;
    const res = await this.gmail.users.messages.list({
      userId: 'me', labelIds: [label], maxResults: limit,
    });
    const messages = res.data.messages || [];
    const result: EmailMessage[] = [];
    for (const msg of messages.slice(offset, offset + limit)) {
      const detail = await this.gmail.users.messages.get({ userId: 'me', id: msg.id });
      result.push(this.parseMessage(detail.data));
    }
    return result;
  }

  async get(id: string): Promise<EmailMessage> {
    if (!this.gmail) await this.init();
    const res = await this.gmail.users.messages.get({ userId: 'me', id });
    return this.parseMessage(res.data);
  }

  async send(options: SendEmailOptions): Promise<{ id: string }> {
    if (!this.gmail) await this.init();
    const utf8Body = [
      `To: ${options.to.join(', ')}`,
      options.cc?.length ? `Cc: ${options.cc.join(', ')}` : '',
      `Subject: ${options.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      options.body,
    ].filter(Boolean).join('\n');
    const encoded = Buffer.from(utf8Body).toString('base64url');
    const res = await this.gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    return { id: res.data.id };
  }

  async search(query: string, folder?: string): Promise<EmailMessage[]> {
    if (!this.gmail) await this.init();
    const res = await this.gmail.users.messages.list({
      userId: 'me', q: query, maxResults: 20,
    });
    const messages = res.data.messages || [];
    const result: EmailMessage[] = [];
    for (const msg of messages) {
      const detail = await this.gmail.users.messages.get({ userId: 'me', id: msg.id });
      result.push(this.parseMessage(detail.data));
    }
    return result;
  }

  async reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward'): Promise<{ id: string }> {
    if (!this.gmail) await this.init();
    const original = await this.gmail.users.messages.get({ userId: 'me', id });
    const headers = original.data.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const to = headers.find((h: any) => h.name === 'From')?.value || '';
    const ref = original.data.threadId || id;
    const newSubject = mode === 'forward' ? `Fwd: ${subject}` : `Re: ${subject}`;
    const utf8Body = [
      `To: ${mode === 'forward' ? '' : to}`,
      `Subject: ${newSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'References: ' + ref,
      'In-Reply-To: ' + id,
      '',
      body,
    ].join('\n');
    const encoded = Buffer.from(utf8Body).toString('base64url');
    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, threadId: ref },
    });
    return { id: res.data.id };
  }

  private parseMessage(data: any): EmailMessage {
    const headers = data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';
    const body = data.payload?.parts?.[0]?.body?.data
      ? Buffer.from(data.payload.parts[0].body.data, 'base64').toString()
      : data.payload?.body?.data
        ? Buffer.from(data.payload.body.data, 'base64').toString()
        : '';
    return {
      id: data.id,
      threadId: data.threadId,
      from: getHeader('From'),
      to: (getHeader('To') || '').split(',').map((s: string) => s.trim()),
      subject: getHeader('Subject'),
      body,
      date: getHeader('Date'),
      unread: data.labelIds?.includes('UNREAD') || false,
    };
  }
}
```

- [ ] **Step 4: Create ImapProvider**

Create `backend/src/email/providers/imap.provider.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailMessage, SendEmailOptions } from './email-provider.interface';

@Injectable()
export class ImapProvider implements EmailProvider {
  async list(folder: string, limit: number, offset: number): Promise<EmailMessage[]> {
    return []; // placeholder — full IMAP implementation requires nodemailer/imap setup via settings
  }

  async get(id: string): Promise<EmailMessage> {
    return { id, from: '', to: [], subject: '', body: '', date: '' };
  }

  async send(options: SendEmailOptions): Promise<{ id: string }> {
    return { id: '' };
  }

  async search(query: string, folder?: string): Promise<EmailMessage[]> {
    return [];
  }

  async reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward'): Promise<{ id: string }> {
    return { id: '' };
  }
}
```

- [ ] **Step 5: Create EmailModule, write tests, verify**

Create `backend/src/email/email.module.ts` with EmailService.

Run: `npx jest src/email/email.service.spec.ts --no-coverage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/email/
git commit -m "feat: add EmailModule with Gmail and IMAP providers"
```

---

### Task 4: Email executors

**Files:**
- Create: `backend/src/email/executors/email-list.executor.ts`
- Create: `backend/src/email/executors/email-read.executor.ts`
- Create: `backend/src/email/executors/email-send.executor.ts`
- Create: `backend/src/email/executors/email-search.executor.ts`
- Create: `backend/src/email/executors/email-reply.executor.ts`
- Create: `backend/src/email/executors/*.spec.ts`
- Modify: `backend/src/email/email.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/tools/tools.module.ts`

Each executor follows the same ToolExecutor interface pattern as existing tools (see `write-file.executor.ts`, `read-excel.executor.ts`).

- [ ] **Step 1: Create email-list.executor.ts**

Create `backend/src/email/executors/email-list.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { EmailService } from '../email.service';

@Injectable()
export class EmailListExecutor implements ToolExecutor {
  readonly name = 'email_list';

  constructor(private readonly email: EmailService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const folder = String(args.folder ?? 'INBOX');
    const limit = Number(args.limit ?? 20);
    const offset = Number(args.offset ?? 0);
    try {
      const messages = await this.email.list(folder, limit, offset);
      if (messages.length === 0) return 'No emails found.';
      return messages.map(m =>
        `[${m.unread ? 'UNREAD' : '    '}] ${m.date.slice(0, 16)} — ${m.from} — ${m.subject} (id: ${m.id})`
      ).join('\n');
    } catch (e) {
      return `Error listing emails: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Create email-list.executor.spec.ts**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EmailListExecutor } from './email-list.executor';
import { EmailService } from '../email.service';

describe('EmailListExecutor', () => {
  let executor: EmailListExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailListExecutor,
        { provide: EmailService, useValue: { list: jest.fn().mockResolvedValue([{ id: '1', from: 'a@b.com', subject: 'Test', date: '2024-01-01', to: [], unread: true }]) } },
      ],
    }).compile();
    executor = module.get<EmailListExecutor>(EmailListExecutor);
  });

  it('should list emails', async () => {
    const result = await executor.execute({});
    expect(result).toContain('UNREAD');
    expect(result).toContain('a@b.com');
  });
});
```

- [ ] **Step 3: Create remaining executors (email-read, email-send, email-search, email-reply)**

Follow the exact same pattern:
- Each injects `EmailService`
- Each implements `ToolExecutor` with `readonly name = 'email_xxx'`
- Each calls the corresponding EmailService method
- Each catches errors and returns string

Example pattern for all:

```typescript
// email-read.executor.ts
@Injectable()
export class EmailReadExecutor implements ToolExecutor {
  readonly name = 'email_read';
  constructor(private readonly email: EmailService) {}
  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const id = String(args.id ?? '');
    if (!id) return 'Error: "id" is required';
    try {
      const msg = await this.email.get(id);
      return `From: ${msg.from}\nTo: ${msg.to.join(', ')}\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${msg.body}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Register in EmailModule** — add executors to providers + exports

- [ ] **Step 7: Register in agent-loop.service.ts** — import, inject, add to executorMap

- [ ] **Step 8: Register in tools.module.ts** — import EmailModule

- [ ] **Step 9: Run all tests**

Run: `npx jest src/email/ --no-coverage`
Expected: PASS

- [ ] **Step 10: Commit**

---

### Task 5: CalendarModule — service + provider

**Files:**
- Create: `backend/src/calendar/calendar.module.ts`
- Create: `backend/src/calendar/calendar.service.ts`
- Create: `backend/src/calendar/calendar.service.spec.ts`
- Create: `backend/src/calendar/providers/calendar-provider.interface.ts`
- Create: `backend/src/calendar/providers/google-calendar.provider.ts`

- [ ] **Step 1: Create interface**

Create `backend/src/calendar/providers/calendar-provider.interface.ts`:

```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  attendees?: string[];
  htmlLink?: string;
}

export interface CreateEventOptions {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  attendees?: string[];
  location?: string;
}

export interface CalendarProvider {
  listEvents(since?: string, until?: string, calendar?: string): Promise<CalendarEvent[]>;
  createEvent(options: CreateEventOptions): Promise<CalendarEvent>;
  updateEvent(id: string, updates: Partial<CreateEventOptions>): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
  checkAvailability(startTime: string, endTime: string, attendees?: string[]): Promise<{ available: boolean; conflicts?: CalendarEvent[] }>;
}
```

- [ ] **Step 3: Create GoogleCalendarProvider**

Uses OAuthService to get authenticated client, calls google.calendar API v3.

- [ ] **Step 4: Create CalendarService + module, write tests, verify**

- [ ] **Step 5: Commit**

---

### Task 6: Calendar executors

**Files:**
- Create: `backend/src/calendar/executors/calendar-list-events.executor.ts`
- Create: `backend/src/calendar/executors/calendar-create-event.executor.ts`
- Create: `backend/src/calendar/executors/calendar-update-event.executor.ts`
- Create: `backend/src/calendar/executors/calendar-check-availability.executor.ts`
- Create: `backend/src/calendar/executors/*.spec.ts`
- Modify: `backend/src/calendar/calendar.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/tools/tools.module.ts`

- [ ] **Step 1: Create calendar-list-events.executor.ts**

Follow same pattern as email-list executor:

```typescript
@Injectable()
export class CalendarListEventsExecutor implements ToolExecutor {
  readonly name = 'calendar_list_events';
  constructor(private readonly calendar: CalendarService) {}
  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const since = args.since ? String(args.since) : undefined;
    const until = args.until ? String(args.until) : undefined;
    try {
      const events = await this.calendar.listEvents(since, until);
      if (events.length === 0) return 'No events found.';
      return events.map(e =>
        `[${e.startTime.slice(0, 16)} - ${e.endTime.slice(0, 16)}] ${e.title}${e.htmlLink ? ` (${e.htmlLink})` : ''}`
      ).join('\n');
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Create remaining calendar executors** (create-event, update-event, check-availability)
- [ ] **Step 3: Register in CalendarModule** — add executors to providers + exports
- [ ] **Step 4: Register in agent-loop.service.ts** — import, inject, add to executorMap
- [ ] **Step 5: Register in tools.module.ts** — import CalendarModule
- [ ] **Step 6: Run all tests**

Run: `npx jest src/calendar/ --no-coverage`
Expected: PASS

- [ ] **Step 7: Commit**

---

### Task 7: Seed tool definitions + Settings UI for OAuth

**Files:**
- Modify: `backend/prisma/seed.ts`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Add tool definitions to seed.ts**

Add email + calendar tools to DEFAULT_TOOLS array with proper parameters JSON.

- [ ] **Step 2: Add i18n keys**

- [ ] **Step 3: Add OAuth config UI in SettingsView.vue**

```vue
<div class="section">
  <h2>Google OAuth</h2>
  <div class="form-field">
    <label>Client ID</label>
    <input v-model="oauthClientId" class="mock-input" />
  </div>
  <div class="form-field">
    <label>Client Secret</label>
    <input v-model="oauthClientSecret" type="password" class="mock-input" />
  </div>
  <button @click="saveOAuth" class="mock-button">Save & Authorize</button>
</div>
```

- [ ] **Step 4: Commit**

---

### Task 8: Register all modules in app

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Register EmailModule, CalendarModule**

- [ ] **Step 2: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All pass (pre-existing failures unchanged)

- [ ] **Step 3: Commit**
