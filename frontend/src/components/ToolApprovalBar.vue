<template>
  <div class="max-w-60rem mx-auto w-full px-3 mb-2">
    <div class="border border-cyber-orange/60 bg-cyber-dark px-3 py-2">
      <div class="flex items-center gap-2 mb-1">
        <HiShieldExclamation class="w-3 h-3 text-cyber-orange shrink-0" />
        <span class="text-sm text-cyber-orange font-mono">
          Tool '{{ name }}' {{ t('approval.required') }}
        </span>
      </div>

      <div
        class="text-2xs text-cyber-muted font-mono break-all"
        :class="[
          isLong && !expanded ? 'line-clamp-2 overflow-hidden' : (isLong ? 'overflow-y-auto' : ''),
          isLong ? 'mb-1' : 'mb-2'
        ]"
        :style="isLong && expanded ? { maxHeight: maxExpandHeight + 'px' } : {}"
      >
        {{ t('approval.args') }}: {{ args }}
      </div>

      <button
        v-if="isLong"
        @click="expanded = !expanded"
        class="block text-2xs text-cyber-muted font-mono mb-2 hover:text-cyber-accent transition-colors duration-150"
      >
        {{ expanded ? t('approval.show_less') : t('approval.show_more') }}
      </button>

      <div class="w-full h-1 bg-cyber-code-border mb-2">
        <div
          class="h-full bg-cyber-orange transition-all duration-1000 linear"
          :style="{ width: (remaining / total * 100) + '%' }"
        ></div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-2xs text-cyber-muted font-mono">{{ remaining }}s / {{ total }}s</div>
        <div class="flex items-center gap-3">
          <span class="text-2xs text-cyber-muted font-mono">{{ t('approval.keyboard_hint') }}</span>
          <div class="flex gap-2">
            <button
              @click="emit('approve', id)"
              class="text-sm text-white font-mono px-2 py-1 bg-cyber-accent transition-colors duration-150 hover:bg-cyber-accent/80"
            >
              {{ t('approval.allow') }}
            </button>
            <button
              @click="emit('deny', id)"
              class="text-sm text-cyber-text font-mono px-2 py-1 border border-cyber-code-border transition-colors duration-150 hover:bg-cyber-dark"
            >
              {{ t('approval.deny') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiShieldExclamation } from 'vue-icons-plus/hi'

const props = defineProps<{
  id: string
  name: string
  args: string
  remaining: number
  total: number
  maxExpandHeight: number
}>()

const emit = defineEmits<{
  (e: 'approve', id: string): void
  (e: 'deny', id: string): void
}>()

const { t } = useI18n()

const expanded = ref(false)
const isLong = computed(() => props.args.length > 500)

watch(() => props.args, () => { expanded.value = false })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('approve', props.id)
  if (e.key === 'Escape') emit('deny', props.id)
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

