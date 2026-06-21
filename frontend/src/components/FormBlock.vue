<template>
  <form @submit.prevent="onSubmit" class="rounded-lg border border-border bg-muted p-3 my-2">
    <div v-for="(field, i) in fields" :key="i" class="mb-2">
      <label class="text-sm text-muted-foreground block mb-1">{{ field.label }}</label>
      <input
        v-if="field.type === 'input'"
        v-model="field.value"
        class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
        :placeholder="field.placeholder"
      />
      <select
        v-else-if="field.type === 'select'"
        v-model="field.value"
        class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
      >
        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <textarea
        v-else-if="field.type === 'textarea'"
        v-model="field.value"
        class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors resize-none focus:border-primary focus:ring-1 focus:ring-ring"
        :placeholder="field.placeholder"
        rows="3"
      />
    </div>
    <button
      type="submit"
      class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
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
