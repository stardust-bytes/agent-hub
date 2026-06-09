<template>
  <BaseModal :model-value="modelValue" :closable="true" max-height="80vh" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-cyber-text text-sm font-mono">
        {{ editing ? t('tasks.edit.modal.title') : t('tasks.add.modal.title') }}
      </span>
    </template>
    <div class="px-3 py-4 space-y-3">
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.title') }}</label>
        <input
          v-model="form.title"
          class="w-full bg-cyber-dark px-2 py-1.5 text-sm font-mono text-cyber-text placeholder-cyber-muted/40 outline-none"
          :placeholder="t('tasks.add.placeholder')"
        />
      </div>
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.description') }}</label>
        <textarea
          v-model="form.description"
          class="w-full bg-cyber-dark px-2 py-1.5 text-sm font-mono text-cyber-text placeholder-cyber-muted/40 outline-none resize-none"
          rows="3"
          placeholder="..."
        />
      </div>
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.priority') }}</label>
        <div class="flex gap-2">
          <button
            v-for="p in PRIORITY_OPTIONS"
            :key="p.value"
            @click="form.priority = p.value"
            :class="[
              'flex-1 text-sm py-1 font-mono transition-colors duration-150',
              form.priority === p.value ? p.activeClass : p.inactiveClass,
            ]"
          >{{ t(p.labelKey) }}</button>
        </div>
      </div>
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.status') }}</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="s in STATUS_OPTIONS"
            :key="s.value"
            @click="form.status = s.value"
            :class="[
              'text-sm px-2 py-1 font-mono transition-colors duration-150',
              form.status === s.value ? s.activeClass : s.inactiveClass,
            ]"
          >{{ t(s.labelKey) }}</button>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1.5 text-sm font-mono text-cyber-muted bg-cyber-dark hover:text-cyber-text transition-colors duration-150"
        >{{ t('tasks.form.cancel') }}</button>
        <button
          @click="onSave"
          :disabled="!form.title.trim()"
          class="px-3 py-1.5 text-sm font-mono text-black bg-cyber-accent hover:bg-cyber-accent/80 transition-colors duration-150 disabled:opacity-40"
        >{{ t('tasks.form.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  modelValue: boolean
  editing: Task | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()

const PRIORITY_OPTIONS = [
  { value: 2, labelKey: 'tasks.priority.high', activeClass: 'text-red-400 bg-red-400/15', inactiveClass: 'text-red-400/50 hover:text-red-400' },
  { value: 1, labelKey: 'tasks.priority.medium', activeClass: 'text-cyber-orange bg-cyber-orange/15', inactiveClass: 'text-cyber-orange/50 hover:text-cyber-orange' },
  { value: 0, labelKey: 'tasks.priority.low', activeClass: 'text-cyber-muted bg-cyber-muted/15', inactiveClass: 'text-cyber-muted/50 hover:text-cyber-muted' },
]

const STATUS_OPTIONS = [
  { value: 'TODO', labelKey: 'tasks.col.todo', activeClass: 'text-cyber-accent bg-cyber-accent/15', inactiveClass: 'text-cyber-accent/50 hover:text-cyber-accent' },
  { value: 'PROCESSING', labelKey: 'tasks.col.processing', activeClass: 'text-cyber-orange bg-cyber-orange/15', inactiveClass: 'text-cyber-orange/50 hover:text-cyber-orange' },
  { value: 'DONE', labelKey: 'tasks.col.done', activeClass: 'text-cyber-green bg-cyber-green/15', inactiveClass: 'text-cyber-green/50 hover:text-cyber-green' },
  { value: 'FAILED', labelKey: 'tasks.col.failed', activeClass: 'text-red-400 bg-red-400/15', inactiveClass: 'text-red-400/50 hover:text-red-400' },
]

const form = reactive({ title: '', description: '', priority: 0, status: 'TODO' })

watch(() => props.modelValue, (open) => {
  if (open) {
    if (props.editing) {
      form.title = props.editing.title
      form.description = props.editing.description ?? ''
      form.priority = props.editing.priority
      form.status = props.editing.status
    } else {
      form.title = ''
      form.description = ''
      form.priority = 0
      form.status = 'TODO'
    }
  }
})

async function onSave() {
  const title = form.title.trim()
  if (!title) return
  const payload: Record<string, unknown> = { title, priority: form.priority, status: form.status }
  if (form.description) payload.description = form.description
  try {
    if (props.editing) {
      await fetch(`/api/tasks/${props.editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch {
    // silently fail
  }
}
</script>
