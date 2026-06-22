<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    closable
    max-height="90vh"
  >
    <template #header>
      <span class="text-sm text-foreground font-sans">{{ editingId ? t('notes.edit') : t('notes.add') }}</span>
    </template>
    <div class="p-3 space-y-3">
      <input
        v-model="title"
        class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
        :placeholder="t('notes.form.title')"
      />
      <textarea
        v-model="content"
        class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring resize-none"
        style="min-height:30vh"
        :placeholder="t('notes.form.content')"
      />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="cancel"
          class="text-sm text-muted-foreground font-sans px-3 py-1.5 border border-border rounded-lg transition-colors duration-150 hover:text-foreground"
        >{{ t('notes.form.cancel') }}</button>
        <button
          @click="save"
          class="text-sm text-primary-foreground font-sans px-3 py-1.5 rounded-lg bg-primary transition-colors duration-150 hover:bg-primary/90"
        >{{ t('notes.form.save') }}</button>
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
