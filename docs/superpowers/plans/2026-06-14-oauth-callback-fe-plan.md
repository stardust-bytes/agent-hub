# OAuth Callback FE Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect OAuth callback from backend API endpoint to frontend route, so the popup tab shows proper UI feedback and auto-closes after reloading the parent tab.

**Architecture:** Backend exposes `POST /api/connectors/oauth/confirm` for token exchange. Frontend handles the callback at `/oauth/callback`, calls the confirm API, then reloads the opener and closes the popup.

**Tech Stack:** NestJS (backend), Vue 3 + vue-router (frontend), Google OAuth2

---

### Task 1: Create OAuthConfirmDto DTO

**Files:**
- Create: `backend/src/connector/dto/oauth-confirm.dto.ts`

- [ ] **Step 1: Create OAuthConfirmDto**

```typescript
import { IsString } from 'class-validator';

export class OAuthConfirmDto {
  @IsString()
  state: string;

  @IsString()
  code: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/connector/dto/oauth-confirm.dto.ts
git commit -m "feat: add OAuthConfirmDto DTO for OAuth confirmation endpoint"
```

---

### Task 2: Add POST /oauth/confirm endpoint and remove GET /oauth/callback

**Files:**
- Modify: `backend/src/connector/connector.controller.ts`
- Test: `backend/src/connector/connector.controller.spec.ts`

- [ ] **Step 1: Write the controller spec**

```typescript
import { Test } from '@nestjs/testing';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

let controller: ConnectorController;

const mockConnectorService = {
  upsert: jest.fn().mockResolvedValue({ id: '1', type: 'google_sheets', enabled: true }),
};

const mockGoogleOAuthService = {
  getAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?state=google_sheets&...'),
  handleCallback: jest.fn().mockResolvedValue({ access_token: 'abc', refresh_token: 'def', expiry_date: 999 }),
};

describe('ConnectorController', () => {
  beforeAll(() => {
    process.env.GOOGLE_SHEETS_CLIENT_ID = 'test-id';
    process.env.GOOGLE_SHEETS_CLIENT_SECRET = 'test-secret';
  });

  afterAll(() => {
    delete process.env.GOOGLE_SHEETS_CLIENT_ID;
    delete process.env.GOOGLE_SHEETS_CLIENT_SECRET;
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ConnectorController],
      providers: [
        { provide: ConnectorService, useValue: mockConnectorService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuthService },
      ],
    }).compile();
    controller = module.get<ConnectorController>(ConnectorController);
    jest.clearAllMocks();
  });

  it('oauthConfirm returns ok for valid state and code', async () => {
    const result = await controller.oauthConfirm({ state: 'google_sheets', code: 'auth-code-123' });
    expect(result).toEqual({ ok: true });
    expect(mockGoogleOAuthService.handleCallback).toHaveBeenCalledWith('auth-code-123', {
      clientId: 'test-id',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:17135/oauth/callback',
    });
    expect(mockConnectorService.upsert).toHaveBeenCalledWith('google_sheets', {
      type: 'google_sheets',
      name: 'Google Sheets',
      config: expect.objectContaining({ tokens: { access_token: 'abc', refresh_token: 'def', expiry_date: 999 } }),
      enabled: true,
    });
  });

  it('oauthConfirm returns error for unknown type', async () => {
    const result = await controller.oauthConfirm({ state: 'unknown_type', code: 'code' });
    expect(result).toEqual({ error: 'unknown_type', state: 'unknown_type' });
    expect(mockGoogleOAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('oauthConfirm returns error for missing client credentials', async () => {
    delete process.env.GOOGLE_SHEETS_CLIENT_ID;
    delete process.env.GOOGLE_SHEETS_CLIENT_SECRET;
    const result = await controller.oauthConfirm({ state: 'google_sheets', code: 'code' });
    expect(result).toEqual({ error: 'missing_credentials', type: 'google_sheets' });
    expect(mockGoogleOAuthService.handleCallback).not.toHaveBeenCalled();
    process.env.GOOGLE_SHEETS_CLIENT_ID = 'test-id';
    process.env.GOOGLE_SHEETS_CLIENT_SECRET = 'test-secret';
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest backend/src/connector/connector.controller.spec.ts`
Expected: FAIL — "controller.oauthConfirm is not a function"

- [ ] **Step 3: Update controller — add POST confirm, remove GET callback, update redirectUri**

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { OAuthConfirmDto } from './dto/oauth-confirm.dto';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

@Controller('connectors')
export class ConnectorController {
  constructor(
    private readonly connector: ConnectorService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  private getCreds(type: string) {
    const map: Record<string, { clientId: string; clientSecret: string }> = {
      google_gmail: {
        clientId: process.env.GOOGLE_GMAIL_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
      },
      google_calendar: {
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
      },
      google_drive: {
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? '',
      },
      google_sheets: {
        clientId: process.env.GOOGLE_SHEETS_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_SHEETS_CLIENT_SECRET ?? '',
      },
    };
    return map[type] ?? null;
  }

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
  async oauthAuthUrl(@Query('type') type: string) {
    const creds = this.getCreds(type);
    if (!creds) return { error: 'unknown_type', type };
    const redirectUri = `${process.env.APP_URL ?? 'http://localhost:17135'}/oauth/callback`;
    return { url: this.googleOAuth.getAuthUrl(type, { ...creds, redirectUri }) };
  }

  @Post('oauth/confirm')
  async oauthConfirm(@Body() body: OAuthConfirmDto) {
    const { state, code } = body;
    const type = state;
    const creds = this.getCreds(type);
    if (!creds) return { error: 'unknown_type', state };
    if (!creds.clientId || !creds.clientSecret) {
      return { error: 'missing_credentials', type };
    }
    const redirectUri = `${process.env.APP_URL ?? 'http://localhost:17135'}/oauth/callback`;
    const tokens = await this.googleOAuth.handleCallback(code, { ...creds, redirectUri });
    const names: Record<string, string> = {
      google_gmail: 'Gmail',
      google_calendar: 'Google Calendar',
      google_drive: 'Google Drive',
      google_sheets: 'Google Sheets',
    };
    await this.connector.upsert(type, {
      type,
      name: names[type] ?? type,
      config: { ...creds, redirectUri, tokens },
      enabled: true,
    });
    return { ok: true };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest backend/src/connector/connector.controller.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/connector/connector.controller.ts backend/src/connector/connector.controller.spec.ts
git commit -m "feat: add POST oauth/confirm endpoint, remove GET oauth/callback, update redirectUri to FE route"
```

---

### Task 3: Add i18n keys for OAuth callback page

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add to vi.json**

Insert after line 50 (`"connectors.oauth_failed"`):

```json
  "connectors.oauth_confirm_failed": "Xác thực OAuth thất bại",

  "oauth.callback.loading": "⟳ đang xác thực...",
  "oauth.callback.success": "✔ Đã kết nối!",
  "oauth.callback.error": "[lỗi] {msg}",
  "oauth.callback.missing_params": "Thiếu thông tin xác thực. Vui lòng thử lại.",
  "oauth.callback.no_opener": "Đã kết nối!",
  "oauth.callback.close": "Đóng",
  "oauth.callback.back": "Về trang Kết nối",
```

- [ ] **Step 2: Add to en.json**

Insert after line 50 (`"connectors.oauth_failed"`):

```json
  "connectors.oauth_confirm_failed": "OAuth confirmation failed",

  "oauth.callback.loading": "⟳ authenticating...",
  "oauth.callback.success": "✔ Connected!",
  "oauth.callback.error": "[error] {msg}",
  "oauth.callback.missing_params": "Missing authentication parameters. Please try again.",
  "oauth.callback.no_opener": "Connected!",
  "oauth.callback.close": "Close",
  "oauth.callback.back": "Go to Connectors",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add OAuth callback i18n keys"
```

---

### Task 4: Add confirmOAuth API function

**Files:**
- Modify: `frontend/src/api/connectors.ts`

- [ ] **Step 1: Add confirmOAuth function**

```typescript
export function confirmOAuth(state: string, code: string) {
  return request<{ ok: boolean }>('/connectors/oauth/confirm', {
    method: 'POST',
    body: { state, code },
    errorCode: 'connectors.oauth_confirm_failed',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/connectors.ts
git commit -m "feat: add confirmOAuth API function"
```

---

### Task 5: Add /oauth/callback route

**Files:**
- Modify: `frontend/src/router/index.ts`

- [ ] **Step 1: Add route before catch-all**

```typescript
import OAuthCallbackPage from '../components/OAuthCallbackPage.vue'

// Add after line 22 (settings route), before the catch-all:
  { path: '/oauth/callback', name: 'oauth-callback', component: OAuthCallbackPage },
```

Complete routes array becomes:

```typescript
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/cowork' },
  { path: '/cowork', name: 'cowork', component: CoworkView },
  { path: '/tasks', name: 'tasks', component: ScheduleTasksView },
  { path: '/tasks/:id', name: 'task-detail', component: ScheduleTaskDetailView, props: true },
  { path: '/notes', name: 'notes', component: NotesView },
  { path: '/connectors', name: 'connectors', component: ConnectorsView },
  { path: '/agent-output', name: 'agent-output', component: AgentOutputView },
  { path: '/plans', name: 'plans', component: PlansView },
  { path: '/oauth/callback', name: 'oauth-callback', component: OAuthCallbackPage },
  { path: '/settings', redirect: '/settings/general' },
  { path: '/settings/:tab', name: 'settings', component: SettingsView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/cowork' },
]
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/router/index.ts
git commit -m "feat: add /oauth/callback route"
```

---

### Task 6: Create OAuthCallbackPage component

**Files:**
- Create: `frontend/src/components/OAuthCallbackPage.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-cyber-bg">
    <div v-if="status === 'loading'" class="text-cyber-accent font-mono text-sm">
      {{ t('oauth.callback.loading') }}
    </div>
    <div v-else-if="status === 'success'" class="text-cyber-green font-mono text-sm">
      {{ t('oauth.callback.success') }}
    </div>
    <div v-else class="flex flex-col items-center gap-3">
      <div class="text-red-400 font-mono text-sm">{{ t('oauth.callback.error', { msg: errorMsg }) }}</div>
      <router-link v-if="showBackLink" to="/connectors"
        class="text-cyber-accent font-mono text-sm border border-cyber-accent/30 px-2 py-0.5 transition-colors duration-150 hover:bg-cyber-accent/10">
        {{ t('oauth.callback.back') }}
      </router-link>
      <button v-else @click="handleClose"
        class="text-cyber-muted font-mono text-sm border border-cyber-code-border px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent">
        {{ t('oauth.callback.close') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { confirmOAuth } from '../api/connectors'

const { t } = useI18n()
const route = useRoute()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMsg = ref('')
const showBackLink = ref(false)

onMounted(async () => {
  const state = route.query.state as string | undefined
  const code = route.query.code as string | undefined

  if (!state || !code) {
    status.value = 'error'
    errorMsg.value = t('oauth.callback.missing_params')
    showBackLink.value = !window.opener
    return
  }

  try {
    await confirmOAuth(state, code)
    status.value = 'success'
    if (window.opener) {
      window.opener.location.reload()
      setTimeout(() => window.close(), 500)
    } else {
      showBackLink.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : t('connectors.oauth_confirm_failed')
    showBackLink.value = !window.opener
  }
})

function handleClose() {
  if (window.opener) {
    window.close()
  } else {
    showBackLink.value = true
  }
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/OAuthCallbackPage.vue
git commit -m "feat: add OAuthCallbackPage component for handling OAuth redirect"
```

---

### Task 7: Update ConnectorsView — remove poll, handle popup block

**Files:**
- Modify: `frontend/src/components/ConnectorsView.vue`

- [ ] **Step 1: Remove poll timeout and add popup block detection**

```typescript
async function connect(type: string) {
  try {
    const data = await getOAuthUrl(type)
    if (data.url) {
      const popup = window.open(data.url, '_blank')
      if (!popup) {
        // popup blocked — user will handle manually
      }
    }
  } catch {}
}
```

Remove the line:
```typescript
      setTimeout(() => connectorsStore.load(), 5000)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ConnectorsView.vue
git commit -m "feat: remove polling in ConnectorsView, use popup auto-reload instead"
```

---

### Task 8: Update AGENTS.md

**Files:**
- Modify: `backend/src/connector/AGENTS.md`

- [ ] **Step 1: Update API endpoints table**

Change the OAuth callback row from:
```
| `GET` | `/api/connectors/oauth/callback` | Handle OAuth callback (query: type, code, clientId, clientSecret, redirectUri) |
```
To:
```
| `POST` | `/api/connectors/oauth/confirm` | Confirm OAuth after FE callback (body: { state, code }) |
```

- [ ] **Step 2: Update dto file listing**

Add `oauth-confirm.dto.ts` to the dto/ listing:
```
│   ├── upsert-connector.dto.ts   — @IsString, @IsOptional, @IsBoolean, @IsArray, @IsObject
│   ├── update-connector.dto.ts   — PartialType(UpsertConnectorDto)
│   └── oauth-confirm.dto.ts      — @IsString state, @IsString code
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connector/AGENTS.md
git commit -m "docs: update AGENTS.md with new OAuth confirm endpoint"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run backend tests**

Run: `npx jest backend/src/connector`
Expected: PASS

- [ ] **Step 2: Run full backend tests**

Run: `npx jest`
Expected: all existing tests still pass

- [ ] **Step 3: Run frontend type check**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No type errors
