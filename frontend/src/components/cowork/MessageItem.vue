<template>
  <div class="font-mono">
    <div v-if="isThinking" class="border-l-2 border-cyber-accent/30 pl-3 py-1">
      <div class="text-sm text-cyber-accent/60 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
    </div>

    <div v-else-if="msg.role === 'tool' && !msg.isResult"
      class="border-l-2 border-cyber-orange/50 pl-3 py-1.5">
      <template v-if="isToolLong(msg.content)">
        <div v-if="!isToolExpanded" class="text-sm text-cyber-orange font-mono break-all">[⚙] {{ toolPreview(msg.content) }}</div>
        <div v-if="!isToolExpanded" class="text-xs text-cyber-muted font-mono">...</div>
        <div v-if="isToolExpanded" class="text-sm text-cyber-orange font-mono break-all">[⚙] {{ msg.content }}</div>
        <button @click="toggleToolExpand" class="text-xs font-mono mt-0.5 text-cyber-accent/60 hover:text-cyber-accent transition-colors duration-150">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-cyber-orange font-mono break-all">[⚙] {{ msg.content }}</div>
    </div>

    <div v-else-if="msg.role === 'tool' && msg.isResult"
      class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
      <template v-if="isToolLong(msg.content)">
        <div v-if="!isToolExpanded" class="text-sm text-cyber-green font-mono whitespace-pre-wrap break-all">{{ toolPreview(msg.content) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-cyber-muted font-mono mt-0.5">...</div>
        <div v-if="isToolExpanded" class="text-sm text-cyber-green font-mono whitespace-pre-wrap break-all">{{ msg.content }}</div>
        <button @click="toggleToolExpand" class="text-sm font-mono mt-0.5 transition-colors duration-150 text-cyber-accent/60 hover:text-cyber-accent">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-cyber-green font-mono whitespace-pre-wrap break-all">{{ msg.content }}</div>
    </div>

    <div v-else-if="msg.role === 'agent'"
      class="border-l-2 border-cyber-accent/80 pl-3 py-1">
      <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">
        <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
      </div>
      <div v-if="msg.typing" class="text-sm leading-relaxed break-words text-cyber-text markdown-body" v-html="renderMarkdown(msg.content)"></div>
      <template v-else>
        <template v-for="(seg, si) in parseSegments(msg.content)" :key="si">
          <div v-if="seg.type === 'markdown'" class="text-sm leading-relaxed break-words text-cyber-text markdown-body" v-html="seg.content" />
          <FormBlock v-else :html="seg.content" :index="si" @submit="(data: Record<string, string>) => emit('formSubmit', data)" />
        </template>
      </template>
    </div>

    <div v-else-if="msg.role === 'plan' && msg.plan"
      class="border-l-2 border-cyber-accent/80 pl-3 py-1">
      <div class="text-sm text-cyber-accent/80 mb-1 font-mono">
        <HiChevronRight class="w-3 h-3 inline" /> plan · {{ msg.timestamp }}
      </div>
      <PlanBubble
        :plan="msg.plan"
        :streaming="streaming"
        @approve="(id: number) => emit('approve', id)"
        @reject="(id: number) => emit('reject', id)"
        @resume="(id: number) => emit('resume', id)"
      />
    </div>

    <div v-else-if="msg.role === 'user'"
      class="border-l-2 border-cyber-accent/80 pl-3 py-1">
      <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
      <div class="text-sm leading-relaxed break-words text-cyber-text" v-html="highlightUserMessage(msg.content)"></div>
    </div>

    <div v-else-if="msg.role === 'system'"
      class="pl-3 py-0.5">
      <template v-if="isToolLong(msg.content)">
        <div v-if="!isToolExpanded" class="text-sm text-cyber-muted font-mono">{{ toolPreview(msg.content) }}</div>
        <div v-if="!isToolExpanded" class="text-xs text-cyber-muted font-mono">...</div>
        <div v-if="isToolExpanded" class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
        <button @click="toggleToolExpand" class="text-xs font-mono mt-0.5 text-cyber-accent/60 hover:text-cyber-accent transition-colors duration-150">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { HiChevronRight } from 'vue-icons-plus/hi'
import FormBlock from '../FormBlock.vue'
import PlanBubble from '../PlanBubble.vue'
import { renderMarkdown, parseSegments, highlightUserMessage } from './markdown'
import type { Message } from './types'

const props = defineProps<{
  msg: Message
  streaming: boolean
}>()

const emit = defineEmits<{
  formSubmit: [data: Record<string, string>]
  approve: [id: number]
  reject: [id: number]
  resume: [id: number]
  toggleExpand: [msg: Message]
}>()

const { t } = useI18n()

const isThinking = computed(() =>
  props.msg.role === 'system' && (props.msg.content === '⟳ thinking...' || props.msg.content === '⟳ đang nghĩ...')
)

function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  if (role === 'system') return t('chat.system.prefix')
  return ''
}

const toolExpanded = ref(false)
const isToolExpanded = computed(() => toolExpanded.value)

function isToolLong(content: string): boolean {
  return content.split('\n').length > 5 || content.length > 500
}

function toolPreview(content: string): string {
  const lines = content.split('\n')
  if (lines.length > 5) return lines.slice(0, 5).join('\n')
  return content.length > 200 ? content.slice(0, 200) + '...' : content
}

function toggleToolExpand(): void {
  toolExpanded.value = !toolExpanded.value
  emit('toggleExpand', props.msg)
}
</script>
