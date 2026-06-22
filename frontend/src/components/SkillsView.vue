<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('skills.header') }}</span>
        <div class="ml-auto">
          <button @click="openCreate"
            class="text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 px-2.5 py-1 transition-colors duration-150">
            + {{ t('skills.add') }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl w-full px-6 pb-6">
      <div class="space-y-3">
        <div v-if="!loading && skills.length === 0" class="text-sm text-muted-foreground text-center py-8">
          {{ t('skills.empty') }}
        </div>

        <div v-for="skill in skills" :key="skill.name"
          class="flex items-center justify-between px-3 h-[3rem] border border-border rounded-lg bg-surface">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm font-medium text-foreground font-mono">/skill:{{ skill.name }}</span>
            <span class="text-sm text-muted-foreground truncate max-w-60">{{ skill.description }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button @click="openEdit(skill)"
              class="text-sm text-muted-foreground px-2 py-1 rounded border border-input hover:bg-muted transition-colors duration-150">
              {{ t('skills.edit') }}
            </button>
            <button @click="handleDelete(skill.name)"
              class="text-sm text-danger px-2 py-1 rounded border border-danger/40 hover:bg-danger/10 transition-colors duration-150">
              {{ t('skills.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseModal v-model="showModal" :closable="true" size="xl" max-height="90vh">
      <template #header>
        <span class="text-sm text-foreground font-semibold">{{ editing ? t('skills.edit_title') : t('skills.create_title') }}</span>
      </template>

      <div class="p-5">
        <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('skills.name_label') }}</label>
        <input v-model="formName" type="text" :placeholder="t('skills.name_placeholder')"
          class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />
        <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('skills.desc_label') }}</label>
        <input v-model="formDescription" type="text" :placeholder="t('skills.desc_placeholder')"
          class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />

        <div class="flex items-center justify-between mb-1">
          <label class="text-sm text-muted-foreground font-sans">{{ t('skills.content_label') }}</label>
          <button @click="openContentEditor" class="text-sm text-muted-foreground px-2 py-0.5 rounded border border-input hover:bg-muted transition-colors duration-150">⤢</button>
        </div>
        <textarea v-model="formContent" rows="12" :placeholder="t('skills.content_placeholder')"
          class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring font-mono resize-y"></textarea>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button @click="showModal = false"
            class="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted">
            {{ t('skills.cancel') }}
          </button>
          <button @click="saveSkill()" :disabled="!formName.trim() || !formContent.trim()"
            class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50">
            {{ editing ? t('skills.save') : t('skills.create') }}
          </button>
        </div>
      </template>
    </BaseModal>

    <div v-if="showContentEditor" class="fixed inset-0 z-[60] flex flex-col bg-background">
      <div class="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface shrink-0">
        <span class="text-sm font-semibold text-foreground">{{ t('skills.content_label') }}</span>
        <div class="ml-auto flex items-center gap-2">
          <button @click="contentPreview = !contentPreview"
            class="text-sm rounded-lg border border-input px-2.5 py-1.5 text-muted-foreground hover:bg-muted transition-colors duration-150">
            {{ contentPreview ? t('skills.hide_preview') : t('skills.show_preview') }}
          </button>
          <button @click="closeContentEditor"
            class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
            OK
          </button>
        </div>
      </div>
      <div class="flex-1 flex overflow-hidden px-6 py-4 gap-4">
        <div class="flex-1 flex flex-col overflow-hidden">
          <span class="text-sm text-muted-foreground font-sans mb-1 shrink-0">{{ t('skills.editor_label') }}</span>
          <textarea v-model="contentBuffer" :placeholder="t('skills.content_placeholder')"
            class="flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring font-mono resize-none"></textarea>
        </div>
        <div v-if="contentPreview" class="flex-1 flex flex-col overflow-hidden">
          <span class="text-sm text-muted-foreground font-sans mb-1 shrink-0">{{ t('skills.preview_label') }}</span>
          <div class="flex-1 overflow-y-auto rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground markdown-body" v-html="renderMarkdown(contentBuffer || '')"></div>
        </div>
      </div>
    </div>
    <BaseConfirmModal v-model="showDeleteConfirm" :title="t('skills.delete_confirm_title')" :message="t('skills.delete_confirm_message', { name: deleteTarget })" @confirm="confirmDelete" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listSkills, createSkill, updateSkill, deleteSkill } from '../api/skills'
import type { SkillItem } from '../api/skills'
import { renderMarkdown } from './cowork/markdown'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'

const { t } = useI18n()

const skills = ref<SkillItem[]>([])
const loading = ref(true)
const showModal = ref(false)
const showContentEditor = ref(false)
const editing = ref<SkillItem | null>(null)
const formName = ref('')
const formDescription = ref('')
const formContent = ref('')
const contentBuffer = ref('')
const contentPreview = ref(true)
const showDeleteConfirm = ref(false)
const deleteTarget = ref('')

onMounted(async () => {
  try { skills.value = await listSkills() } catch {}
  loading.value = false
})

function openCreate() {
  editing.value = null
  formName.value = ''
  formDescription.value = ''
  formContent.value = ''
  showModal.value = true
}

function openEdit(skill: SkillItem) {
  editing.value = skill
  formName.value = skill.name
  formDescription.value = skill.description
  formContent.value = skill.content
  showModal.value = true
}

function openContentEditor() {
  contentBuffer.value = formContent.value
  contentPreview.value = true
  showModal.value = false
  showContentEditor.value = true
}

function closeContentEditor() {
  formContent.value = contentBuffer.value
  showContentEditor.value = false
  showModal.value = true
}

async function saveSkill() {
  const data: SkillItem = {
    name: formName.value.trim(),
    description: formDescription.value.trim(),
    content: formContent.value.trim(),
  }
  try {
    if (editing.value) {
      await updateSkill(editing.value.name, data)
    } else {
      await createSkill(data)
    }
    skills.value = await listSkills()
    showModal.value = false
  } catch {}
}

async function handleDelete(name: string) {
  deleteTarget.value = name
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  try {
    await deleteSkill(deleteTarget.value)
    skills.value = await listSkills()
  } catch {}
  showDeleteConfirm.value = false
}
</script>
