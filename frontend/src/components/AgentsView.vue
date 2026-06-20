<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <HiUserGroup class="w-3 h-3 text-cyber-accent" />
      <span class="text-sm text-cyber-accent font-mono">{{ t('agents.header') }}</span>
      <button
        @click="startCreate"
        class="ml-auto text-sm text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/30 transition-colors duration-150 hover:bg-cyber-accent/10"
      >{{ t('agents.add') }}</button>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <div v-if="store.error" class="text-red-400 text-sm font-mono">{{ t(store.error) }}</div>

      <div class="space-y-1">
        <div
          v-for="p in store.profiles"
          :key="p.id"
          :class="editingId === p.id ? 'border-cyber-accent/40' : 'border-cyber-code-border'"
          class="flex items-center gap-2 px-2 py-1.5 bg-cyber-dark border"
        >
          <span :class="p.enabled ? 'text-cyber-green' : 'text-cyber-muted'" class="font-mono text-sm">
            {{ p.enabled ? '●' : '○' }}
          </span>
          <div class="min-w-0">
            <div class="text-cyber-text text-sm font-mono truncate">
              {{ p.name }}
              <span v-if="p.builtin" class="text-cyber-cyan/70 ml-1">[{{ t('agents.builtin') }}]</span>
            </div>
            <div class="text-cyber-muted/60 text-sm font-mono truncate">/agent {{ p.slug }}</div>
          </div>
          <div class="ml-auto flex items-center gap-2 shrink-0">
            <button
              @click="toggleEnabled(p)"
              :class="p.enabled ? 'text-cyber-orange hover:text-cyber-orange/80' : 'text-cyber-accent hover:text-cyber-accent/80'"
              class="text-sm font-mono transition-colors duration-150"
            >{{ p.enabled ? t('agents.disable') : t('agents.enable') }}</button>
            <button
              @click="startEdit(p)"
              class="text-sm font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150"
            >{{ t('agents.edit') }}</button>
            <button
              v-if="!p.builtin"
              @click="askDelete(p)"
              class="text-sm font-mono text-red-400 hover:text-red-400/80 transition-colors duration-150"
            >{{ t('agents.delete') }}</button>
          </div>
        </div>
        <div v-if="!store.profiles.length" class="text-cyber-muted text-sm font-mono">{{ t('agents.empty') }}</div>
      </div>

      <form v-if="formOpen" @submit.prevent="save" class="border border-cyber-code-border bg-cyber-dark p-3 space-y-3 max-w-2xl">
        <div class="text-cyber-accent text-sm font-mono">
          {{ editingId ? t('agents.edit') : t('agents.add') }}
        </div>

        <div>
          <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('agents.name') }}</label>
          <input v-model="form.name" required
            class="w-full bg-cyber-bg text-cyber-text text-sm font-mono border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent" />
        </div>

        <div>
          <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('agents.slug') }}</label>
          <input v-model="form.slug" required :disabled="!!editingId" pattern="[a-z0-9-]+"
            class="w-full bg-cyber-bg text-cyber-text text-sm font-mono border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent disabled:opacity-50" />
        </div>

        <div>
          <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('agents.description') }}</label>
          <input v-model="form.description"
            class="w-full bg-cyber-bg text-cyber-text text-sm font-mono border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent" />
        </div>

        <div>
          <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('agents.systemPrompt') }}</label>
          <textarea v-model="form.systemPrompt" required rows="4"
            class="w-full bg-cyber-bg text-cyber-text text-sm font-mono border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent resize-y"></textarea>
        </div>

        <div>
          <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('agents.allowedTools') }}</label>
          <input v-model="allowedToolsInput" :placeholder="'*'"
            class="w-full bg-cyber-bg text-cyber-text text-sm font-mono border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent" />
        </div>

        <div>
          <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('agents.model') }}</label>
          <ModelSelector :models="models" v-model="form.modelId" :disabled="false" />
        </div>

        <label class="flex items-center gap-2 text-cyber-muted text-sm font-mono cursor-pointer">
          <input type="checkbox" v-model="form.enabled" class="accent-cyber-accent" />
          {{ t('agents.enabled') }}
        </label>

        <div v-if="formError" class="text-red-400 text-sm font-mono">{{ t(formError) }}</div>

        <div class="flex gap-2 justify-end">
          <button type="button" @click="closeForm"
            class="text-sm font-mono text-cyber-muted px-3 py-1.5 hover:text-cyber-text transition-colors duration-150">
            {{ t('agents.cancel') }}
          </button>
          <button type="submit"
            class="text-sm font-mono text-cyber-accent px-3 py-1.5 border border-cyber-accent/30 hover:bg-cyber-accent/10 transition-colors duration-150">
            {{ t('agents.save') }}
          </button>
        </div>
      </form>
    </div>

    <BaseConfirmModal
      v-model="confirmOpen"
      :title="t('agents.delete')"
      :message="t('agents.delete_confirm')"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiUserGroup } from 'vue-icons-plus/hi'
import { storeToRefs } from 'pinia'
import ModelSelector from './ModelSelector.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import { useAgentProfilesStore } from '../stores/agentProfiles'
import type { AgentProfile } from '../api/agentProfiles'
import { useProvidersStore } from '../stores/providers'
import { errorCode } from '../api/client'

const { t } = useI18n()
const store = useAgentProfilesStore()
const providersStore = useProvidersStore()
const { models } = storeToRefs(providersStore)

interface ProfileForm {
  slug: string
  name: string
  description: string
  systemPrompt: string
  modelId: number | null
  enabled: boolean
}

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const formError = ref<string | null>(null)
const allowedToolsInput = ref('*')
const confirmOpen = ref(false)
const pendingDelete = ref<AgentProfile | null>(null)

const emptyForm = (): ProfileForm => ({
  slug: '', name: '', description: '', systemPrompt: '', modelId: null, enabled: true,
})
const form = reactive<ProfileForm>(emptyForm())

const allowedToolsString = computed(() => {
  const raw = allowedToolsInput.value.trim()
  if (!raw || raw === '*') return '*'
  const list = raw.split(',').map(s => s.trim()).filter(Boolean)
  return list.length ? JSON.stringify(list) : '*'
})

function allowedToolsToInput(value: string): string {
  if (!value || value === '*') return '*'
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(String).join(', ')
  } catch { /* fall through */ }
  return '*'
}

function startCreate() {
  editingId.value = null
  formError.value = null
  Object.assign(form, emptyForm())
  allowedToolsInput.value = '*'
  formOpen.value = true
}

function startEdit(p: AgentProfile) {
  editingId.value = p.id
  formError.value = null
  form.slug = p.slug
  form.name = p.name
  form.description = p.description ?? ''
  form.systemPrompt = p.systemPrompt
  form.modelId = p.modelId ?? null
  form.enabled = p.enabled
  allowedToolsInput.value = allowedToolsToInput(p.allowedTools)
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
}

async function save() {
  formError.value = null
  const body = {
    slug: form.slug,
    name: form.name,
    description: form.description || null,
    systemPrompt: form.systemPrompt,
    allowedTools: allowedToolsString.value,
    modelId: form.modelId,
    enabled: form.enabled,
  }
  try {
    if (editingId.value) {
      const { slug: _slug, ...patch } = body
      await store.update(editingId.value, patch)
    } else {
      await store.create(body)
    }
    closeForm()
  } catch (e) {
    formError.value = errorCode(e)
  }
}

async function toggleEnabled(p: AgentProfile) {
  try { await store.update(p.id, { enabled: !p.enabled }) }
  catch { /* surfaced via store.error on reload */ }
}

function askDelete(p: AgentProfile) {
  pendingDelete.value = p
  confirmOpen.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  try { await store.remove(pendingDelete.value.id) }
  catch { /* surfaced via store.error on reload */ }
  pendingDelete.value = null
}

onMounted(async () => {
  await store.load()
  await providersStore.loadModels()
})
</script>
