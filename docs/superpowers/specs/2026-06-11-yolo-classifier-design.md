# YOLO Classifier Design

## Overview

AI-powered 2-stage security classifier for the agent permission system. Evaluates every tool call in Auto Mode before execution using a side-query to the LLM with a specialized security prompt. Pattern-based pre-filter catches dangerous commands without an LLM call. Fail-closed by default. Inspired by Claude Code's YOLO Classifier.

## Permission Modes

Added to `mode-policy.config.ts` `ModePolicyEntry`:

| Mode | Behavior |
|---|---|
| `default` | Ask user on sensitive operations (current behavior, unchanged) |
| `acceptEdits` | Auto-approve Read/Write/Edit file ops. Shell/network still prompt |
| `bypassPermissions` | Auto-approve ALL tool calls. No safety checks |
| `dontAsk` | Auto-deny any tool that would normally prompt |
| `auto` | YOLO 2-stage classifier decides allow/deny without asking |
| `plan` | Restricted tool access + classifier if active |

## Flow

```
Tool call
  → ModePolicy: isToolAllowed(mode, toolName)? → DENY → toolResult denial SSE
  → ALLOW: check runtime permission config
    → deniedTools includes tool? → DENY
    → allowedTools includes tool? → ALLOW
    → Mode dispatch:
      bypassPermissions → ALLOW
      dontAsk → DENY
      acceptEdits → file ops ALLOW, rest → ASK
      auto → YOLO classifier
      default → ASK user
    → YOLO flow:
      1. Safe tool allowlist? → ALLOW
      2. Danger pattern match? → skip Stage 1 → Stage 2
      3. Stage 1 (64 tokens): <block>no → ALLOW, <block>yes → Stage 2
      4. Stage 2 (4096 tokens): <block>no → ALLOW, <block>yes → DENY
      5. API error → DENY (fail-closed)
      6. Denial limit exceeded → ASK user
```

## YOLO Classifier Engine

`backend/src/agent/services/yolo-classifier.service.ts`

### Fast Paths (skip classifier)

Tools deemed always safe: `Read`, `Greptool`, `Glob`, task read-only tools (list_tasks, get_task, list_notes), `AskUserQuestion`, `TodoWrite`. Write/Edit use acceptEdits fast path instead.

### Danger Pattern Detection

`backend/src/agent/services/danger-patterns.config.ts`

28 block rule categories as regex patterns:

| Category | Tools | Patterns |
|---|---|---|
| Interpreters | bash | python, node, deno, ruby, php, lua |
| Package runners | bash | npx, bunx, npm run, yarn run |
| Shells | bash | sh, ssh |
| Eval/exec | bash | eval, exec, sudo |
| Network | bash | curl, wget |
| Cloud CLIs | bash | kubectl, aws, gcloud, gh |
| Git destructive | bash | git push --force, git branch -D |
| Irreversible | bash | rm -rf /, DROP TABLE |
| Write scripts | write_file | *.sh/*.bat/*.ps1 + dangerous content |
| Permission bypass | spawn_subagent | bypass, override, admin |

Pattern match → skip Stage 1, go directly to Stage 2 (deep reasoning).

### Tool Encoding

Each tool controls what the classifier sees via encoding:

| Tool | Encoding Format | Example |
|---|---|---|
| bash | `input.command` | "npm test" |
| web_fetch | `input.url` | "https://example.com" |
| write_file | `file_path: first_line` | "src/main.ts: import..." |
| spawn_subagent | `(mode): task` | "(agent): Fix bug..." |
| create_task | `title: desc` | "Fix auth: update login flow" |
| web_search | `input.query` | "python best practices" |
| Safe tools | `''` (empty) | Skip classifier |

### 2-Stage Classifier

#### Stage 1 (Fast)

- max_tokens: 64
- temperature: 0
- stop_sequences: `['</block>']`
- Prompt suffix: "Err on the side of blocking. <block> immediately."
- Result: `<block>no` → ALLOW, `<block>yes` → escalate to Stage 2
- Unparseable → go to Stage 2

#### Stage 2 (Deep)

- max_tokens: 4096
- temperature: 0
- Prompt includes: `Use <thinking> before responding.`
- Full chain-of-thought reasoning
- Result: `<block>no` → ALLOW, `<block>yes` → DENY
- Unparseable → DENY

#### Classifier Modes

| Mode | Behavior |
|---|---|
| `both` (default) | Stage 1 first, Stage 2 only if Stage 1 blocks |
| `fast` | Stage 1 only (max_tokens=256, no stop) |
| `thinking` | Stage 2 only (skip Stage 1) |

### Denial Tracking

```ts
type DenialTracking = {
  consecutiveDenials: number  // resets on any ALLOW
  totalDenials: number        // never resets (per session)
}
```

- Max consecutive: 3
- Max total per session: 20
- On limit hit: fallback to asking user (CLI) or AbortError (headless)
- Any ALLOW (including fast-paths) resets consecutiveDenials

### Error Handling — Fail Closed

| Failure | Result |
|---|---|
| API error (429, 500) | DENY |
| Timeout | DENY |
| Unparseable (Stage 1) | Escalate to Stage 2 |
| Unparseable (Stage 2) | DENY |
| Transcript too long | ASK user |

## Auto Mode Config

Stored in `Setting` table under key `agent.yolo_config`:

```json
{
  "stage1MaxTokens": 64,
  "stage2MaxTokens": 4096,
  "denialMaxConsecutive": 3,
  "denialMaxTotal": 20,
  "enabledPatterns": ["interpreters", "package_runners", "shells", "eval", "network", "cloud_clis", "git_destructive", "irreversible"],
  "disabledPatterns": [],
  "safeToolAllowlist": true,
  "failClosed": true
}
```

## Integration

- `yolo-classifier.service.ts` called from `agent-loop.service.ts` after `PermissionsService.isAllowed` check
- New endpoint: `GET /api/agent/yolo-config` and `PATCH /api/agent/yolo-config`
- YOLO system prompt assembled from template in `yolo-classifier.constants.ts`
- Transcript built from conversation history (tool calls only, no assistant text)

## Frontend

- `PermissionView.vue` — new component, tab in Settings
- Mode selector dropdown (default/acceptEdits/bypassPermissions/dontAsk/auto/plan)
- Tool allow/deny list editor (for PermissionsService config)
- Block rule category toggles (28 rules, enable/disable per category)
- Denial history log
- YOLO config editor (token limits, thresholds)

## i18n Keys

```
permissions.mode.default     → "Default" / "Mặc định"
permissions.mode.acceptEdits → "Accept Edits" / "Chấp nhận sửa"
permissions.mode.bypass      → "Bypass All" / "Bỏ qua tất cả"
permissions.mode.dontAsk     → "Don't Ask" / "Không hỏi"
permissions.mode.auto        → "Auto (YOLO)" / "Tự động (YOLO)"
permissions.mode.plan        → "Plan" / "Kế hoạch"
permissions.yolo.config      → "YOLO Config" / "Cấu hình YOLO"
permissions.yolo.denials     → "Denial Log" / "Nhật ký từ chối"
permissions.rules.*          → Rule category toggle keys
```

## File Structure

```
backend/src/agent/services/
├── yolo-classifier.service.ts         — 2-stage classifier engine
├── yolo-classifier.service.spec.ts    — tests
├── danger-patterns.config.ts          — 28 block rule patterns
├── danger-patterns.config.spec.ts     — pattern tests
├── yolo-classifier.constants.ts       — system prompt templates
├── denial-tracking.ts                 — denial state management
└── denial-tracking.spec.ts            — denial tracking tests

backend/src/agent/dto/
├── yolo-config.dto.ts                 — update yolo config DTO
└── auto-mode-config.ts                — config type

frontend/src/components/
├── PermissionView.vue                 — permission management UI
└── PermissionConfig.vue               — YOLO config sub-component

frontend/src/locales/
├── vi.json                            — +permissions.* keys
└── en.json                            — +permissions.* keys
```

## Dependencies

- `agent-loop.service.ts` — integrate YOLO check before tool execution
- `permissions.service.ts` — mode dispatch integration
- `mode-policy.config.ts` — add new mode entries
- `agent.module.ts` — register YOLO classifier provider
- `agent.controller.ts` — add config endpoints

## Security Principles

1. **Deny by default** — any failure (API, parse, timeout) = DENY
2. **Explicit allow only** — only `<block>no` allows
3. **Assistant text excluded** — only tool calls in transcript, prevents self-influence
4. **Fail closed** — API errors deny, not fall back to prompting
5. **Human fallback** — 3 consecutive / 20 total blocks → return to user
6. **Two stages reduce false positives** — Stage 2 reviews Stage 1 blocks
7. **Project settings excluded** — `autoMode` config from project configs is ignored to prevent malicious injection
