# Google Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace old OAuth/token-based email/calendar tools with a unified OAuth-based Google connector system (Gmail, Calendar, Drive).

**Architecture:** A single Google Connector stores OAuth tokens. Three service wrappers (GmailService, GoogleCalendarService, GoogleDriveService) each expose API methods. 13 ToolExecutors wrap each method for the agent loop. Frontend ConnectorsView is rewritten with an OAuth connect flow. Old `oauth/` module removed.

**Tech Stack:** NestJS, googleapis, Prisma/SQLite, Vue 3, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-06-13-connectors-google-design.md`

---

### Task 1: Update Prisma Connector model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

```
model Connector {
  id        String   @id @default(cuid())
  type      String
  services  String   @default("[]")
  account   String?
  config    String   @default("{}")
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 1: Update schema**

Edit `backend/prisma/schema.prisma`: replace the existing `Connector` model with the version above.

- [ ] **Step 2: Generate migration**

```bash
cd backend
npx prisma migrate dev --name add_connector_services_account
npx prisma generate
```

- [ ] **Step 3: Verify build**

```bash
cd backend
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add services and account fields to Connector model"
```

---

### Task 2: Rewrite Connector service (backend)

**Files:**
- Modify: `backend/src/connector/connector.service.ts`
- Create: `backend/src/connector/dto/upsert-connector.dto.ts`
- Create: `backend/src/connector/dto/update-connector.dto.ts`

- [ ] **Step 1: Create DTOs**

Create `backend/src/connector/dto/upsert-connector.dto.ts`:
```ts
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class UpsertConnectorDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
```

Create `backend/src/connector/dto/update-connector.dto.ts`:
```ts
import { PartialType } from '@nestjs/mapped-types';
import { UpsertConnectorDto } from './upsert-connector.dto';

export class UpdateConnectorDto extends PartialType(UpsertConnectorDto) {}
```

- [ ] **Step 2: Rewrite connector.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';

@Injectable()
export class ConnectorService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.connector.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findById(id: string) {
    return this.prisma.connector.findUnique({ where: { id } });
  }

  async findByType(type: string) {
    return this.prisma.connector.findFirst({ where: { type } });
  }

  async upsert(type: string, dto: UpsertConnectorDto) {
    const existing = await this.prisma.connector.findFirst({ where: { type } });
    const data: Record<string, unknown> = {
      name: dto.name,
      services: JSON.stringify(dto.services ?? []),
      config: dto.config ? JSON.stringify(dto.config) : '{}',
    };
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    if (existing) {
      return this.prisma.connector.update({ where: { id: existing.id }, data });
    }
    return this.prisma.connector.create({
      data: { ...data, type } as any,
    });
  }

  async update(id: string, dto: UpdateConnectorDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.services !== undefined) data.services = JSON.stringify(dto.services);
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    return this.prisma.connector.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.connector.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Update connector.controller.ts**

```ts
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';

@Controller('connectors')
export class ConnectorController {
  constructor(private readonly connector: ConnectorService) {}

  @Get()
  async findAll() {
    return this.connector.findAll();
  }

  @Post()
  async upsert(@Body() body: UpsertConnectorDto) {
    return this.connector.upsert(body.type, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateConnectorDto) {
    return this.connector.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.connector.remove(id);
    return { ok: true };
  }
}
```

- [ ] **Step 4: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/connector/
git commit -m "feat: add DTOs and typed connector service"
```

---

### Task 3: Create Google OAuth service

**Files:**
- Create: `backend/src/connector/providers/google/google-oauth.service.ts`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p backend/src/connector/providers/google
```

- [ ] **Step 2: Create google-oauth.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConnectorService } from '../../connector.service';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
];

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly connector: ConnectorService) {}

  private getClient(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  }

  getAuthUrl(config: { clientId: string; clientSecret: string; redirectUri: string }): string {
    const client = this.getClient(config);
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async handleCallback(code: string, config: { clientId: string; clientSecret: string; redirectUri: string }): Promise<GoogleTokens> {
    const client = this.getClient(config);
    const { tokens } = await client.getToken(code);
    return tokens as GoogleTokens;
  }

  async getAuthenticatedClient(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    const connector = await this.connector.findByType('google');
    if (!connector) return null;
    const parsed = JSON.parse(connector.config);
    const tokens: GoogleTokens = parsed.tokens;
    if (!tokens?.access_token) return null;

    const oauth2 = this.getClient(config);
    oauth2.setCredentials(tokens);
    oauth2.on('tokens', async (newTokens) => {
      const current = JSON.parse(connector.config);
      if (newTokens.refresh_token) current.tokens.refresh_token = newTokens.refresh_token;
      current.tokens = { ...current.tokens, ...newTokens };
      await this.connector.update(connector.id, { config: current });
    });

    return oauth2;
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/connector/providers/google/
git commit -m "feat: add Google OAuth service"
```

---

### Task 4: Add OAuth endpoints to ConnectorController

**Files:**
- Modify: `backend/src/connector/connector.controller.ts`
- Modify: `backend/src/connector/connector.module.ts`

- [ ] **Step 1: Add OAuth endpoints to controller**

```ts
import { ..., Query } from '@nestjs/common';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

export class ConnectorController {
  constructor(
    private readonly connector: ConnectorService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  // ... existing endpoints ...

  @Get('google/auth-url')
  async googleAuthUrl(@Query('clientId') clientId: string, @Query('clientSecret') clientSecret: string, @Query('redirectUri') redirectUri: string) {
    return { url: this.googleOAuth.getAuthUrl({ clientId, clientSecret, redirectUri }) };
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('clientId') clientId: string, @Query('clientSecret') clientSecret: string, @Query('redirectUri') redirectUri: string) {
    const tokens = await this.googleOAuth.handleCallback(code, { clientId, clientSecret, redirectUri });
    await this.connector.upsert('google', {
      type: 'google',
      name: 'Google (Gmail, Calendar, Drive)',
      services: ['google_gmail', 'google_calendar', 'google_drive'],
      config: { clientId, clientSecret, redirectUri, tokens },
      enabled: true,
    });
    return { ok: true };
  }
}
```

- [ ] **Step 2: Update connector.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { ConnectorController } from './connector.controller';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

@Module({
  controllers: [ConnectorController],
  providers: [ConnectorService, GoogleOAuthService],
  exports: [ConnectorService, GoogleOAuthService],
})
export class ConnectorModule {}
```

- [ ] **Step 3: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/connector/
git commit -m "feat: add OAuth auth-url and callback endpoints"
```

---

### Task 5: Create Gmail service

**Files:**
- Create: `backend/src/connector/providers/google/gmail.service.ts`

- [ ] **Step 1: Create gmail.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  labels: string[];
}

@Injectable()
export class GmailService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getGmail() {
    const auth = await this.googleOAuth.getAuthenticatedClient({
      clientId: '',
      clientSecret: '',
      redirectUri: '',
    });
    if (!auth) throw new Error('Google not connected');
    return google.gmail({ version: 'v1', auth: auth as any });
  }

  async search(query: string, maxResults = 20): Promise<GmailMessage[]> {
    const gmail = await this.getGmail();
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
    const ids = res.data.messages?.map(m => m.id!) ?? [];
    if (ids.length === 0) return [];
    return Promise.all(ids.map(id => this.get(id)));
  }

  async get(id: string): Promise<GmailMessage> {
    const gmail = await this.getGmail();
    const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = (res.data.payload?.headers ?? []).reduce((acc, h) => {
      if (h.name) acc[h.name.toLowerCase()] = h.value ?? '';
      return acc;
    }, {} as Record<string, string>);

    let body = '';
    const parts = res.data.payload?.parts ?? [];
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        break;
      }
    }
    if (!body && res.data.payload?.body?.data) {
      body = Buffer.from(res.data.payload.body.data, 'base64url').toString('utf-8');
    }

    return {
      id: res.data.id!,
      threadId: res.data.threadId!,
      subject: headers['subject'] ?? '',
      from: headers['from'] ?? '',
      to: headers['to'] ?? '',
      date: headers['date'] ?? '',
      snippet: res.data.snippet ?? '',
      body,
      labels: res.data.labelIds ?? [],
    };
  }

  async send(to: string[], subject: string, body: string, cc?: string[], bcc?: string[]): Promise<{ id: string }> {
    const gmail = await this.getGmail();
    const email = [
      `To: ${to.join(', ')}`,
      cc?.length ? `Cc: ${cc.join(', ')}` : '',
      bcc?.length ? `Bcc: ${bcc.join(', ')}` : '',
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].filter(Boolean).join('\n');

    const encoded = Buffer.from(email).toString('base64url');
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    return { id: res.data.id! };
  }

  async createDraft(to: string[], subject: string, body: string): Promise<{ id: string }> {
    const gmail = await this.getGmail();
    const email = [
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');

    const encoded = Buffer.from(email).toString('base64url');
    const res = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw: encoded } } });
    return { id: res.data.id! };
  }

  async listLabels(): Promise<{ id: string; name: string }[]> {
    const gmail = await this.getGmail();
    const res = await gmail.users.labels.list({ userId: 'me' });
    return (res.data.labels ?? []).map(l => ({ id: l.id!, name: l.name! }));
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connector/providers/google/gmail.service.ts
git commit -m "feat: add Gmail service"
```

---

### Task 6: Create Google Calendar service

**Files:**
- Create: `backend/src/connector/providers/google/google-calendar.service.ts`

- [ ] **Step 1: Create google-calendar.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getCalendar() {
    const auth = await this.googleOAuth.getAuthenticatedClient({ clientId: '', clientSecret: '', redirectUri: '' });
    if (!auth) throw new Error('Google not connected');
    return google.calendar({ version: 'v3', auth: auth as any });
  }

  async listEvents(since?: string, until?: string): Promise<CalendarEvent[]> {
    const calendar = await this.getCalendar();
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: since ?? new Date().toISOString(),
      timeMax: until,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return (res.data.items ?? []).map(e => ({
      id: e.id!,
      summary: e.summary ?? '',
      description: e.description,
      startTime: e.start?.dateTime ?? e.start?.date ?? '',
      endTime: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location,
      attendees: e.attendees?.map(a => a.email!),
    }));
  }

  async createEvent(options: { title: string; startTime: string; endTime: string; description?: string; attendees?: string[]; location?: string }): Promise<CalendarEvent> {
    const calendar = await this.getCalendar();
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: options.title,
        description: options.description,
        start: { dateTime: options.startTime },
        end: { dateTime: options.endTime },
        location: options.location,
        attendees: options.attendees?.map(email => ({ email })),
      },
    });
    return {
      id: res.data.id!,
      summary: res.data.summary ?? '',
      description: res.data.description ?? undefined,
      startTime: res.data.start?.dateTime ?? '',
      endTime: res.data.end?.dateTime ?? '',
      location: res.data.location ?? undefined,
      attendees: res.data.attendees?.map(a => a.email!),
    };
  }

  async updateEvent(id: string, updates: { title?: string; startTime?: string; endTime?: string; description?: string }): Promise<CalendarEvent> {
    const calendar = await this.getCalendar();
    const body: Record<string, unknown> = {};
    if (updates.title) body.summary = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.startTime) body.start = { dateTime: updates.startTime };
    if (updates.endTime) body.end = { dateTime: updates.endTime };
    const res = await calendar.events.patch({ calendarId: 'primary', eventId: id, requestBody: body });
    return {
      id: res.data.id!,
      summary: res.data.summary ?? '',
      startTime: res.data.start?.dateTime ?? '',
      endTime: res.data.end?.dateTime ?? '',
    };
  }

  async checkAvailability(startTime: string, endTime: string): Promise<{ available: boolean; busySlots: { start: string; end: string }[] }> {
    const calendar = await this.getCalendar();
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime,
        timeMax: endTime,
        items: [{ id: 'primary' }],
      },
    });
    const busy = res.data.calendars?.['primary']?.busy ?? [];
    return { available: busy.length === 0, busySlots: busy.map(b => ({ start: b.start!, end: b.end! })) };
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connector/providers/google/google-calendar.service.ts
git commit -m "feat: add Google Calendar service"
```

---

### Task 7: Create Google Drive service

**Files:**
- Create: `backend/src/connector/providers/google/google-drive.service.ts`

- [ ] **Step 1: Create google-drive.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

@Injectable()
export class GoogleDriveService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getDrive() {
    const auth = await this.googleOAuth.getAuthenticatedClient({ clientId: '', clientSecret: '', redirectUri: '' });
    if (!auth) throw new Error('Google not connected');
    return google.drive({ version: 'v3', auth: auth as any });
  }

  async search(query: string, pageSize = 20): Promise<DriveFile[]> {
    const drive = await this.getDrive();
    const res = await drive.files.list({ q: `name contains '${query}'`, pageSize, fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)' });
    return (res.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: f.size ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
    }));
  }

  async get(id: string): Promise<DriveFile & { content?: string }> {
    const drive = await this.getDrive();
    const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType,size,modifiedTime,webViewLink' });
    let content: string | undefined;

    if (meta.data.mimeType === 'text/plain' || meta.data.mimeType?.includes('text')) {
      const resp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'text' });
      content = resp.data as string;
    }

    return {
      id: meta.data.id!,
      name: meta.data.name!,
      mimeType: meta.data.mimeType!,
      size: meta.data.size ?? undefined,
      modifiedTime: meta.data.modifiedTime ?? undefined,
      webViewLink: meta.data.webViewLink ?? undefined,
      content,
    };
  }

  async listFiles(folderId?: string, pageSize = 50): Promise<DriveFile[]> {
    const drive = await this.getDrive();
    const q = folderId ? `'${folderId}' in parents` : '';
    const res = await drive.files.list({ q, pageSize, fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)' });
    return (res.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: f.size ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
    }));
  }

  async upload(name: string, content: string, mimeType = 'text/plain'): Promise<DriveFile> {
    const drive = await this.getDrive();
    const res = await drive.files.create({
      requestBody: { name },
      media: { mimeType, body: content },
      fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
    });
    return { id: res.data.id!, name: res.data.name!, mimeType: res.data.mimeType! };
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connector/providers/google/google-drive.service.ts
git commit -m "feat: add Google Drive service"
```

---

### Task 8: Update connector module exports

**Files:**
- Modify: `backend/src/connector/connector.module.ts`

- [ ] **Step 1: Update module exports**

```ts
import { Module } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { ConnectorController } from './connector.controller';
import { GoogleOAuthService } from './providers/google/google-oauth.service';
import { GmailService } from './providers/google/gmail.service';
import { GoogleCalendarService } from './providers/google/google-calendar.service';
import { GoogleDriveService } from './providers/google/google-drive.service';

@Module({
  controllers: [ConnectorController],
  providers: [ConnectorService, GoogleOAuthService, GmailService, GoogleCalendarService, GoogleDriveService],
  exports: [ConnectorService, GoogleOAuthService, GmailService, GoogleCalendarService, GoogleDriveService],
})
export class ConnectorModule {}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connector/
git commit -m "feat: export Gmail, Calendar, Drive services from connector module"
```

---

### Task 9: Create Gmail executors (5 tools)

**Files:**
- Create: `backend/src/tools/executors/google-gmail-search.executor.ts`
- Create: `backend/src/tools/executors/google-gmail-read.executor.ts`
- Create: `backend/src/tools/executors/google-gmail-send.executor.ts`
- Create: `backend/src/tools/executors/google-gmail-draft.executor.ts`
- Create: `backend/src/tools/executors/google-gmail-labels.executor.ts`

- [ ] **Step 1: Create google-gmail-search.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailSearchExecutor implements ToolExecutor {
  readonly name = 'google_gmail_search';
  readonly description = 'Search Gmail emails by query. Supports Gmail search syntax (from:, subject:, after:, etc.).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Gmail search query' },
      maxResults: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const messages = await this.gmail.search(args.query as string, (args.maxResults as number) ?? 20);
      if (messages.length === 0) return 'No emails found.';
      return messages.map(m => `[${m.date}] ${m.from} - ${m.subject} (${m.snippet.slice(0, 100)})`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Create google-gmail-read.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailReadExecutor implements ToolExecutor {
  readonly name = 'google_gmail_read';
  readonly description = 'Read full content of a specific Gmail email by ID.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'Email ID to read' },
    },
    required: ['id'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const msg = await this.gmail.get(args.id as string);
      return `From: ${msg.from}\nTo: ${msg.to}\nDate: ${msg.date}\nSubject: ${msg.subject}\nLabels: ${msg.labels.join(', ')}\n\n${msg.body || msg.snippet}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 3: Create google-gmail-send.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailSendExecutor implements ToolExecutor {
  readonly name = 'google_gmail_send';
  readonly description = 'Send an email via Gmail. Supports To, CC, BCC.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'Recipients' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body text' },
      cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
      bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
    },
    required: ['to', 'subject', 'body'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.gmail.send(
        args.to as string[],
        args.subject as string,
        args.body as string,
        args.cc as string[] | undefined,
        args.bcc as string[] | undefined,
      );
      return `Email sent. ID: ${result.id}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Create google-gmail-draft.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailDraftExecutor implements ToolExecutor {
  readonly name = 'google_gmail_draft';
  readonly description = 'Create a Gmail email draft (does not send).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'Recipients' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body text' },
    },
    required: ['to', 'subject', 'body'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.gmail.createDraft(args.to as string[], args.subject as string, args.body as string);
      return `Draft created. ID: ${result.id}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Create google-gmail-labels.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailLabelsExecutor implements ToolExecutor {
  readonly name = 'google_gmail_labels';
  readonly description = 'List all Gmail labels for the connected account.';
  readonly parameters = { type: 'object' as const, properties: {} };

  constructor(private readonly gmail: GmailService) {}

  async execute(): Promise<string> {
    try {
      const labels = await this.gmail.listLabels();
      return labels.map(l => `${l.name} (${l.id})`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 6: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/tools/executors/google-gmail-*.executor.ts
git commit -m "feat: add 5 Gmail tool executors"
```

---

### Task 10: Create Calendar executors (4 tools)

**Files:**
- Create: `backend/src/tools/executors/google-calendar-list.executor.ts`
- Create: `backend/src/tools/executors/google-calendar-create.executor.ts`
- Create: `backend/src/tools/executors/google-calendar-update.executor.ts`
- Create: `backend/src/tools/executors/google-calendar-availability.executor.ts`

- [ ] **Step 1: Create google-calendar-list.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarListExecutor implements ToolExecutor {
  readonly name = 'google_calendar_list';
  readonly description = 'List Google Calendar events within a date range.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      since: { type: 'string', description: 'Start date ISO string' },
      until: { type: 'string', description: 'End date ISO string' },
    },
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const events = await this.calendar.listEvents(args.since as string, args.until as string);
      if (events.length === 0) return 'No events found.';
      return events.map(e => `[${e.startTime}] ${e.summary}${e.location ? ` @ ${e.location}` : ''}`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Create google-calendar-create.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarCreateExecutor implements ToolExecutor {
  readonly name = 'google_calendar_create';
  readonly description = 'Create a new Google Calendar event.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Event title' },
      startTime: { type: 'string', description: 'Start time ISO string' },
      endTime: { type: 'string', description: 'End time ISO string' },
      description: { type: 'string', description: 'Event description' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
      location: { type: 'string', description: 'Event location' },
    },
    required: ['title', 'startTime', 'endTime'] as string[],
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const event = await this.calendar.createEvent(args as any);
      return `Event created: "${event.summary}" at ${event.startTime}. ID: ${event.id}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 3: Create google-calendar-update.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarUpdateExecutor implements ToolExecutor {
  readonly name = 'google_calendar_update';
  readonly description = 'Update or delete a Google Calendar event.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'Event ID to update' },
      title: { type: 'string', description: 'New title' },
      startTime: { type: 'string', description: 'New start time ISO string' },
      endTime: { type: 'string', description: 'New end time ISO string' },
      delete: { type: 'boolean', description: 'Set to true to delete the event instead of updating' },
    },
    required: ['id'] as string[],
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      if (args.delete) {
        return 'Event deletion requires direct Calendar access. Update the event or use the Calendar UI.';
      }
      const event = await this.calendar.updateEvent(args.id as string, {
        title: args.title as string,
        startTime: args.startTime as string,
        endTime: args.endTime as string,
      });
      return `Event updated: "${event.summary}".`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Create google-calendar-availability.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarAvailabilityExecutor implements ToolExecutor {
  readonly name = 'google_calendar_availability';
  readonly description = 'Check if a time slot is available in Google Calendar.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      startTime: { type: 'string', description: 'Start time ISO string' },
      endTime: { type: 'string', description: 'End time ISO string' },
    },
    required: ['startTime', 'endTime'] as string[],
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.calendar.checkAvailability(args.startTime as string, args.endTime as string);
      if (result.available) return 'Time slot is available.';
      return `Time slot is busy:\n${result.busySlots.map(b => `  ${b.start} - ${b.end}`).join('\n')}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/tools/executors/google-calendar-*.executor.ts
git commit -m "feat: add 4 Calendar tool executors"
```

---

### Task 11: Create Drive executors (4 tools)

**Files:**
- Create: `backend/src/tools/executors/google-drive-search.executor.ts`
- Create: `backend/src/tools/executors/google-drive-read.executor.ts`
- Create: `backend/src/tools/executors/google-drive-list.executor.ts`
- Create: `backend/src/tools/executors/google-drive-upload.executor.ts`

- [ ] **Step 1: Create google-drive-search.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveSearchExecutor implements ToolExecutor {
  readonly name = 'google_drive_search';
  readonly description = 'Search files in Google Drive by name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'File name search query' },
      pageSize: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const files = await this.drive.search(args.query as string, (args.pageSize as number) ?? 20);
      if (files.length === 0) return 'No files found.';
      return files.map(f => `[${f.mimeType}] ${f.name} (${f.id})${f.modifiedTime ? ` - ${f.modifiedTime}` : ''}`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Create google-drive-read.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveReadExecutor implements ToolExecutor {
  readonly name = 'google_drive_read';
  readonly description = 'Read file content from Google Drive by file ID. Supports text files.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'File ID to read' },
    },
    required: ['id'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const file = await this.drive.get(args.id as string);
      let result = `File: ${file.name}\nType: ${file.mimeType}\n`;
      if (file.content) result += `\n${file.content}`;
      else result += '\n(Content not available for this file type. Open in browser to view.)';
      return result;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 3: Create google-drive-list.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveListExecutor implements ToolExecutor {
  readonly name = 'google_drive_list';
  readonly description = 'List files and folders in a Google Drive directory. Omit folderId to list root.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      folderId: { type: 'string', description: 'Folder ID to list (omit for root)' },
    },
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const files = await this.drive.listFiles(args.folderId as string);
      if (files.length === 0) return 'Folder is empty.';
      return files.map(f => `${f.mimeType.includes('folder') ? '📁' : '📄'} ${f.name}`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Create google-drive-upload.executor.ts**

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveUploadExecutor implements ToolExecutor {
  readonly name = 'google_drive_upload';
  readonly description = 'Upload a text file to Google Drive.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'File name' },
      content: { type: 'string', description: 'File content' },
    },
    required: ['name', 'content'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const file = await this.drive.upload(args.name as string, args.content as string);
      return `File uploaded: ${file.name} (${file.id})`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/tools/executors/google-drive-*.executor.ts
git commit -m "feat: add 4 Drive tool executors"
```

---

### Task 12: Register executors in agent module + agent-loop + tools module

**Files:**
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/tools/tools.module.ts`

- [ ] **Step 1: Register executors in agent.module.ts**

Add imports:
```ts
import { GoogleGmailSearchExecutor } from '../tools/executors/google-gmail-search.executor';
import { GoogleGmailReadExecutor } from '../tools/executors/google-gmail-read.executor';
import { GoogleGmailSendExecutor } from '../tools/executors/google-gmail-send.executor';
import { GoogleGmailDraftExecutor } from '../tools/executors/google-gmail-draft.executor';
import { GoogleGmailLabelsExecutor } from '../tools/executors/google-gmail-labels.executor';
import { GoogleCalendarListExecutor } from '../tools/executors/google-calendar-list.executor';
import { GoogleCalendarCreateExecutor } from '../tools/executors/google-calendar-create.executor';
import { GoogleCalendarUpdateExecutor } from '../tools/executors/google-calendar-update.executor';
import { GoogleCalendarAvailabilityExecutor } from '../tools/executors/google-calendar-availability.executor';
import { GoogleDriveSearchExecutor } from '../tools/executors/google-drive-search.executor';
import { GoogleDriveReadExecutor } from '../tools/executors/google-drive-read.executor';
import { GoogleDriveListExecutor } from '../tools/executors/google-drive-list.executor';
import { GoogleDriveUploadExecutor } from '../tools/executors/google-drive-upload.executor';
```

Add `ConnectorModule` to imports:
```ts
import { ConnectorModule } from '../connector/connector.module';
```

Add to `imports` array:
```ts
..., ConnectorModule,
```

Add to `providers` array:
```ts
GoogleGmailSearchExecutor,
GoogleGmailReadExecutor,
GoogleGmailSendExecutor,
GoogleGmailDraftExecutor,
GoogleGmailLabelsExecutor,
GoogleCalendarListExecutor,
GoogleCalendarCreateExecutor,
GoogleCalendarUpdateExecutor,
GoogleCalendarAvailabilityExecutor,
GoogleDriveSearchExecutor,
GoogleDriveReadExecutor,
GoogleDriveListExecutor,
GoogleDriveUploadExecutor,
```

- [ ] **Step 2: Register executors in agent-loop.service.ts**

Add imports (same as above, with correct relative paths like `../../tools/executors/...`).

Add constructor parameters:
```ts
    private readonly googleGmailSearch: GoogleGmailSearchExecutor,
    private readonly googleGmailRead: GoogleGmailReadExecutor,
    private readonly googleGmailSend: GoogleGmailSendExecutor,
    private readonly googleGmailDraft: GoogleGmailDraftExecutor,
    private readonly googleGmailLabels: GoogleGmailLabelsExecutor,
    private readonly googleCalendarList: GoogleCalendarListExecutor,
    private readonly googleCalendarCreate: GoogleCalendarCreateExecutor,
    private readonly googleCalendarUpdate: GoogleCalendarUpdateExecutor,
    private readonly googleCalendarAvailability: GoogleCalendarAvailabilityExecutor,
    private readonly googleDriveSearch: GoogleDriveSearchExecutor,
    private readonly googleDriveRead: GoogleDriveReadExecutor,
    private readonly googleDriveList: GoogleDriveListExecutor,
    private readonly googleDriveUpload: GoogleDriveUploadExecutor,
```

Add to `executorMap`:
```ts
      [googleGmailSearch.name, googleGmailSearch],
      [googleGmailRead.name, googleGmailRead],
      [googleGmailSend.name, googleGmailSend],
      [googleGmailDraft.name, googleGmailDraft],
      [googleGmailLabels.name, googleGmailLabels],
      [googleCalendarList.name, googleCalendarList],
      [googleCalendarCreate.name, googleCalendarCreate],
      [googleCalendarUpdate.name, googleCalendarUpdate],
      [googleCalendarAvailability.name, googleCalendarAvailability],
      [googleDriveSearch.name, googleDriveSearch],
      [googleDriveRead.name, googleDriveRead],
      [googleDriveList.name, googleDriveList],
      [googleDriveUpload.name, googleDriveUpload],
```

- [ ] **Step 3: Register executors in tools.module.ts**

Add imports (same as Task 12 Step 1).

Add imports `ConnectorModule`:
```ts
import { ConnectorModule } from '../connector/connector.module';
```

Add to `imports` array:
```ts
..., ConnectorModule,
```

Add to `EXECUTORS` array:
```ts
GoogleGmailSearchExecutor,
GoogleGmailReadExecutor,
GoogleGmailSendExecutor,
GoogleGmailDraftExecutor,
GoogleGmailLabelsExecutor,
GoogleCalendarListExecutor,
GoogleCalendarCreateExecutor,
GoogleCalendarUpdateExecutor,
GoogleCalendarAvailabilityExecutor,
GoogleDriveSearchExecutor,
GoogleDriveReadExecutor,
GoogleDriveListExecutor,
GoogleDriveUploadExecutor,
```

- [ ] **Step 4: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/ backend/src/tools/
git commit -m "feat: register Google connector executors in agent loop"
```

---

### Task 13: Update seed.ts with new tool definitions

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add Google connector tool entries**

Append to `DEFAULT_TOOLS` array before closing `];`:

```ts
  { name: 'google_gmail_search', description: 'Search Gmail emails by query.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"Gmail search query"},"maxResults":{"type":"number","description":"Max results (default: 20)"}},"required":["query"]}', enabled: false },
  { name: 'google_gmail_read', description: 'Read full content of a Gmail email by ID.', parameters: '{"type":"object","properties":{"id":{"type":"string","description":"Email ID to read"}},"required":["id"]}', enabled: false },
  { name: 'google_gmail_send', description: 'Send an email via Gmail.', parameters: '{"type":"object","properties":{"to":{"type":"array","items":{"type":"string"},"description":"Recipients"},"subject":{"type":"string","description":"Email subject"},"body":{"type":"string","description":"Email body"},"cc":{"type":"array","items":{"type":"string"},"description":"CC"},"bcc":{"type":"array","items":{"type":"string"},"description":"BCC"}},"required":["to","subject","body"]}', enabled: false },
  { name: 'google_gmail_draft', description: 'Create a Gmail draft (does not send).', parameters: '{"type":"object","properties":{"to":{"type":"array","items":{"type":"string"},"description":"Recipients"},"subject":{"type":"string","description":"Subject"},"body":{"type":"string","description":"Body"}},"required":["to","subject","body"]}', enabled: false },
  { name: 'google_gmail_labels', description: 'List Gmail labels.', parameters: '{"type":"object","properties":{}}', enabled: false },
  { name: 'google_calendar_list', description: 'List Google Calendar events.', parameters: '{"type":"object","properties":{"since":{"type":"string","description":"Start date ISO"},"until":{"type":"string","description":"End date ISO"}}}', enabled: false },
  { name: 'google_calendar_create', description: 'Create a Google Calendar event.', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Event title"},"startTime":{"type":"string","description":"Start time ISO"},"endTime":{"type":"string","description":"End time ISO"},"description":{"type":"string","description":"Description"},"attendees":{"type":"array","items":{"type":"string"},"description":"Attendee emails"},"location":{"type":"string","description":"Location"}},"required":["title","startTime","endTime"]}', enabled: false },
  { name: 'google_calendar_update', description: 'Update a Google Calendar event.', parameters: '{"type":"object","properties":{"id":{"type":"string","description":"Event ID"},"title":{"type":"string","description":"New title"},"startTime":{"type":"string","description":"New start time"},"endTime":{"type":"string","description":"New end time"}},"required":["id"]}', enabled: false },
  { name: 'google_calendar_availability', description: 'Check calendar availability.', parameters: '{"type":"object","properties":{"startTime":{"type":"string","description":"Start ISO"},"endTime":{"type":"string","description":"End ISO"}},"required":["startTime","endTime"]}', enabled: false },
  { name: 'google_drive_search', description: 'Search Google Drive files by name.', parameters: '{"type":"object","properties":{"query":{"type":"string","description":"File name query"},"pageSize":{"type":"number","description":"Max results"}},"required":["query"]}', enabled: false },
  { name: 'google_drive_read', description: 'Read file content from Google Drive.', parameters: '{"type":"object","properties":{"id":{"type":"string","description":"File ID"}},"required":["id"]}', enabled: false },
  { name: 'google_drive_list', description: 'List files in a Google Drive folder.', parameters: '{"type":"object","properties":{"folderId":{"type":"string","description":"Folder ID (omit for root)"}}}', enabled: false },
  { name: 'google_drive_upload', description: 'Upload a text file to Google Drive.', parameters: '{"type":"object","properties":{"name":{"type":"string","description":"File name"},"content":{"type":"string","description":"File content"}},"required":["name","content"]}', enabled: false },
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add Google connector tool definitions to seed"
```

---

### Task 14: Rewrite ConnectorsView.vue (frontend)

**Files:**
- Modify: `frontend/src/components/ConnectorsView.vue`

- [ ] **Step 1: Rewrite ConnectorsView.vue**

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in displayConnectors" :key="connector.type" class="mb-3">
          <div class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border bg-cyber-dark">
            <div class="flex items-center gap-3 min-w-0">
              <img :src="`https://cdn.simpleicons.org/${connector.type === 'google' ? 'google' : connector.type}`" :alt="connector.name" class="w-5 h-5 shrink-0" />
              <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs font-mono" :class="connector.enabled ? 'text-cyber-green' : 'text-cyber-muted'">
                {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
              </span>
              <button v-if="connector.type === 'google' && !connector.enabled" @click="connectGoogle"
                class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-cyber-accent/40 hover:text-cyber-accent transition-colors duration-150">
                {{ t('connectors.connect') }}
              </button>
              <button v-if="connector.enabled" @click="disconnect(connector)"
                class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-red-400/40 hover:text-red-400 transition-colors duration-150">
                {{ t('connectors.disconnect') }}
              </button>
            </div>
          </div>
          <div v-if="connector.enabled && connector.type === 'google'" class="border-x border-b border-cyber-code-border bg-cyber-bg/50">
            <div v-for="svc in googleServices" :key="svc.id" class="flex items-center justify-between px-6 py-2 border-b border-cyber-code-border last:border-b-0">
              <span class="text-xs font-mono text-cyber-text">{{ svc.label }}</span>
              <span class="text-xs font-mono text-cyber-green">● Active ({{ svc.toolCount }} tools)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Connector {
  id: string
  name: string
  type: string
  services: string
  config: string
  account: string | null
  enabled: boolean
}

const connectors = ref<Connector[]>([])

const googleServices = [
  { id: 'google_gmail', label: 'Gmail', toolCount: 5 },
  { id: 'google_calendar', label: 'Google Calendar', toolCount: 4 },
  { id: 'google_drive', label: 'Google Drive', toolCount: 4 },
]

const displayConnectors = computed(() => {
  return connectorTemplates.map(t => {
    const saved = connectors.value.find(c => c.type === t.type)
    return saved ?? {
      id: '',
      name: t.name,
      type: t.type,
      services: '[]',
      config: '{}',
      account: null,
      enabled: false,
    }
  })
})

const connectorTemplates = [
  { type: 'google', name: 'Google (Gmail, Calendar, Drive)' },
  { type: 'notion', name: 'Notion' },
  { type: 'slack', name: 'Slack' },
  { type: 'github', name: 'GitHub / GitLab' },
]

onMounted(async () => {
  await fetchConnectors()
})

async function fetchConnectors() {
  try {
    const res = await fetch('/api/connectors')
    if (res.ok) connectors.value = await res.json()
  } catch {}
}

async function connectGoogle() {
  const clientId = prompt('Enter Google Client ID:')
  if (!clientId) return
  const clientSecret = prompt('Enter Google Client Secret:')
  if (!clientSecret) return

  const res = await fetch(`/api/connectors/google/auth-url?clientId=${encodeURIComponent(clientId)}&clientSecret=${encodeURIComponent(clientSecret)}&redirectUri=${encodeURIComponent(window.location.origin + '/api/connectors/google/callback')}`)
  const data = await res.json()
  if (data.url) {
    window.open(data.url, '_blank')
    // Poll: after user approves, callback happens server-side
    setTimeout(() => fetchConnectors(), 5000)
  }
}

async function disconnect(connector: Connector) {
  await fetch(`/api/connectors/${connector.id}`, {
    method: 'DELETE',
  })
  await fetchConnectors()
}
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConnectorsView.vue
git commit -m "feat: rewrite ConnectorsView with OAuth connect flow"
```

---

### Task 15: Cleanup old OAuth module

**Files:**
- Delete: `backend/src/oauth/`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Remove OAuthModule from app.module.ts**

```bash
rm -rf backend/src/oauth
```

Remove import and registration from `backend/src/app.module.ts`:
```
- import { OAuthModule } from './oauth/oauth.module';
- OAuthModule,
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old OAuth module, replaced by connector providers"
```

---

### Task 16: Update connector AGENTS.md

**Files:**
- Create: `backend/src/connector/AGENTS.md`

- [ ] **Step 1: Create AGENTS.md**

Create `backend/src/connector/AGENTS.md` documenting the module, providers, services, executors, and API endpoints.

- [ ] **Step 2: Commit**

```bash
git add backend/src/connector/AGENTS.md
git commit -m "docs: add connector module AGENTS.md"
```
