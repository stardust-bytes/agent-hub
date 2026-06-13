# Connectors Per-Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split single Google connector into 3 independent connectors (Gmail, Calendar, Drive) with separate OAuth flows.

**Architecture:** Remove `services` field from Connector model. Each connector is 1 row = 1 service. Generic OAuth endpoints dispatch by `type` param. Frontend shows 3 separate rows.

**Tech Stack:** NestJS, Prisma/SQLite, Vue 3

**Spec:** `docs/superpowers/specs/2026-06-13-connectors-refactor-per-service.md`

---

### Task 1: Update Prisma schema — remove services field

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Remove services from Connector model**

Replace Connector model with:
```prisma
model Connector {
  id        String   @id @default(cuid())
  type      String
  account   String?
  config    String   @default("{}")
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Generate migration**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend
npx prisma migrate dev --name remove_connector_services
npx prisma generate
```

- [ ] **Step 3: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend && npm run build
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/prisma/
git commit -m "refactor: remove services field from Connector model"
```

---

### Task 2: Update DTO — remove services

**Files:**
- Modify: `backend/src/connector/dto/upsert-connector.dto.ts`

- [ ] **Step 1: Remove services from DTO**

```ts
import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpsertConnectorDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/src/connector/dto/upsert-connector.dto.ts
git commit -m "refactor: remove services field from DTO"
```

---

### Task 3: Update ConnectorService — remove services logic

**Files:**
- Modify: `backend/src/connector/connector.service.ts`

- [ ] **Step 1: Read existing file and update**

Read `C:\Users\doanp\Documents\GitHub\960513\backend\src\connector\connector.service.ts`. Remove all references to `services`. The `upsert` and `update` methods should no longer handle `dto.services`:

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
    const data: Record<string, unknown> = {};
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.name) data.account = JSON.stringify({ name: dto.name });

    if (existing) {
      return this.prisma.connector.update({ where: { id: existing.id }, data });
    }
    return this.prisma.connector.create({
      data: { ...data, type } as any,
    });
  }

  async update(id: string, dto: UpdateConnectorDto) {
    const data: Record<string, unknown> = {};
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.name !== undefined) data.account = JSON.stringify({ name: dto.name });
    return this.prisma.connector.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.connector.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/src/connector/connector.service.ts
git commit -m "refactor: remove services logic from connector service"
```

---

### Task 4: Update GoogleOAuthService — dynamic scopes by type

**Files:**
- Modify: `backend/src/connector/providers/google/google-oauth.service.ts`

- [ ] **Step 1: Read existing file and update**

Add scope mapping and accept `type` parameter:

```ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConnectorService } from '../../connector.service';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

const SCOPE_MAP: Record<string, string[]> = {
  google_gmail: ['https://mail.google.com/'],
  google_calendar: ['https://www.googleapis.com/auth/calendar'],
  google_drive: ['https://www.googleapis.com/auth/drive'],
};

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly connector: ConnectorService) {}

  private getClient(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  }

  getScopes(type: string): string[] {
    return SCOPE_MAP[type] ?? [];
  }

  getAuthUrl(type: string, config: { clientId: string; clientSecret: string; redirectUri: string }): string {
    const client = this.getClient(config);
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: this.getScopes(type),
      prompt: 'consent',
    });
  }

  async handleCallback(code: string, config: { clientId: string; clientSecret: string; redirectUri: string }): Promise<GoogleTokens> {
    const client = this.getClient(config);
    const { tokens } = await client.getToken(code);
    return tokens as GoogleTokens;
  }

  async getAuthenticatedClient(type: string, config: { clientId: string; clientSecret: string; redirectUri: string }) {
    const connector = await this.connector.findByType(type);
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

- [ ] **Step 2: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/src/connector/providers/google/google-oauth.service.ts
git commit -m "refactor: add dynamic scope mapping by connector type"
```

---

### Task 5: Update ConnectorController — generic OAuth endpoints

**Files:**
- Modify: `backend/src/connector/connector.controller.ts`

- [ ] **Step 1: Read existing file and update**

Replace hardcoded `google/auth-url` + `google/callback` with generic `oauth/auth-url` + `oauth/callback`:

```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

@Controller('connectors')
export class ConnectorController {
  constructor(
    private readonly connector: ConnectorService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

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

  @Get('oauth/auth-url')
  async oauthAuthUrl(
    @Query('type') type: string,
    @Query('clientId') clientId: string,
    @Query('clientSecret') clientSecret: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    return { url: this.googleOAuth.getAuthUrl(type, { clientId, clientSecret, redirectUri }) };
  }

  @Get('oauth/callback')
  async oauthCallback(
    @Query('type') type: string,
    @Query('code') code: string,
    @Query('clientId') clientId: string,
    @Query('clientSecret') clientSecret: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    const tokens = await this.googleOAuth.handleCallback(code, { clientId, clientSecret, redirectUri });
    const names: Record<string, string> = {
      google_gmail: 'Gmail',
      google_calendar: 'Google Calendar',
      google_drive: 'Google Drive',
    };
    await this.connector.upsert(type, {
      type,
      name: names[type] ?? type,
      config: { clientId, clientSecret, redirectUri, tokens },
      enabled: true,
    });
    return { ok: true };
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/src/connector/connector.controller.ts
git commit -m "refactor: replace hardcoded OAuth endpoints with generic type-based endpoints"
```

---

### Task 6: Update 3 services — fix findByType

**Files:**
- Modify: `backend/src/connector/providers/google/gmail.service.ts`
- Modify: `backend/src/connector/providers/google/google-calendar.service.ts`
- Modify: `backend/src/connector/providers/google/google-drive.service.ts`

- [ ] **Step 1: Update GmailService**

Read `C:\Users\doanp\Documents\GitHub\960513\backend\src\connector\providers\google\gmail.service.ts`. Replace `this.googleOAuth.getAuthenticatedClient({...})` call — pass `'google_gmail'` as first arg:

```ts
    const auth = await this.googleOAuth.getAuthenticatedClient('google_gmail', {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
    });
```

- [ ] **Step 2: Update GoogleCalendarService**

Read `C:\Users\doanp\Documents\GitHub\960513\backend\src\connector\providers\google\google-calendar.service.ts`. Change the `getAuthenticatedClient` call to pass `'google_calendar'`:

```ts
    const auth = await this.googleOAuth.getAuthenticatedClient('google_calendar', {
      clientId: '', clientSecret: '', redirectUri: '',
    });
```

- [ ] **Step 3: Update GoogleDriveService**

Read `C:\Users\doanp\Documents\GitHub\960513\backend\src\connector\providers\google\google-drive.service.ts`. Change the `getAuthenticatedClient` call to pass `'google_drive'`:

```ts
    const auth = await this.googleOAuth.getAuthenticatedClient('google_drive', {
      clientId: '', clientSecret: '', redirectUri: '',
    });
```

- [ ] **Step 4: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\backend && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/src/connector/providers/google/
git commit -m "refactor: update 3 services to use per-type connector lookup"
```

---

### Task 7: Update ConnectorsView.vue — 3 separate rows

**Files:**
- Modify: `frontend/src/components/ConnectorsView.vue`

- [ ] **Step 1: Read and rewrite**

Replace content with 3 separate Google service rows, no sub-service expansion:

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in displayConnectors" :key="connector.type" class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border mb-2 bg-cyber-dark">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-mono" :class="connector.enabled ? 'text-cyber-green' : 'text-cyber-muted'">
              {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
            </span>
            <button v-if="!connector.enabled" @click="connect(connector.type)"
              class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-cyber-accent/40 hover:text-cyber-accent transition-colors duration-150">
              {{ t('connectors.connect') }}
            </button>
            <button v-if="connector.enabled" @click="disconnect(connector)"
              class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-red-400/40 hover:text-red-400 transition-colors duration-150">
              {{ t('connectors.disconnect') }}
            </button>
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
  config: string
  account: string | null
  enabled: boolean
}

const connectors = ref<Connector[]>([])

const connectorTemplates = [
  { type: 'google_gmail', name: 'Gmail' },
  { type: 'google_calendar', name: 'Google Calendar' },
  { type: 'google_drive', name: 'Google Drive' },
]

const displayConnectors = computed(() => {
  return connectorTemplates.map(t => {
    const saved = connectors.value.find(c => c.type === t.type)
    return saved ?? {
      id: '',
      name: t.name,
      type: t.type,
      config: '{}',
      account: null,
      enabled: false,
    }
  })
})

onMounted(async () => {
  await fetchConnectors()
})

async function fetchConnectors() {
  try {
    const res = await fetch('/api/connectors')
    if (res.ok) connectors.value = await res.json()
  } catch {}
}

async function connect(type: string) {
  const clientId = prompt('Enter Google Client ID:')
  if (!clientId) return
  const clientSecret = prompt('Enter Google Client Secret:')
  if (!clientSecret) return
  const redirectUri = window.location.origin + '/api/connectors/oauth/callback'

  try {
    const res = await fetch(`/api/connectors/oauth/auth-url?type=${encodeURIComponent(type)}&clientId=${encodeURIComponent(clientId)}&clientSecret=${encodeURIComponent(clientSecret)}&redirectUri=${encodeURIComponent(redirectUri)}`)
    const data = await res.json()
    if (data.url) {
      window.open(data.url, '_blank')
      setTimeout(() => fetchConnectors(), 5000)
    }
  } catch {}
}

async function disconnect(connector: Connector) {
  await fetch(`/api/connectors/${connector.id}`, { method: 'DELETE' })
  await fetchConnectors()
}
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd C:\Users\doanp\Documents\GitHub\960513\frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add frontend/src/components/ConnectorsView.vue
git commit -m "refactor: split Google connector into 3 separate connector rows"
```

---

### Task 8: Update AGENTS.md and backend AGENTS

**Files:**
- Modify: `backend/AGENTS.md`
- Modify: `backend/src/connector/AGENTS.md`

- [ ] **Step 1: Update backend/AGENTS.md**

Remove `services` from Connector model description.

- [ ] **Step 2: Update connector/AGENTS.md**

Update the data model section to remove `services` field. Update API endpoints table.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\doanp\Documents\GitHub\960513
git add backend/AGENTS.md backend/src/connector/AGENTS.md
git commit -m "docs: update AGENTS.md for per-service connector model"
```
