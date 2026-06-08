# Agent HTML Form — Design Spec

## Overview

Allow the LLM agent to render interactive HTML forms in chat responses. Forms are wrapped in markdown fenced code blocks with a `form` language tag. Frontend detects these blocks and renders them as interactive Vue components.

## Flow

```
Agent SSE stream → token events → message.content with ```form ... ``` block
  → renderMarkdown() detects form code block
  → splits content: markdown body + FormBlock component
  → User fills form → Submit → new user message with JSON data
  → Agent receives and continues conversation
```

## Components

### 1. ChatPanel.vue — renderMarkdown changes

Post-processing in `renderMarkdown()`:

```ts
function renderMarkdown(content: string): string {
  let html = marked.parse(content) as string
  // ... existing citation regex ...
  return DOMPurify.sanitize(html)
}
```

Change to split form blocks from markdown:

Instead of processing forms in `renderMarkdown()`, the message template detects form blocks and renders them via a separate component. A simpler approach: render the markdown with a placeholder for each form block, then use a `<component>` or slot-based approach to insert FormBlock components.

**Actual approach:** The agent message div in the template will use a computed property that parses the content into segments (markdown text + form blocks). Each segment is rendered inline.

### 2. FormBlock.vue (new component)

**Props:**
- `html: string` — raw HTML inside the code block (form elements only)
- `index: number` — unique ID for multiple forms in one message

**Emits:**
- `submit: [data: Record<string, string>]`

**Template:**
```vue
<template>
  <form @submit.prevent="onSubmit" class="...">
    <div v-for="(field, i) in fields" :key="i" class="...">
      <label class="...">{{ field.label }}</label>
      <input v-if="field.type === 'input'" v-model="field.value" class="..." :placeholder="field.placeholder" />
      <select v-else-if="field.type === 'select'" v-model="field.value" class="...">
        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>
    <button type="submit" class="...">Gửi</button>
  </form>
</template>
```

**Parsing:** Parse the `html` prop to extract fields. Since DOMPurify will strip form elements, the `html` prop comes directly from the raw markdown content (before sanitization). The component parses `<input>`, `<select>`, `<option>`, `<label>`, `<textarea>`, `<button>` tags using a simple regex/parser.

**Styling:** Use existing cyber color tokens:
- `bg-cyber-dark` for inputs
- `border-cyber-code-border` for borders
- `font-mono` for all text
- `text-cyber-accent` for submit button

### 3. Content parsing in ChatPanel.vue

A new computed or function that splits agent message content into segments:

```ts
interface MessageSegment {
  type: 'markdown' | 'form'
  content: string  // markdown HTML or form HTML
}
```

The template renders segments sequentially:
```html
<template v-for="seg in parseSegments(msg.content)">
  <div v-if="seg.type === 'markdown'" class="markdown-body" v-html="seg.content" />
  <FormBlock v-else :html="seg.content" @submit="onFormSubmit" />
</template>
```

### 4. Form submission

When a form is submitted:

```ts
function onFormSubmit(data: Record<string, string>) {
  const json = JSON.stringify(data)
  messages.value.push({ role: 'user', content: `Form submission: ${json}`, timestamp: now() })
  // Optionally re-submit to agent automatically
}
```

## Security

- Form HTML is NOT sanitized by DOMPurify since it's parsed into controlled Vue components (v-model binding prevents XSS)
- Only `<input>`, `<select>`, `<option>`, `<label>`, `<textarea>`, `<button>` tags are parsed — no arbitrary HTML execution
- Form data is submitted as a plain text user message (no direct API calls)

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/ChatPanel.vue` | Message rendering split into segments; form submit handler |
| `frontend/src/components/FormBlock.vue` | **New** — reactive form from HTML string |

## Agent Prompt

Add to system prompt in `context-builder.service.ts`:
```
To ask the user for structured input, output a form using:
```form
<label>Field name: <input name="field_name"></label>
```
Supported elements: <input>, <select><option>, <textarea>, <label>, <button type="submit">.
```
