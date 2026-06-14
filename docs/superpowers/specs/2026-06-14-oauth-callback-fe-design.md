# OAuth Callback: BE → FE Redirect Design

## Status: DRAFT

## Problem

Currently, the OAuth callback for connecting Google accounts (Gmail, Calendar, Drive, Sheets) redirects directly to the NestJS backend endpoint `/api/connectors/oauth/callback`. The popup tab then displays raw JSON `{ ok: true }`. This is poor UX — no visual feedback, no error handling in the popup, and the original tab relies on polling to detect the new connection.

## Goal

Redirect the OAuth callback to the frontend, which handles the confirmation call to the backend and provides proper UI feedback, then auto-closes the popup and reloads the origin tab.

## Architecture

### New Flow

```
Frontend                         Backend                          Google
   │                               │                                │
   │ GET /api/connectors/          │                                │
   │   oauth/auth-url?type=xxx     │                                │
   │ ────────────────────────────►  │                                │
   │ ◄─── { url } ─────────────────│                                │
   │                               │                                │
   │ window.open(url, '_blank')     │                                │
   │ ───────────────────────────────────────────────────────────► Google OAuth UI
   │                               │                                │
   │       Google redirects to:    │                                │
   │   /oauth/callback?state=xxx   │                                │
   │   &code=AUTH_CODE             │                                │
   │ ◄──────────────────────────────────────────────────────────────│
   │                               │                                │
   │ OAuthCallbackPage.vue         │                                │
   │ reads state + code from URL   │                                │
   │                               │                                │
   │ POST /api/connectors/         │                                │
   │   oauth/confirm               │                                │
   │ { state: "xxx",               │                                │
   │   code: "AUTH_CODE" }         │                                │
   │ ────────────────────────────►  │                                │
   │                               │ Exchange code → tokens          │
   │                               │ Upsert connector in DB          │
   │ ◄─── { ok: true } ────────────│                                │
   │                               │                                │
   │ window.opener.location        │                                │
   │   .reload()                   │                                │
   │ window.close()                │                                │
   │ (popup closes, main tab       │                                │
   │  reloads with new connector)  │                                │
```

### Changes: Backend

#### 1. New endpoint: `POST /api/connectors/oauth/confirm`

- **Route:** `POST /api/connectors/oauth/confirm`
- **DTO:**
  ```typescript
  // OAuthConfirmDto
  @IsString() state: string;   // connector type (google_gmail, google_sheets, etc.)
  @IsString() code: string;    // Google OAuth authorization code
  ```
- **Controller logic:** extract `state` (type) + `code`, call `GoogleOAuthService.handleCallback()`, upsert connector, return `{ ok: true }` or `{ error: '...' }`
- **Validation:** Validate `type` against known `CREDENTIALS` keys; reject unknown types

#### 2. Remove old callback endpoint

- Remove `GET /api/connectors/oauth/callback` handler (no longer needed)

#### 3. Update redirectUri in `GET /api/connectors/oauth/auth-url`

- Change from:
  ```
  `${APP_URL}/api/connectors/oauth/callback`
  ```
- To:
  ```
  `${APP_URL}/oauth/callback`
  ```

### Changes: Frontend

#### 1. New API function (`frontend/src/api/connectors.ts`)

```typescript
export function confirmOAuth(state: string, code: string) {
  return request<{ ok: boolean }>('/connectors/oauth/confirm', {
    method: 'POST',
    body: { state, code },
    errorCode: 'connectors.oauth_failed',
  })
}
```

#### 2. New Vue route (`frontend/src/router/index.ts`)

```typescript
{
  path: '/oauth/callback',
  name: 'OAuthCallback',
  component: () => import('@/components/OAuthCallbackPage.vue'),
}
```

#### 3. New component `OAuthCallbackPage.vue`

- **States:**
  - `loading`: Hiển thị `"⟳ đang xác thực..."`
  - `success`: Hiển thị `"✔ Đã kết nối!"`, gọi `window.opener.location.reload()`, sau 500ms gọi `window.close()`
  - `error`: Hiển thị `"[lỗi] {error}"` + nút "Đóng" để user tự đóng
- **Edge cases:**
  - Thiếu `state`/`code` query params → hiển thị lỗi với link "Quay lại"
  - Không có `window.opener` (truy cập trực tiếp, không qua popup) → hiển thị link "Về trang Connectors"
  - API confirm thất bại → hiển thị lỗi, không reload tab gốc

#### 4. Update `ConnectorsView.vue`

- Remove `setTimeout(() => connectorsStore.load(), 5000)` — không cần polling nữa
- Popup reload tab gốc sau callback, nên store tự refresh

### Error Handling

| Scenario | Popup Behavior | Tab gốc |
|---|---|---|
| Confirm thành công | Hiển thị "Đã kết nối", reload tab gốc, tự đóng | Reload |
| Confirm thất bại | Hiển thị lỗi, user tự đóng | Không đổi |
| Thiếu params | Hiển thị lỗi + link về trang chủ | Không đổi |
| Popup bị chặn | Thông báo lỗi ở ConnectorsView | Không đổi |
| Truy cập trực tiếp (không popup) | Hiển thị link "Về trang Connectors" | N/A |

### i18n Keys

New keys added to `frontend/src/locales/{vi,en}.json`:

| Key | vi | en |
|---|---|---|
| `oauth.callback.loading` | `⟳ đang xác thực...` | `⟳ authenticating...` |
| `oauth.callback.success` | `✔ Đã kết nối!` | `✔ Connected!` |
| `oauth.callback.error` | `[lỗi] {msg}` | `[error] {msg}` |
| `oauth.callback.missing_params` | `Thiếu thông tin xác thực. Vui lòng thử lại.` | `Missing authentication parameters. Please try again.` |
| `oauth.callback.no_opener` | `Đã kết nối! Về trang Connectors` | `Connected! Go to Connectors` |
| `oauth.callback.close` | `Đóng` | `Close` |
| `oauth.callback.back` | `Quay lại` | `Go back` |
| `connectors.oauth_confirm_failed` | `Xác thực OAuth thất bại` | `OAuth confirmation failed` |

### Testing

#### BE unit test (`connector.controller.spec.ts`)
- **Success case:** POST với `state=google_sheets` + `code=valid_code` → expect `{ ok: true }`
- **Invalid type:** POST với `state=unknown_type` → expect 400 error
- **Missing params:** POST với body `{}` → expect 400 (ValidationPipe)
- **Code exchange fails:** Mock `GoogleOAuthService.handleCallback` throws → expect 500

#### FE manual test
- Connect Gmail/Sheets/Drive/Calendar → popup hiển thị loading → success → popup tự đóng → tab gốc reload
- Tắt popup blocker → verify thông báo lỗi
- Truy cập trực tiếp `/oauth/callback?state=xxx&code=yyy` (không popup) → thấy link "Về trang Connectors"
