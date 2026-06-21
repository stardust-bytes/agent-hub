<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    closable
    max-height="90vh"
  >
    <template #header>
      <span class="text-sm text-foreground font-semibold">{{ editingId ? t('notes.edit') : t('notes.add') }}</span>
    </template>
    <div class="p-4 flex flex-col gap-3 bg-surface">
      <input
        v-model="title"
        class="w-full bg-surface text-foreground text-sm font-semibold rounded-lg border border-input outline-none px-3 py-2 placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-ring"
        :placeholder="t('notes.form.title')"
      />
      <textarea
        v-model="content"
        class="flex-1 w-full bg-surface text-foreground text-sm font-sans rounded-lg border border-input outline-none p-3 resize-none placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-ring"
        style="min-height:30vh"
        :placeholder="t('notes.form.content')"
      />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="cancel"
          class="text-sm text-foreground px-3 py-1.5 rounded-lg border border-input bg-surface hover:bg-muted transition-colors duration-150"
        >{{ t('notes.form.cancel') }}</button>
        <button
          @click="save"
          class="text-sm text-primary-foreground px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors duration-150"
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
