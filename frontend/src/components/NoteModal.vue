<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    closable
    max-height="90vh"
  >
    <template #header>
      <span class="text-sm text-gray-900 font-semibold">{{ editingId ? t('notes.edit') : t('notes.add') }}</span>
    </template>
    <div class="p-4 flex flex-col gap-3 bg-white">
      <input
        v-model="title"
        class="w-full bg-white text-gray-900 text-sm font-semibold rounded-md border border-gray-300 outline-none px-3 py-2 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        :placeholder="t('notes.form.title')"
      />
      <textarea
        v-model="content"
        class="flex-1 w-full bg-white text-gray-900 text-sm font-mono rounded-md border border-gray-300 outline-none p-3 resize-none placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        style="min-height:30vh"
        :placeholder="t('notes.form.content')"
      />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="cancel"
          class="text-sm text-gray-700 px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors duration-150"
        >{{ t('notes.form.cancel') }}</button>
        <button
          @click="save"
          class="text-sm text-white px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 transition-colors duration-150"
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
