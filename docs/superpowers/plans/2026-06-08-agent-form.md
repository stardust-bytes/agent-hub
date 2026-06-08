# Agent HTML Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable LLM agent to render interactive HTML forms in chat via ` ```form ` code blocks.

**Architecture:** `renderMarkdown()` detects form code blocks, splits content into segments (markdown + form). Form blocks rendered as controlled Vue components. Submission creates new user message with JSON data.

**Tech Stack:** Vue 3, marked, DOMPurify

---

## Files

| Type | File |
|------|------|
| Create | `frontend/src/components/FormBlock.vue` |
| Modify | `frontend/src/components/ChatPanel.vue` |
| Modify | `backend/src/agent/services/context-builder.service.ts` |

---

### Task 1: Create FormBlock.vue

**Files:**
- Create: `frontend/src/components/FormBlock.vue`

- [ ] **Step 1: Create component**

Write `frontend/src/components/FormBlock.vue`:

```vue
<template>
  <form @submit.prevent="onSubmit" class="border border-cyber-code-border p-3 my-2 bg-cyber-dark">
    <div v-for="(field, i) in fields" :key="i" class="mb-2">
      <label class="text-sm text-cyber-muted font-mono block mb-1">{{ field.label }}</label>
      <input
        v-if="field.type === 'input'"
        v-model="field.value"
        class="w-full bg-cyber-bg px-2 py-1 text-sm font-mono text-cyber-text outline-none"
        :placeholder="field.placeholder"
      />
      <select
        v-else-if="field.type === 'select'"
        v-model="field.value"
        class="w-full bg-cyber-bg px-2 py-1 text-sm font-mono text-cyber-text outline-none"
      >
        <option v-for="opt in field.options" :key="opt" :value="opt" class="bg-cyber-dark">{{ opt }}</option>
      </select>
      <textarea
        v-else-if="field.type === 'textarea'"
        v-model="field.value"
        class="w-full bg-cyber-bg px-2 py-1 text-sm font-mono text-cyber-text outline-none resize-none"
        :placeholder="field.placeholder"
        rows="3"
      />
    </div>
    <button
      type="submit"
      class="text-sm font-mono font-bold text-black bg-cyber-accent px-3 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
    >{{ submitText }}</button>
  </form>
</template>

<script setup lang="ts">
interface Field {
  label: string
  type: 'input' | 'select' | 'textarea'
  name: string
  value: string
  placeholder?: string
  options?: string[]
}

const props = defineProps<{
  html: string
  index: number
}>()

const emit = defineEmits<{
  submit: [data: Record<string, string>]
}>()

function parseFields(html: string): { fields: Field[]; submitText: string } {
  const fields: Field[] = []
  let submitText = 'Gửi'

  const labelRegex = /<label[^>]*>([\s\S]*?)<\/label>/gi
  let m
  while ((m = labelRegex.exec(html)) !== null) {
    const inner = m[1]
    const inputMatch = inner.match(/<(input|select|textarea)([^>]*)>/i)
    if (!inputMatch) continue

    const tag = inputMatch[1].toLowerCase()
    const attrs = inputMatch[2]
    const name = attrs.match(/name\s*=\s*["']([^"']+)["']/)?.[1] || ''
    const placeholder = attrs.match(/placeholder\s*=\s*["']([^"']+)["']/)?.[1] || ''
    const labelText = inner.replace(/<[^>]+>/g, '').trim()

    if (tag === 'select') {
      const options: string[] = []
      const optRegex = /<option[^>]*>([\s\S]*?)<\/option>/gi
      let om
      while ((om = optRegex.exec(inner)) !== null) {
        options.push(om[1].trim())
      }
      fields.push({ label: labelText, type: 'select', name, value: options[0] || '', options })
    } else if (tag === 'textarea') {
      fields.push({ label: labelText, type: 'textarea', name, value: '', placeholder })
    } else {
      fields.push({ label: labelText, type: 'input', name, value: '', placeholder })
    }
  }

  const btnMatch = html.match(/<button[^>]*type=["']submit["'][^>]*>([\s\S]*?)<\/button>/i)
  if (btnMatch) submitText = btnMatch[1].replace(/<[^>]+>/g, '').trim()

  return { fields, submitText }
}

const { fields, submitText } = parseFields(props.html)

function onSubmit() {
  const data: Record<string, string> = {}
  for (const f of fields) {
    data[f.name] = f.value
  }
  emit('submit', data)
}
</script>
```

---

### Task 2: Update ChatPanel.vue to parse form blocks

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add form block detection in message rendering**

Replace the agent message block in the template (the `msg.role === 'agent'` section, lines 26-40). Add `FormBlock` import and a `parseSegments` method.

Add import:
```ts
import FormBlock from './FormBlock.vue'
```

Add the `parseSegments` function after `renderMarkdown`:
```ts
interface MessageSegment {
  type: 'markdown' | 'form'
  content: string
}

function parseSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const formRegex = /```form\s*\n([\s\S]*?)```/g
  let lastIndex = 0
  let m

  while ((m = formRegex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      const markdownPart = content.slice(lastIndex, m.index).trim()
      if (markdownPart) {
        segments.push({ type: 'markdown', content: renderMarkdown(markdownPart) })
      }
    }
    segments.push({ type: 'form', content: m[1].trim() })
    lastIndex = m.index + m[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim()
    if (remaining) {
      segments.push({ type: 'markdown', content: renderMarkdown(remaining) })
    }
  }

  return segments
}
```

Replace the agent message rendering section:
```html
<div v-else-if="msg.role === 'agent'"
  class="border-l-2 border-cyber-accent/80 pl-3 py-1">
  <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">
    <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
  </div>
  <div v-if="msg.typing" class="text-sm leading-relaxed break-words text-cyber-text">
    {{ msg.content }}
  </div>
  <template v-else>
    <template v-for="(seg, si) in parseSegments(msg.content)" :key="si">
      <div v-if="seg.type === 'markdown'" class="text-sm leading-relaxed break-words text-cyber-text markdown-body" v-html="seg.content" />
      <FormBlock v-else :html="seg.content" :index="si" @submit="(data) => onFormSubmit(data)" />
    </template>
  </template>
</div>
```

- [ ] **Step 2: Add form submit handler**

Add function after `renderMarkdown`:
```ts
function onFormSubmit(data: Record<string, string>) {
  const json = JSON.stringify(data, null, 2)
  messages.value.push({
    role: 'user',
    content: `Form submission:\n\`\`\`json\n${json}\n\`\`\``,
    timestamp: now(),
  })
  scrollToBottom()
  // Auto-submit to agent if a session is active
  if (currentSessionId.value !== null && selectedModelId.value !== null) {
    const text = JSON.stringify(data)
    input.value = text
    submit()
  }
}
```

---

### Task 3: Update agent system prompt

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Add form instructions to prompt**

In `context-builder.service.ts`, add after the KB guidance lines (after line 73):

```ts
'',
'To ask the user for structured input, output a form using:',
'```form',
'<label>Field name: <input name="field_name" placeholder="Enter..."></label>',
'<label>Choice: <select name="choice"><option>A</option><option>B</option></select></label>',
'<button type="submit">Submit</button>',
'```',
'Supported: <input>, <select><option>, <textarea>, <label>, <button type="submit">.',
'When the user submits, you will receive the data as a JSON object.',
```

---

### Task 4: Verify build

- [ ] **Step 1: Run frontend build**

Run: `cd ../frontend && npm run build`
Expected: vue-tsc passes, vite build succeeds.
