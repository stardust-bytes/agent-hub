<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    closable
    max-height="90vh"
  >
    <template #header>
      <span class="text-sm font-mono text-cyber-accent">{{ editingId ? t('notes.edit') : t('notes.add') }}</span>
    </template>
    <div class="p-3 flex flex-col gap-3 bg-cyber-modal-bg" style="min-height:50vh;width:70rem;max-width:90vw">
      <input
        v-model="title"
        class="w-full bg-cyber-dark text-cyber-text text-lg font-mono font-semibold outline-none px-3 py-2 placeholder-cyber-muted/40"
        :placeholder="t('notes.form.title')"
      />
      <textarea
        v-model="content"
        class="flex-1 w-full bg-cyber-dark text-cyber-text text-sm font-mono outline-none p-3 resize-none placeholder-cyber-muted/40"
        style="min-height:30vh"
        :placeholder="t('notes.form.content')"
      />
    </div>
    <template #footer>
      <div class="flex items-center gap-2 px-3 py-2">
        <button
          @click="save"
          class="text-sm font-mono text-cyber-accent px-3 py-1 rounded border border-cyber-accent/30 hover:bg-cyber-accent/10 transition-colors duration-150"
        >{{ t('notes.form.save') }}</button>
        <button
          @click="cancel"
          class="text-sm font-mono text-cyber-muted px-3 py-1 rounded hover:text-cyber-text transition-colors duration-150"
        >{{ t('notes.form.cancel') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  editingId: number | null
  initialTitle?: string
  initialContent?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [title: string, content: string]
}>()

const title = ref('')
const content = ref('')

watch(() => props.modelValue, (val) => {
  if (val) {
    title.value = props.initialTitle ?? ''
    content.value = props.initialContent ?? ''
  }
})

function save() {
  if (!title.value.trim()) return
  emit('save', title.value.trim(), content.value.trim())
  emit('update:modelValue', false)
}

function cancel() {
  emit('update:modelValue', false)
}
</script>
