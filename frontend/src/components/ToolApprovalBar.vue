<template>
  <div class="max-w-60rem mx-auto w-full px-3 mb-2">
    <div class="border border-amber-300 bg-amber-50 rounded-md px-3 py-2">
      <div class="flex items-center gap-2 mb-1">
        <HiShieldExclamation class="w-3.5 h-3.5 text-warning shrink-0" />
        <span class="text-sm text-warning font-medium">
          Tool '{{ name }}' {{ t('approval.required') }}
        </span>
      </div>

      <div
        class="text-xs text-muted-foreground font-sans break-all"
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
        class="block text-xs text-muted-foreground mb-2 hover:text-primary transition-colors duration-150"
      >
        {{ expanded ? t('approval.show_less') : t('approval.show_more') }}
      </button>

      <div class="w-full h-1 bg-amber-200 rounded-full mb-2 overflow-hidden">
        <div
          class="h-full bg-amber-500 transition-all duration-1000 linear"
          :style="{ width: (remaining / total * 100) + '%' }"
        ></div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-xs text-muted-foreground font-sans">{{ remaining }}s / {{ total }}s</div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">{{ t('approval.keyboard_hint') }}</span>
          <div class="flex gap-2">
            <button
              @click="emit('approve', id)"
              class="text-sm text-primary-foreground px-3 py-1 rounded-lg bg-primary transition-colors duration-150 hover:bg-primary/90"
            >
              {{ t('approval.allow') }}
            </button>
            <button
              @click="emit('deny', id)"
              class="text-sm text-muted-foreground px-3 py-1 rounded-lg border border-input bg-surface transition-colors duration-150 hover:bg-muted"
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

