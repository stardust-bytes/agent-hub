<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('skills.header') }}</span>
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
        <span class="text-xs text-muted-foreground truncate max-w-60">{{ skill.description }}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button @click="openEdit(skill)"
          class="text-xs text-muted-foreground px-2 py-1 rounded border border-input hover:bg-muted transition-colors duration-150">
          {{ t('skills.edit') }}
        </button>
        <button @click="handleDelete(skill.name)"
          class="text-xs text-danger px-2 py-1 rounded border border-danger/40 hover:bg-danger/10 transition-colors duration-150">
          {{ t('skills.delete') }}
        </button>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showModal = false">
      <div class="w-full max-w-lg rounded-xl bg-elevated p-5 shadow-xl border border-border">
        <h3 class="text-sm font-semibold text-foreground mb-3">{{ editing ? t('skills.edit_title') : t('skills.create_title') }}</h3>
        <label class="text-xs text-muted-foreground font-sans mb-1 block">{{ t('skills.name_label') }}</label>
        <input v-model="formName" type="text" :placeholder="t('skills.name_placeholder')"
          class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />
        <label class="text-xs text-muted-foreground font-sans mb-1 block">{{ t('skills.desc_label') }}</label>
        <input v-model="formDescription" type="text" :placeholder="t('skills.desc_placeholder')"
          class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />
        <label class="text-xs text-muted-foreground font-sans mb-1 block">{{ t('skills.content_label') }}</label>
        <textarea v-model="formContent" rows="10" :placeholder="t('skills.content_placeholder')"
          class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3 font-mono resize-y"></textarea>
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
      </div>
    </div>
  </div>
</div>
</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listSkills, createSkill, updateSkill, deleteSkill } from '../api/skills'
import type { SkillItem } from '../api/skills'

const { t } = useI18n()

const skills = ref<SkillItem[]>([])
const loading = ref(true)
const showModal = ref(false)
const editing = ref<SkillItem | null>(null)
const formName = ref('')
const formDescription = ref('')
const formContent = ref('')

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
  try {
    await deleteSkill(name)
    skills.value = await listSkills()
  } catch {}
}
</script>
