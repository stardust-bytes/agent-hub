<template>
  <BaseModal v-model="modelValue" :closable="true" max-height="80vh" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        {{ editing ? t('providers.edit') : t('providers.add') }}
      </span>
    </template>

    <div class="px-3 py-3 space-y-3">
      <div>
        <label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('providers.form.name') }}</label>
        <input
          v-model="form.name"
          class="w-full bg-cyber-dark text-slate-100 text-xs px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('providers.form.baseUrl') }}</label>
        <input
          v-model="form.baseUrl"
          class="w-full bg-cyber-dark text-slate-100 text-xs px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          placeholder="http://localhost:11434"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('providers.form.key') }}</label>
        <input
          v-model="form.key"
          type="password"
          class="w-full bg-cyber-dark text-slate-100 text-xs px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          autocomplete="new-password"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1 text-xs font-mono text-cyber-muted hover:text-slate-100 transition-colors duration-150"
        >{{ t('providers.form.cancel') }}</button>
        <button
          @click="save"
          :disabled="!form.name.trim() || saving"
          class="px-3 py-1 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >{{ t('providers.form.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

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

const form = ref({ name: '', baseUrl: '', key: '' })
const saving = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = {
      name: props.editing?.name ?? '',
      baseUrl: props.editing?.baseUrl ?? '',
      key: '',
    }
  }
})

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const body: Record<string, string> = { name: form.value.name.trim(), type: 'ollama' }
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    if (form.value.key.trim()) body.key = form.value.key.trim()

    const url = props.editing ? `/api/providers/${props.editing.id}` : '/api/providers'
    const method = props.editing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    emit('saved')
    emit('update:modelValue', false)
  } catch { /* ignore */ }
  saving.value = false
}
</script>
