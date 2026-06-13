<template>
  <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
    <div class="max-w-60rem mx-auto space-y-4 px-3">
      <MessageItem
        v-for="(msg, i) in messages"
        :key="i"
        :msg="msg"
        :streaming="streaming"
        @form-submit="(data: Record<string, string>) => emit('formSubmit', data)"
        @approve="(id: number) => emit('approve', id)"
        @reject="(id: number) => emit('reject', id)"
        @resume="(id: number) => emit('resume', id)"
        @toggle-expand="(msg: Message) => emit('toggleExpand', msg)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'
import type { Message } from './types'

defineProps<{
  messages: Message[]
  streaming: boolean
}>()

const emit = defineEmits<{
  formSubmit: [data: Record<string, string>]
  approve: [id: number]
  reject: [id: number]
  resume: [id: number]
  toggleExpand: [msg: Message]
}>()

const messagesEl = ref<HTMLElement | null>(null)

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

defineExpose({ scrollToBottom })
</script>
