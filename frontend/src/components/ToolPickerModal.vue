<template>
  <BaseModal
    :model-value="modelValue"
    closable
    size="lg"
    max-height="70vh"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <span class="text-cyber-text text-sm font-mono">{{ t('agents.toolsHeader') }}</span>
    </template>

    <div class="px-3 py-2">
      <input
        v-model="filter"
        :placeholder="t('agents.toolsSearch')"
        class="w-full bg-cyber-dark text-cyber-text text-sm font-mono border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent mb-2"
        autocomplete="off"
      />
      <div v-if="loading" class="text-cyber-muted text-sm font-mono">{{ t('tools.loading') }}</div>
      <div v-else class="space-y-0.5">
        <label
          v-for="tool in filteredTools"
          :key="tool.name"
          class="flex items-start gap-2 px-2 py-1.5 cursor-pointer hover:bg-cyber-dark transition-colors duration-150"
        >
          <input type="checkbox" :value="tool.name" v-model="checked" class="accent-cyber-accent mt-0.5 shrink-0" />
          <span class="min-w-0">
            <span class="text-cyber-text text-sm font-mono block">{{ tool.name }}</span>
            <span class="text-cyber-muted/60 text-sm font-mono block truncate">{{ tool.description }}</span>
          </span>
        </label>
        <div v-if="!filteredTools.length" class="text-cyber-muted text-sm font-mono py-2">{{ t('tools.no_tools') }}</div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-2 justify-end">
        <span class="text-cyber-muted/60 text-sm font-mono mr-auto">{{ t('agents.toolsSelected', { n: checked.length }) }}</span>
        <button
          type="button"
          @click="$emit('update:modelValue', false)"
          class="text-sm font-mono text-cyber-muted px-3 py-1.5 hover:text-cyber-text transition-colors duration-150"
        >{{ t('agents.cancel') }}</button>
        <button
          type="button"
          @click="confirm"
          class="text-sm font-mono text-cyber-accent px-3 py-1.5 border border-cyber-accent/30 hover:bg-cyber-accent/10 transition-colors duration-150"
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
