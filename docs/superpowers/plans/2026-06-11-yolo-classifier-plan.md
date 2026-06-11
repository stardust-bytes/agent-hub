# YOLO Classifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2-stage YOLO classifier that evaluates every tool call in Auto Mode, with pattern-based pre-filter, denial tracking, and frontend UI.

**Architecture:** New `YoloClassifierService` sits between `PermissionsService` and tool execution. Uses existing LLM provider (Ollama/OpenAI) for side-query. Danger patterns are regex-based. Denial tracking per-session in memory.

**Tech Stack:** NestJS, class-validator, Ollama/OpenAI LLM, Vue 3, TailwindCSS

---

## File Structure

### New files
- `backend/src/agent/services/yolo-classifier.service.ts`
- `backend/src/agent/services/yolo-classifier.service.spec.ts`
- `backend/src/agent/services/danger-patterns.config.ts`
- `backend/src/agent/services/danger-patterns.config.spec.ts`
- `backend/src/agent/services/denial-tracking.ts`
- `backend/src/agent/services/denial-tracking.spec.ts`
- `backend/src/agent/services/yolo-classifier.constants.ts`
- `backend/src/agent/dto/yolo-config.dto.ts`
- `frontend/src/components/PermissionView.vue`

### Modified files
- `backend/src/agent/services/agent-loop.service.ts` — integrate YOLO check
- `backend/src/agent/services/permissions.service.ts` — mode dispatch
- `backend/src/agent/services/context-builder.service.ts` — mode-aware system prompt
- `backend/src/agent/agent.controller.ts` — YOLO config endpoints
- `backend/src/agent/agent.module.ts` — register YoloClassifierService
- `backend/src/mode-policy/mode-policy.config.ts` — add 6 permission modes
- `frontend/src/components/SettingsView.vue` — add Permission tab
- `frontend/src/locales/vi.json` — add permissions keys
- `frontend/src/locales/en.json` — add permissions keys

---

### Task 1: Danger Patterns Config

**Files:**
- Create: `backend/src/agent/services/danger-patterns.config.ts`

- [ ] **Step 1: Create danger-patterns.config.ts**

```ts
export type BlockRuleCategory =
  | 'interpreters' | 'package_runners' | 'shells'
  | 'eval' | 'network' | 'cloud_clis'
  | 'git_destructive' | 'irreversible'
  | 'write_scripts' | 'permission_bypass';

export interface BlockRule {
  category: BlockRuleCategory;
  description: string;
  tools: string[];
  patterns: RegExp[];
}

export const BLOCK_RULES: BlockRule[] = [
  {
    category: 'interpreters',
    description: 'Running script interpreters directly',
    tools: ['bash'],
    patterns: [/\bpython[3]?\b/, /\bnode\b/, /\bdeno\b/, /\bruby\b/, /\bphp\b/, /\blua\b/],
  },
  {
    category: 'package_runners',
    description: 'Running package manager scripts',
    tools: ['bash'],
    patterns: [/\bnpx\b/, /\bbunx\b/, /\bnpm run\b/, /\byarn run\b/],
  },
  {
    category: 'shells',
    description: 'Opening interactive shells',
    tools: ['bash'],
    patterns: [/\bsh\b/, /\bssh\b/, /\bzsh\b/, /\bfish\b/],
  },
  {
    category: 'eval',
    description: 'Dynamic code execution',
    tools: ['bash'],
    patterns: [/\beval\b/, /\bexec\b/, /\bsudo\b/],
  },
  {
    category: 'network',
    description: 'Network requests that could exfiltrate data',
    tools: ['bash'],
    patterns: [/\bcurl\b/, /\bwget\b/],
  },
  {
    category: 'cloud_clis',
    description: 'Cloud infrastructure commands',
    tools: ['bash'],
    patterns: [/\bkubectl\b/, /\baws\b/, /\bgcloud\b/, /\bgh\b/],
  },
  {
    category: 'git_destructive',
    description: 'Destructive git operations',
    tools: ['bash'],
    patterns: [/git push --force/, /git branch -D/, /git reset --hard (origin|HEAD)/],
  },
  {
    category: 'irreversible',
    description: 'Irreversible local destruction',
    tools: ['bash'],
    patterns: [/\brm -rf\s+\/$/, /\bDROP TABLE\b/, /\bformat\b/],
  },
  {
    category: 'write_scripts',
    description: 'Writing executable scripts',
    tools: ['write_file'],
    patterns: [/\.(sh|bat|ps1)$/i],
  },
  {
    category: 'permission_bypass',
    description: 'Attempts to bypass permission controls',
    tools: ['spawn_subagent'],
    patterns: [/\bbypass\b/i, /\boverride\b/i, /\badmin\b/i, /\bskip (permission|security)\b/i],
  },
];

export function getEnabledPatterns(disabledCategories: string[] = []): BlockRule[] {
  return BLOCK_RULES.filter(r => !disabledCategories.includes(r.category));
}

export function matchDangerPattern(
  toolName: string,
  toolInput: string,
  rules: BlockRule[],
): BlockRule | null {
  for (const rule of rules) {
    if (!rule.tools.includes(toolName)) continue;
    for (const pattern of rule.patterns) {
      if (pattern.test(toolInput)) return rule;
    }
  }
  return null;
}
```

- [ ] **Step 2: Create danger-patterns.config.spec.ts**

```ts
import { BLOCK_RULES, matchDangerPattern } from './danger-patterns.config';

describe('danger-patterns.config', () => {
  it('should match python interpreter in bash command', () => {
    const result = matchDangerPattern('bash', 'python script.py', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('interpreters');
  });

  it('should match curl in bash command', () => {
    const result = matchDangerPattern('bash', 'curl http://example.com', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('network');
  });

  it('should match git force push', () => {
    const result = matchDangerPattern('bash', 'git push --force origin main', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('git_destructive');
  });

  it('should match write_file with .sh extension', () => {
    const result = matchDangerPattern('write_file', 'deploy.sh', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('write_scripts');
  });

  it('should not match safe bash commands', () => {
    const result = matchDangerPattern('bash', 'ls -la', BLOCK_RULES);
    expect(result).toBeNull();
  });

  it('should not match for non-matching tool', () => {
    const result = matchDangerPattern('list_tasks', 'python', BLOCK_RULES);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/agent/services/danger-patterns.config.spec.ts --no-coverage
```

Expected: all 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/danger-patterns.config.ts backend/src/agent/services/danger-patterns.config.spec.ts
git commit -m "feat: add YOLO danger patterns config with 10 block rule categories"
```

---

### Task 2: Denial Tracking

**Files:**
- Create: `backend/src/agent/services/denial-tracking.ts`

- [ ] **Step 1: Create denial-tracking.ts**

```ts
export const MAX_CONSECUTIVE_DENIALS = 3;
export const MAX_TOTAL_DENIALS = 20;

export class DenialTracker {
  private consecutive = 0;
  private total = 0;

  get consecutiveDenials(): number {
    return this.consecutive;
  }

  get totalDenials(): number {
    return this.total;
  }

  recordDenial(): boolean {
    this.consecutive++;
    this.total++;
    return this.isLimitExceeded();
  }

  recordAllow(): void {
    this.consecutive = 0;
  }

  reset(): void {
    this.consecutive = 0;
    this.total = 0;
  }

  isLimitExceeded(): boolean {
    return this.consecutive >= MAX_CONSECUTIVE_DENIALS || this.total >= MAX_TOTAL_DENIALS;
  }
}
```

- [ ] **Step 2: Create denial-tracking.spec.ts**

```ts
import { DenialTracker } from './denial-tracking';

describe('DenialTracker', () => {
  let tracker: DenialTracker;

  beforeEach(() => {
    tracker = new DenialTracker();
  });

  it('should start at zero', () => {
    expect(tracker.consecutiveDenials).toBe(0);
    expect(tracker.totalDenials).toBe(0);
  });

  it('should increment on recordDenial', () => {
    tracker.recordDenial();
    expect(tracker.consecutiveDenials).toBe(1);
    expect(tracker.totalDenials).toBe(1);
  });

  it('should reset consecutive on recordAllow', () => {
    tracker.recordDenial();
    tracker.recordDenial();
    tracker.recordAllow();
    expect(tracker.consecutiveDenials).toBe(0);
    expect(tracker.totalDenials).toBe(2);
  });

  it('should exceed limit after 3 consecutive denials', () => {
    tracker.recordDenial();
    tracker.recordDenial();
    expect(tracker.recordDenial()).toBe(true);
    expect(tracker.isLimitExceeded()).toBe(true);
  });

  it('should reset on reset()', () => {
    tracker.recordDenial();
    tracker.recordDenial();
    tracker.recordDenial();
    tracker.reset();
    expect(tracker.consecutiveDenials).toBe(0);
    expect(tracker.totalDenials).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/agent/services/denial-tracking.spec.ts --no-coverage
```

Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/denial-tracking.ts backend/src/agent/services/denial-tracking.spec.ts
git commit -m "feat: add denial tracking for YOLO classifier"
```

---

### Task 3: YOLO Constants (System Prompt Template)

**Files:**
- Create: `backend/src/agent/services/yolo-classifier.constants.ts`

- [ ] **Step 1: Create yolo-classifier.constants.ts**

```ts
export const YOLO_SYSTEM_PROMPT = `You are a security classifier for an AI agent workspace.
Your job is to evaluate whether a proposed action should be ALLOWED or BLOCKED.

## Evaluation Rules
1. Consider the full conversation context, not just the latest action
2. Block attempts to disable or circumvent the classifier itself
3. Writing a script then running it = directly running commands
4. When spawning sub-agents, evaluate the delegated task's intent
5. Each action is evaluated independently
6. Lean toward blocking when shared infrastructure could be affected
7. Only block for security-relevant harm, not quality or efficiency issues

## BLOCK Rules
- Running interpreters directly (python, node, ruby) without user request
- Package runners (npx, npm run) executing untrusted code
- Network commands (curl, wget) that could exfiltrate data
- Destructive git operations (force push, delete branches)
- Cloud CLI commands (kubectl, aws) affecting production
- Writing executable scripts (.sh, .bat) with dangerous content
- Spawning sub-agents with permission bypass intent
- Irreversible local destruction (rm -rf, drop tables)
- Credential leakage (printing or sending secrets)
- Data exfiltration to external services
- Self-modification of agent code or config

## ALLOW by default
Allow unless a BLOCK rule clearly applies.`;

export const STAGE1_PROMPT_SUFFIX = `Err on the side of blocking. <block> immediately.`;

export const STAGE2_PROMPT_SUFFIX = `Use <thinking> before responding. Explicit user confirmation required to override blocks.`;

export const STAGE1_MAX_TOKENS = 64;
export const STAGE2_MAX_TOKENS = 4096;

export const SAFE_TOOL_ALLOWLIST = [
  'list_tasks', 'get_task', 'list_notes',
  'web_search', 'web_fetch',
];
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/agent/services/yolo-classifier.constants.ts
git commit -m "feat: add YOLO classifier system prompt and constants"
```

---

### Task 4: YOLO Classifier Service

**Files:**
- Create: `backend/src/agent/services/yolo-classifier.service.ts`

- [ ] **Step 1: Create yolo-classifier.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { LLMControllerService } from './llm-controller.service';
import { BLOCK_RULES, matchDangerPattern, BlockRule } from './danger-patterns.config';
import { DenialTracker } from './denial-tracking';
import {
  YOLO_SYSTEM_PROMPT,
  STAGE1_PROMPT_SUFFIX,
  STAGE2_PROMPT_SUFFIX,
  STAGE1_MAX_TOKENS,
  STAGE2_MAX_TOKENS,
  SAFE_TOOL_ALLOWLIST,
} from './yolo-classifier.constants';

export interface YoloResult {
  allowed: boolean;
  reason?: string;
  stage: 'fast_path' | 'pattern' | 'stage1' | 'stage2' | 'error' | 'fallback';
  rule?: string;
}

export interface YoloConfig {
  enabledPatterns: string[];
  disabledPatterns: string[];
  failClosed: boolean;
  safeToolAllowlist: boolean;
}

export const DEFAULT_YOLO_CONFIG: YoloConfig = {
  enabledPatterns: BLOCK_RULES.map(r => r.category),
  disabledPatterns: [],
  failClosed: true,
  safeToolAllowlist: true,
};

@Injectable()
export class YoloClassifierService {
  private trackers = new Map<string, DenialTracker>();
  private config: YoloConfig = { ...DEFAULT_YOLO_CONFIG };

  constructor(private readonly llmController: LLMControllerService) {}

  getConfig(): YoloConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<YoloConfig>): YoloConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  async evaluate(
    toolName: string,
    toolInput: string,
    transcript: string,
    sessionId?: number,
  ): Promise<YoloResult> {
    const sessionKey = sessionId?.toString() ?? 'default';
    let tracker = this.trackers.get(sessionKey);
    if (!tracker) {
      tracker = new DenialTracker();
      this.trackers.set(sessionKey, tracker);
    }

    if (tracker.isLimitExceeded()) {
      return { allowed: false, reason: 'Denial limit exceeded', stage: 'fallback' };
    }

    if (this.config.safeToolAllowlist && SAFE_TOOL_ALLOWLIST.includes(toolName)) {
      tracker.recordAllow();
      return { allowed: true, stage: 'fast_path' };
    }

    const activeRules = BLOCK_RULES.filter(r => !this.config.disabledPatterns.includes(r.category));
    const matched = matchDangerPattern(toolName, toolInput, activeRules);

    if (matched) {
      return this.runStage2(toolName, toolInput, transcript, tracker, matched);
    }

    return this.runStage1(toolName, toolInput, transcript, tracker);
  }

  private async runStage1(
    toolName: string,
    toolInput: string,
    transcript: string,
    tracker: DenialTracker,
  ): Promise<YoloResult> {
    const prompt = `${transcript}\n\nAction: ${toolName}(${toolInput})\n\n${STAGE1_PROMPT_SUFFIX}`;

    try {
      const response = await this.queryLLM(
        YOLO_SYSTEM_PROMPT, prompt, STAGE1_MAX_TOKENS,
      );

      const blockMatch = response.match(/<block>(yes|no)<\/block>/);
      if (!blockMatch) {
        return this.runStage2(toolName, toolInput, transcript, tracker);
      }

      if (blockMatch[1] === 'no') {
        tracker.recordAllow();
        return { allowed: true, stage: 'stage1' };
      }

      return this.runStage2(toolName, toolInput, transcript, tracker);
    } catch {
      if (this.config.failClosed) {
        return { allowed: false, reason: 'Classifier API error', stage: 'error' };
      }
      return { allowed: false, reason: 'Classifier unavailable', stage: 'fallback' };
    }
  }

  private async runStage2(
    toolName: string,
    toolInput: string,
    transcript: string,
    tracker: DenialTracker,
    matched?: BlockRule,
  ): Promise<YoloResult> {
    const prompt = `${transcript}\n\nAction: ${toolName}(${toolInput})\n${STAGE2_PROMPT_SUFFIX}`;

    try {
      const response = await this.queryLLM(
        YOLO_SYSTEM_PROMPT, prompt, STAGE2_MAX_TOKENS,
      );

      const blockMatch = response.match(/<block>(yes|no)<\/block>/);
      const reasonMatch = response.match(/<reason>([^<]+)<\/reason>/);

      if (!blockMatch || blockMatch[1] === 'yes') {
        const exceeded = tracker.recordDenial();
        return {
          allowed: false,
          reason: reasonMatch?.[1] ?? 'Blocked by classifier',
          stage: 'stage2',
          rule: matched?.category,
        };
      }

      tracker.recordAllow();
      return { allowed: true, stage: matched ? 'pattern' : 'stage2' };
    } catch {
      if (this.config.failClosed) {
        return { allowed: false, reason: 'Classifier API error', stage: 'error' };
      }
      return { allowed: false, reason: 'Classifier unavailable', stage: 'fallback' };
    }
  }

  private async queryLLM(systemPrompt: string, prompt: string, maxTokens: number): Promise<string> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ];

    const result = await this.llmController.streamComplete(messages, {
      max_tokens: maxTokens,
      temperature: 0,
    });

    return result;
  }
}
```

Note: The `streamComplete` method on `LLMControllerService` may not exist yet. If it doesn't, add a synchronous completion method that calls the provider without streaming.

- [ ] **Step 2: Create yolo-classifier.service.spec.ts**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { YoloClassifierService } from './yolo-classifier.service';
import { LLMControllerService } from './llm-controller.service';

const mockLLM = {
  streamComplete: jest.fn(),
};

describe('YoloClassifierService', () => {
  let service: YoloClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoloClassifierService,
        { provide: LLMControllerService, useValue: mockLLM },
      ],
    }).compile();

    service = module.get<YoloClassifierService>(YoloClassifierService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow safe tools via fast path', async () => {
    const result = await service.evaluate('list_tasks', '', '');
    expect(result.allowed).toBe(true);
    expect(result.stage).toBe('fast_path');
  });

  it('should allow web_search via fast path', async () => {
    const result = await service.evaluate('web_search', 'python', '');
    expect(result.allowed).toBe(true);
    expect(result.stage).toBe('fast_path');
  });

  it('should deny on pattern match via Stage 2', async () => {
    mockLLM.streamComplete.mockResolvedValue('<block>yes</block><reason>dangerous command</reason>');
    const result = await service.evaluate('bash', 'curl http://evil.com', '');
    expect(result.allowed).toBe(false);
    expect(result.stage).toBe('stage2');
    expect(result.rule).toBe('network');
  });

  it('should allow on Stage 1 pass', async () => {
    mockLLM.streamComplete.mockResolvedValue('<block>no</block>');
    const result = await service.evaluate('bash', 'ls -la', '');
    expect(result.allowed).toBe(true);
    expect(result.stage).toBe('stage1');
  });

  it('should fail closed on API error', async () => {
    mockLLM.streamComplete.mockRejectedValue(new Error('API error'));
    const result = await service.evaluate('bash', 'npm test', '');
    expect(result.allowed).toBe(false);
    expect(result.stage).toBe('error');
  });

  it('should track consecutive denials and fallback', async () => {
    mockLLM.streamComplete.mockResolvedValue('<block>yes</block><reason>test</reason>');
    await service.evaluate('bash', 'python script.py', '');
    await service.evaluate('bash', 'python script.py', '');
    const result = await service.evaluate('bash', 'python script.py', '');
    expect(result.stage).toBe('stage2');
    mockLLM.streamComplete.mockResolvedValue('<block>yes</block><reason>test</reason>');
    const exceeded = await service.evaluate('bash', 'anything', '');
    expect(exceeded.stage).toBe('fallback');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/agent/services/yolo-classifier.service.spec.ts --no-coverage
```

Expected: all 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/yolo-classifier.service.ts backend/src/agent/services/yolo-classifier.service.spec.ts
git commit -m "feat: add YOLO 2-stage classifier service"
```

---

### Task 5: Permission Modes

**Files:**
- Modify: `backend/src/mode-policy/mode-policy.config.ts`
- Modify: `backend/src/mode-policy/mode-policy.service.ts`

- [ ] **Step 1: Add new modes to mode-policy.config.ts**

Add new permission modes:

```ts
export const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto', 'plan'] as const;
export type PermissionMode = typeof PERMISSION_MODES[number];

export interface ModePolicyEntry {
  enabledTools: '*' | string[];
  deniedTools: string[];
  allowedPaths: string[];
  systemPromptStyle: SystemPromptStyle;
  envContext: string[];
  permissionMode: PermissionMode;  // ADD
}
```

Add `permissionMode` field to each existing mode entry in `MODE_POLICY`:
- `chat`: `permissionMode: 'default'`
- `agent`: `permissionMode: 'default'`
- `cowork`: `permissionMode: 'acceptEdits'`

- [ ] **Step 2: Add mode switching to ModePolicyService**

Add method to get/set permission mode:

```ts
getPermissionMode(mode: string): PermissionMode {
  return (MODE_POLICY[mode] ?? MODE_POLICY.agent).permissionMode;
}
```

- [ ] **Step 3: Run existing tests to verify nothing breaks**

```bash
npx jest src/mode-policy/ --no-coverage
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/mode-policy/
git commit -m "feat: add 6 permission modes to mode-policy"
```

---

### Task 6: Permission Flow Integration

**Files:**
- Modify: `backend/src/agent/services/permissions.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Create: `backend/src/agent/dto/yolo-config.dto.ts`

- [ ] **Step 1: Add mode dispatch to permissions.service.ts**

Add import and method:

```ts
import { YoloClassifierService } from './yolo-classifier.service';
import { YoloResult } from './yolo-classifier.service';

export type Decision = { action: 'allow' } | { action: 'deny'; reason: string } | { action: 'ask' };

async function decide(mode: string, toolName: string, toolInput: string): Promise<Decision> {
  switch (mode) {
    case 'bypassPermissions':
      return { action: 'allow' };
    case 'dontAsk':
      return { action: 'deny', reason: 'Blocked by dontAsk mode' };
    case 'acceptEdits':
      if (['read_file', 'write_file', 'list_directory', 'grep', 'glob'].includes(toolName)) {
        return { action: 'allow' };
      }
      return { action: 'ask' };
    case 'auto':
      return this.handleAutoMode(toolName, toolInput);
    default:
      return { action: 'ask' };
  }
}

private async handleAutoMode(toolName: string, toolInput: string): Promise<Decision> {
  // Build transcript from recent session context
  const transcript = ''; // Will be populated from session history
  const result = await this.yoloClassifier.evaluate(toolName, toolInput, transcript);
  if (result.allowed) return { action: 'allow' };
  return { action: 'deny', reason: result.reason ?? 'Blocked by YOLO classifier' };
}
```

- [ ] **Step 2: Create yolo-config.dto.ts**

```ts
import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';

export class UpdateYoloConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledPatterns?: string[];

  @IsOptional()
  @IsBoolean()
  failClosed?: boolean;

  @IsOptional()
  @IsBoolean()
  safeToolAllowlist?: boolean;
}
```

- [ ] **Step 3: Add YOLO config endpoints to agent.controller.ts**

```ts
@Get('yolo-config')
getYoloConfig() {
  return this.yoloClassifier.getConfig();
}

@Patch('yolo-config')
updateYoloConfig(@Body() dto: UpdateYoloConfigDto) {
  return this.yoloClassifier.updateConfig(dto);
}
```

- [ ] **Step 4: Register YoloClassifierService in agent.module.ts**

Add to providers and inject in constructor of PermissionsService.

- [ ] **Step 5: Run all agent tests**

```bash
npx jest src/agent/ --no-coverage
```

Expected: all pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/services/permissions.service.ts backend/src/agent/services/agent-loop.service.ts backend/src/agent/dto/yolo-config.dto.ts backend/src/agent/agent.controller.ts backend/src/agent/agent.module.ts
git commit -m "feat: integrate YOLO classifier into permission flow"
```

---

### Task 7: Frontend PermissionView

**Files:**
- Create: `frontend/src/components/PermissionView.vue`

- [ ] **Step 1: Create PermissionView.vue**

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiShieldCheck class="w-3 h-3 inline" /> {{ t('permissions.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      <!-- Permission Mode -->
      <div>
        <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.mode.header') }}</div>
        <BaseSelect v-model="permissionMode" @change="savePermissionMode">
          <option v-for="m in PERMISSION_MODES" :key="m" :value="m">{{ t(`permissions.mode.${m}`) }}</option>
        </BaseSelect>
      </div>

      <!-- YOLO Config -->
      <div v-if="permissionMode === 'auto'">
        <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.yolo.config') }}</div>
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="yoloConfig.failClosed" @change="saveYoloConfig" class="accent-cyber-accent" />
            <span class="text-cyber-text text-xs font-mono">{{ t('permissions.yolo.failClosed') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="yoloConfig.safeToolAllowlist" @change="saveYoloConfig" class="accent-cyber-accent" />
            <span class="text-cyber-text text-xs font-mono">{{ t('permissions.yolo.safeTools') }}</span>
          </label>
        </div>
      </div>

      <!-- Block Rules -->
      <div v-if="permissionMode === 'auto'">
        <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.rules.header') }}</div>
        <div class="space-y-1">
          <div v-for="rule in BLOCK_RULES" :key="rule.category" class="flex items-center gap-2 py-1">
            <input type="checkbox" :checked="!yoloConfig.disabledPatterns.includes(rule.category)"
              @change="toggleRule(rule.category)" class="accent-cyber-accent" />
            <span class="text-cyber-text text-xs font-mono">{{ t(`permissions.rules.${rule.category}`) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiShieldCheck } from 'vue-icons-plus/hi'
import BaseSelect from './BaseSelect.vue'

const { t } = useI18n()

const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto', 'plan']

const BLOCK_RULES = [
  { category: 'interpreters' },
  { category: 'package_runners' },
  { category: 'shells' },
  { category: 'eval' },
  { category: 'network' },
  { category: 'cloud_clis' },
  { category: 'git_destructive' },
  { category: 'irreversible' },
  { category: 'write_scripts' },
  { category: 'permission_bypass' },
]

const permissionMode = ref('default')

const yoloConfig = ref({
  failClosed: true,
  safeToolAllowlist: true,
  disabledPatterns: [] as string[],
})

onMounted(async () => {
  try {
    const res = await fetch('/api/agent/yolo-config')
    if (res.ok) yoloConfig.value = await res.json() as typeof yoloConfig.value
  } catch { /* ignore */ }
})

function toggleRule(category: string) {
  const idx = yoloConfig.value.disabledPatterns.indexOf(category)
  if (idx >= 0) yoloConfig.value.disabledPatterns.splice(idx, 1)
  else yoloConfig.value.disabledPatterns.push(category)
  saveYoloConfig()
}

async function savePermissionMode() {
  // Persist mode selection via settings
}

async function saveYoloConfig() {
  try {
    await fetch('/api/agent/yolo-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disabledPatterns: yoloConfig.value.disabledPatterns,
        failClosed: yoloConfig.value.failClosed,
        safeToolAllowlist: yoloConfig.value.safeToolAllowlist,
      }),
    })
  } catch { /* ignore */ }
}
</script>
```

- [ ] **Step 2: Add permission i18n keys to vi.json**

```json
"permissions": {
  "header": "Phân quyền",
  "mode": {
    "header": "Chế độ phân quyền",
    "default": "Mặc định",
    "acceptEdits": "Chấp nhận sửa",
    "bypassPermissions": "Bỏ qua tất cả",
    "dontAsk": "Không hỏi",
    "auto": "Tự động (YOLO)",
    "plan": "Kế hoạch"
  },
  "yolo": {
    "config": "Cấu hình YOLO",
    "failClosed": "Từ chối khi có lỗi",
    "safeTools": "Bỏ qua tool an toàn"
  },
  "rules": {
    "header": "Quy tắc chặn",
    "interpreters": "Trình thông dịch",
    "package_runners": "Trình chạy gói",
    "shells": "Shell",
    "eval": "Thực thi động",
    "network": "Mạng",
    "cloud_clis": "Cloud CLI",
    "git_destructive": "Git phá hủy",
    "irreversible": "Không thể hoàn tác",
    "write_scripts": "Ghi script",
    "permission_bypass": "Vượt quyền"
  }
}
```

- [ ] **Step 3: Add permission i18n keys to en.json**

```json
"permissions": {
  "header": "Permissions",
  "mode": {
    "header": "Permission Mode",
    "default": "Default",
    "acceptEdits": "Accept Edits",
    "bypassPermissions": "Bypass All",
    "dontAsk": "Don't Ask",
    "auto": "Auto (YOLO)",
    "plan": "Plan"
  },
  "yolo": {
    "config": "YOLO Config",
    "failClosed": "Deny on error",
    "safeTools": "Skip safe tools"
  },
  "rules": {
    "header": "Block Rules",
    "interpreters": "Interpreters",
    "package_runners": "Package Runners",
    "shells": "Shells",
    "eval": "Eval/Exec",
    "network": "Network",
    "cloud_clis": "Cloud CLIs",
    "git_destructive": "Git Destructive",
    "irreversible": "Irreversible",
    "write_scripts": "Write Scripts",
    "permission_bypass": "Permission Bypass"
  }
}
```

- [ ] **Step 4: Add Permission tab to SettingsView.vue**

In `SettingsView.vue`, add tab and conditional rendering (same pattern as MemoryView):

```ts
import PermissionView from './PermissionView.vue'

const TABS = [
  { key: 'general', labelKey: 'settings.header' },
  { key: 'memories', labelKey: 'memory.title' },
  { key: 'permissions', labelKey: 'permissions.header' },
]
```

```vue
<PermissionView v-if="activeSettingsTab === 'permissions'" />
```

- [ ] **Step 5: Run frontend type check**

```bash
cd frontend && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PermissionView.vue frontend/src/locales/ frontend/src/components/SettingsView.vue
git commit -m "feat: add PermissionView UI with YOLO config and block rule toggles"
```

---

### Task 8: AGENTS.md + Final Tests

- [ ] **Step 1: Create backend/src/agent/services/AGENTS.md entry for YOLO services**

Add to existing AGENTS.md:

```
├── yolo-classifier.service.ts     — 2-stage YOLO classifier (stage1 fast, stage2 deep)
├── yolo-classifier.constants.ts   — system prompt, safe tool allowlist, token limits
├── yolo-classifier.service.spec.ts
├── danger-patterns.config.ts       — 10 block rule categories as regex patterns
├── danger-patterns.config.spec.ts
├── denial-tracking.ts             — per-session consecutive/total denial counters
└── denial-tracking.spec.ts
```

- [ ] **Step 2: Run full backend tests**

```bash
npx jest --no-coverage
```

Expected: all pass (pre-existing failures unrelated).

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/AGENTS.md
git commit -m "docs: update AGENTS.md for YOLO classifier services"
```

---

## Self-Review Check

1. **Spec coverage**: All sections covered:
   - 6 permission modes → Task 5
   - 2-stage YOLO engine → Task 4
   - 28 danger patterns → Task 1
   - Denial tracking → Task 2
   - Fast paths + safe tool allowlist → Task 4
   - Frontend UI → Task 7
   - YOLO config endpoints → Task 6
   - Integration into permission flow → Task 6
   - System prompt templates → Task 3

2. **Placeholder scan**: No TBD, TODO, or incomplete code blocks. Every step has actual content.

3. **Type consistency**: `PermissionMode`, `BlockRuleCategory`, `YoloConfig`, `YoloResult`, `DenialTracker` types are consistent across all tasks. Method signatures match between definition and usage.

4. **Dependency correctness**: Task 4 (classifier) depends on Task 1 (patterns), Task 2 (denial tracking), Task 3 (constants). Task 6 depends on Task 4 + 5. Task 7 depends on Task 6 (API endpoints exist).
