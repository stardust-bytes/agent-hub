<template>
  <BaseModal
    :model-value="modelValue"
    closable
    size="lg"
    max-height="70vh"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <span class="text-foreground text-sm font-sans">{{ t('agents.toolsHeader') }}</span>
    </template>

    <div class="px-3 py-2">
      <input
        v-model="filter"
        :placeholder="t('agents.toolsSearch')"
        class="w-full bg-surface text-foreground text-sm font-sans border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring mb-2"
        autocomplete="off"
      />
      <div v-if="loading" class="text-muted-foreground text-sm font-sans">{{ t('tools.loading') }}</div>
      <div v-else class="space-y-0.5">
        <label
          v-for="tool in filteredTools"
          :key="tool.name"
          class="flex items-start gap-2 px-2 py-1.5 cursor-pointer hover:bg-surface transition-colors duration-150"
        >
          <input type="checkbox" :value="tool.name" v-model="checked" class="accent-blue-600 mt-0.5 shrink-0" />
          <span class="min-w-0">
            <span class="text-foreground text-sm font-sans block">{{ tool.name }}</span>
            <span class="text-muted-foreground/60 text-sm font-sans block truncate">{{ tool.description }}</span>
          </span>
        </label>
        <div v-if="!filteredTools.length" class="text-muted-foreground text-sm font-sans py-2">{{ t('tools.no_tools') }}</div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-2 justify-end">
        <span class="text-muted-foreground/60 text-sm font-sans mr-auto">{{ t('agents.toolsSelected', { n: checked.length }) }}</span>
        <button
          type="button"
          @click="$emit('update:modelValue', false)"
          class="text-sm font-sans text-muted-foreground px-3 py-1.5 hover:text-foreground transition-colors duration-150"
        >{{ t('agents.cancel') }}</button>
        <button
          type="button"
          @click="confirm"
          class="text-sm font-sans text-primary px-3 py-1.5 border border-primary/30 hover:bg-primary/10 rounded-lg transition-colors duration-150"
        >{{ t('agents.addTools') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import { listTools } from '../api/tools'
import type { Tool } from '../api/tools'

const props = defineProps<{ modelValue: boolean; selected: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [tools: string[]] }>()

const { t } = useI18n()
const tools = ref<Tool[]>([])
const loading = ref(false)
const filter = ref('')
const checked = ref<string[]>([])
let loaded = false

const filteredTools = computed(() => {
  const q = filter.value.toLowerCase()
  return tools.value.filter(tl => tl.name.toLowerCase().includes(q) || tl.description.toLowerCase().includes(q))
})

watch(() => props.modelValue, async (val) => {
  if (!val) return
  checked.value = [...props.selected]
  filter.value = ''
  if (!loaded) {
    loading.value = true
    try { tools.value = await listTools() } catch { /* surfaced as empty list */ }
    loading.value = false
    loaded = true
  }
})

function confirm() {
  emit('confirm', [...checked.value])
  emit('update:modelValue', false)
}
</script>
