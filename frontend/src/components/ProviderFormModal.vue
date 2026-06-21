<template>
  <BaseModal :model-value="modelValue" :closable="true" max-height="80vh" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-foreground text-sm font-semibold">
        {{ editing ? t('providers.edit') : t('providers.add') }}
      </span>
    </template>

    <div class="px-3 py-3 space-y-3">
      <div>
        <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('providers.form.type') }}</label>
        <select
          v-model="form.type"
          @change="onTypeChange"
          class="w-full bg-surface text-foreground text-sm px-2 py-1.5 font-mono outline-none border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-ring"
        >
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI-compatible</option>
        </select>
      </div>
      <div>
        <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('providers.form.name') }}</label>
        <input
          v-model="form.name"
          class="w-full bg-surface text-foreground text-sm px-2 py-1.5 font-mono outline-none border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-ring"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('providers.form.baseUrl') }}</label>
        <input
          v-model="form.baseUrl"
          class="w-full bg-surface text-foreground text-sm px-2 py-1.5 font-mono outline-none border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-ring"
          placeholder="http://localhost:11434"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('providers.form.key') }}</label>
        <input
          v-model="form.key"
          type="password"
          class="w-full bg-surface text-foreground text-sm px-2 py-1.5 font-mono outline-none border border-input rounded-lg focus:border-primary focus:ring-1 focus:ring-ring"
          autocomplete="new-password"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1.5 text-sm rounded-lg border border-input bg-surface text-foreground hover:bg-muted transition-colors duration-150"
        >{{ t('providers.form.cancel') }}</button>
        <button
          @click="save"
          :disabled="!form.name.trim() || saving"
          class="px-3 py-1.5 text-sm rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >{{ t('providers.form.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import { createProvider, updateProvider } from '../api/providers'

interface Provider {
  id: number
  name: string
  type: string
  baseUrl: string | null
  key: string | null
}

const props = defineProps<{
  modelValue: boolean
  editing: Provider | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const { t } = useI18n()

interface ProviderTypeConfig {
  baseUrl: string
  models: string[]
}

const providerTypes: Record<string, ProviderTypeConfig> = {
  ollama: { baseUrl: 'http://localhost:11434', models: ['llama3.2', 'codellama', 'mistral'] },
  openai: { baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  deepseek: { baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
}

const form = ref({ type: 'ollama', name: '', baseUrl: '', key: '' })
const saving = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    const type = props.editing?.type ?? 'ollama'
    form.value = {
      type,
      name: props.editing?.name ?? '',
      baseUrl: props.editing?.baseUrl ?? providerTypes[type]?.baseUrl ?? '',
      key: '',
    }
  }
})

function onTypeChange() {
  const type = form.value.type
  const cfg = providerTypes[type]
  if (cfg && !props.editing) {
    if (!form.value.name) form.value.name = type.charAt(0).toUpperCase() + type.slice(1)
    form.value.baseUrl = cfg.baseUrl
  }
}

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const body: { name: string; baseUrl?: string; key?: string; type?: string } = {
      name: form.value.name.trim(),
      type: form.value.type,
    }
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    if (form.value.key.trim()) body.key = form.value.key.trim()

    if (props.editing) {
      await updateProvider(props.editing.id, body)
    } else {
      await createProvider(body)
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch { /* ignore */ }
  saving.value = false
}
</script>
