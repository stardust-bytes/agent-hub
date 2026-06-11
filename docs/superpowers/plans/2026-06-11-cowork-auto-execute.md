# Cowork Mode Auto-Execute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove confirmation flows for sub-agents and plan execution in cowork mode.

**Architecture:** Two changes: add `delegate_parallel` to cowork `deniedTools` so LLM uses `spawn_subagent` directly (no DelegateBubble), and update the cowork system prompt to instruct LLM to always set `requireApproval=false`.

**Tech Stack:** NestJS, TypeScript

---

### Task 1: Disable delegate_parallel in cowork mode

**Files:**
- Modify: `backend/src/mode-policy/mode-policy.config.ts`

- [ ] **Step 1: Add delegate_parallel to cowork deniedTools**

Find the cowork entry (lines 45-57). Add `'delegate_parallel'` to the `deniedTools` array:

```typescript
  cowork: {
    enabledTools: '*',
    deniedTools: [
      'create_task',
      'update_task',
      'delete_tasks',
      'convert_note_to_task',
      'search_knowledge',
      'delegate_parallel',
    ],
    allowedPaths: ['{projectPath}'],
    systemPromptStyle: 'cowork',
    envContext: ['platform', 'projectPath'],
  },
```

- [ ] **Step 2: Run tests**

Run: `npx jest src/mode-policy`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/mode-policy/mode-policy.config.ts
git commit -m "feat: disable delegate_parallel in cowork mode (use spawn_subagent directly)"
```

---

### Task 2: Update cowork system prompt for auto-execute

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Change create_plan guidance for cowork mode**

Find the `buildSystemPrompt` method. The current `create_plan` guidance (lines 88-93) is shared for all non-chat modes. Replace it with cowork-specific guidance when `mode === 'cowork'`.

Before (lines 86-93):
```typescript
    lines.push('',
      '',
      'When to use create_plan:',
      '- Call create_plan for complex multi-step tasks that need sequential coordination.',
      '- Set requireApproval=true for risky operations (destructive file ops, architecture changes, operations needing user decisions).',
      '- Set requireApproval=false for safe multi-step work (refactoring, building components, data processing).',
      '- Do NOT use create_plan for single-step tasks — use the appropriate tool directly.',
    );
```

Replace with conditional guidance. Move the existing guidance before the mode-specific sections (before line 120), but add an `if` block for cowork:

```typescript
    if (mode === 'cowork') {
      lines.push('',
        '',
        'When to use create_plan:',
        '- Call create_plan for complex multi-step tasks that need sequential coordination.',
        '- Always set requireApproval=false — plans execute automatically.',
        '- The user trusts you to decide when and how to break down work.',
        '- Do not ask for approval or confirmation before executing plans.',
        '- Do NOT use create_plan for single-step tasks — use the appropriate tool directly.',
      );
    } else {
      lines.push('',
        '',
        'When to use create_plan:',
        '- Call create_plan for complex multi-step tasks that need sequential coordination.',
        '- Set requireApproval=true for risky operations (destructive file ops, architecture changes, operations needing user decisions).',
        '- Set requireApproval=false for safe multi-step work (refactoring, building components, data processing).',
        '- Do NOT use create_plan for single-step tasks — use the appropriate tool directly.',
      );
    }
```

The `create_plan` guidance should be placed after the `search_knowledge` guidance (after line 110), before the form section (line 111).

- [ ] **Step 2: Run tests**

Run: `npx jest src/agent`
Expected: All tests PASS (tests check system prompt content but don't verify create_plan guidance text)

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: update cowork system prompt to auto-execute plans without confirmation"
```
