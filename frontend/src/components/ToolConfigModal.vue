<template>
  <BaseModal :model-value="modelValue" :closable="true" max-height="80vh" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-gray-900 text-sm font-mono">{{ t('tools.config.title') }}: {{ tool?.name }}</span>
    </template>
    <div class="px-3 py-4 space-y-3">
      <div v-for="(schema, key) in schemaProps" :key="key" class="mb-2">
        <label class="text-sm text-gray-500 font-mono block mb-1">{{ schema.title || key }}</label>
        <input
          v-if="!schema.enum"
          v-model="formData[key]"
          :type="schema.format === 'password' ? 'password' : 'text'"
          class="w-full bg-white px-2 py-1.5 text-sm font-mono text-gray-900 outline-none"
        />
        <select
          v-else
          v-model="formData[key]"
          class="w-full bg-white px-2 py-1.5 text-sm font-mono text-gray-900 outline-none"
        >
          <option v-for="opt in schema.enum" :key="opt" :value="opt" class="bg-white">{{ opt }}</option>
        </select>
      </div>
      <p v-if="!schemaProps || Object.keys(schemaProps).length === 0" class="text-gray-500 text-sm font-mono">{{ t('tools.config.noConfig') }}</p>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button @click="$emit('update:modelValue', false)" class="px-3 py-1.5 text-sm font-mono text-gray-500 bg-white hover:text-gray-900 transition-colors duration-150">{{ t('tools.form.cancel') }}</button>
        <button @click="onSave" class="px-3 py-1.5 text-sm font-mono text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-150">{{ t('tools.config.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import { saveToolConfig } from '../api/tools'
import type { Tool } from '../api/tools'

const props = defineProps<{
  modelValue: boolean
  tool: Tool | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const formData = reactive<Record<string, string>>({})

const schemaProps = computed(() => {
  if (!props.tool?.configSchema) return {}
  try {
    const schema = JSON.parse(props.tool.configSchema)
    return schema.properties || {}
  } catch { return {} }
})

watch(() => props.modelValue, (open) => {
  if (open && props.tool) {
    const existing: Record<string, string> = {}
    try { Object.assign(existing, JSON.parse(props.tool.config || '{}')) } catch {}
    for (const key of Object.keys(schemaProps.value)) {
      formData[key] = existing[key] || ''
    }
  }
})

async function onSave() {
  if (!props.tool) return
  await saveToolConfig(props.tool.name, { ...formData })
  emit('saved')
  emit('update:modelValue', false)
}
</script>
