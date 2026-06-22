<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <HiUserGroup class="w-4 h-4" />
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('agents.header') }}</span>
        <span v-if="store.profiles.length > 0" class="text-xs font-sans text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{{ store.profiles.length }}</span>
        <div class="ml-auto">
          <button @click="startCreate"
            class="text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors duration-150 px-2.5 py-1">
            {{ t('agents.add') }}
          </button>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 pb-6 w-full space-y-1">
      <div v-if="store.error" class="text-danger text-sm font-sans mb-2">{{ t(store.error) }}</div>

      <div
        v-for="p in store.profiles"
        :key="p.id"
        class="flex items-center gap-2 px-2 py-1.5 bg-surface border border-border rounded-lg"
      >
        <span :class="p.enabled ? 'text-success' : 'text-muted-foreground'" class="font-sans text-sm">
          {{ p.enabled ? '●' : '○' }}
        </span>
        <div class="min-w-0">
          <div class="text-foreground text-sm font-sans truncate">
            {{ p.name }}
            <span v-if="p.builtin" class="text-primary/70 ml-1">[{{ t('agents.builtin') }}]</span>
          </div>
          <div class="text-muted-foreground/60 text-sm font-sans truncate">/agent {{ p.slug }}</div>
        </div>
        <div class="ml-auto flex items-center gap-2 shrink-0">
          <button
            @click="toggleEnabled(p)"
            :class="p.enabled ? 'text-warning border-warning/30 hover:bg-warning/10' : 'text-primary border-primary/30 hover:bg-primary/10'"
            class="text-sm px-2.5 py-1 rounded-lg border transition-colors duration-150"
          >{{ p.enabled ? t('agents.disable') : t('agents.enable') }}</button>
          <button
            @click="startEdit(p)"
            class="text-sm px-2.5 py-1 rounded-lg border border-input text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
          >{{ t('agents.edit') }}</button>
          <button
            v-if="!p.builtin"
            @click="askDelete(p)"
            class="text-sm px-2.5 py-1 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 transition-colors duration-150"
          >{{ t('agents.delete') }}</button>
        </div>
      </div>
      <div v-if="!store.profiles.length" class="text-muted-foreground text-sm font-sans">{{ t('agents.empty') }}</div>
    </div>

    <BaseModal v-model="formOpen" closable size="xl" max-height="85vh">
      <template #header>
        <span class="text-foreground text-sm font-sans">{{ editingId ? t('agents.edit') : t('agents.add') }}</span>
      </template>

      <form id="agentForm" @submit.prevent="save" class="px-3 py-3 space-y-3">
        <div>
          <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('agents.name') }}</label>
          <input v-model="form.name" required
            class="w-full bg-surface text-foreground text-sm font-sans border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
        </div>

        <div>
          <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('agents.slug') }}</label>
          <input v-model="form.slug" required :disabled="!!editingId" pattern="[a-z0-9-]+"
            class="w-full bg-surface text-foreground text-sm font-sans border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring disabled:opacity-50" />
        </div>

        <div>
          <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('agents.description') }}</label>
          <input v-model="form.description"
            class="w-full bg-surface text-foreground text-sm font-sans border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
        </div>

        <div>
          <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('agents.systemPrompt') }}</label>
          <textarea v-model="form.systemPrompt" required rows="4"
            class="w-full bg-surface text-foreground text-sm font-sans border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring resize-y"></textarea>
        </div>

        <div>
          <div class="flex items-center gap-2 mb-1">
            <label class="text-muted-foreground text-sm font-sans">{{ t('agents.allowedTools') }}</label>
            <button type="button" @click="pickerOpen = true"
              class="ml-auto text-sm font-sans text-primary px-2 py-0.5 border border-primary/30 hover:bg-primary/10 rounded-lg transition-colors duration-150">
              {{ t('agents.selectTools') }}
            </button>
          </div>
          <div v-if="selectedTools.length" class="flex flex-wrap gap-1">
            <span v-for="name in selectedTools" :key="name"
              class="flex items-center gap-1 text-sm font-sans text-foreground bg-surface border border-border px-2 py-0.5 rounded-lg">
              {{ name }}
              <button type="button" @click="removeTool(name)" class="text-muted-foreground hover:text-danger transition-colors duration-150">✕</button>
            </span>
          </div>
          <div v-else class="text-muted-foreground/60 text-sm font-sans">{{ t('agents.allTools') }}</div>
        </div>

        <div>
          <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('agents.model') }}</label>
          <ModelSelector :models="models" v-model="form.modelId" :disabled="false" />
        </div>

        <label class="flex items-center gap-2 text-muted-foreground text-sm font-sans cursor-pointer">
          <input type="checkbox" v-model="form.enabled" class="accent-blue-600" />
          {{ t('agents.enabled') }}
        </label>

        <div v-if="formError" class="text-danger text-sm font-sans">{{ t(formError) }}</div>
      </form>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <button type="button" @click="formOpen = false"
            class="text-sm text-muted-foreground font-sans px-3 py-1.5 border border-border rounded-lg transition-colors duration-150 hover:text-foreground">
            {{ t('agents.cancel') }}
          </button>
          <button type="submit" form="agentForm"
            class="text-sm text-primary-foreground font-sans px-3 py-1.5 rounded-lg bg-primary transition-colors duration-150 hover:bg-primary/90">
            {{ t('agents.save') }}
          </button>
        </div>
      </template>
      <ToolPickerModal v-model="pickerOpen" :selected="selectedTools" @confirm="onToolsPicked" />
    </BaseModal>

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
import { storeToRefs } from 'pinia'
import { HiUserGroup } from 'vue-icons-plus/hi'
import ModelSelector from './ModelSelector.vue'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import ToolPickerModal from './ToolPickerModal.vue'
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
const selectedTools = ref<string[]>([])
const pickerOpen = ref(false)
const confirmOpen = ref(false)
const pendingDelete = ref<AgentProfile | null>(null)

const emptyForm = (): ProfileForm => ({
  slug: '', name: '', description: '', systemPrompt: '', modelId: null, enabled: true,
})
const form = reactive<ProfileForm>(emptyForm())

const allowedToolsString = computed(() =>
  selectedTools.value.length ? JSON.stringify(selectedTools.value) : '*',
)

function parseAllowedTools(value: string): string[] {
  if (!value || value === '*') return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch { /* fall through */ }
  return []
}

function startCreate() {
  editingId.value = null
  formError.value = null
  Object.assign(form, emptyForm())
  selectedTools.value = []
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
  selectedTools.value = parseAllowedTools(p.allowedTools)
  formOpen.value = true
}

function onToolsPicked(tools: string[]) {
  selectedTools.value = tools
}

function removeTool(name: string) {
  selectedTools.value = selectedTools.value.filter(t => t !== name)
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
    formOpen.value = false
    editingId.value = null
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
