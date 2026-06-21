<template>
  <div>
    <div v-if="isThinking" class="border-l-2 border-blue-200 pl-3 py-1">
      <div class="text-sm text-gray-500 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
    </div>

    <div v-else-if="msg.role === 'tool' && !msg.isResult"
      class="border-l-2 border-amber-300 pl-3 py-1.5">
      <div v-if="subagentBadge" class="text-xs text-blue-600 font-mono mb-0.5">{{ subagentBadge }}</div>
      <template v-if="isToolLong(toolContent)">
        <div v-if="!isToolExpanded" class="text-sm text-amber-700 font-mono break-all">[⚙] {{ toolPreview(toolContent) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-gray-400 font-mono">...</div>
        <div v-if="isToolExpanded" class="text-sm text-amber-700 font-mono break-all">[⚙] {{ toolContent }}</div>
        <button @click="toggleToolExpand" class="text-sm mt-0.5 text-blue-600 hover:text-blue-700 transition-colors duration-150">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-amber-700 font-mono break-all">[⚙] {{ toolContent }}</div>
    </div>

    <div v-else-if="msg.role === 'tool' && msg.isResult"
      class="border-l-2 border-green-300 pl-3 py-1.5">
      <div v-if="subagentBadge" class="text-xs text-blue-600 font-mono mb-0.5">{{ subagentBadge }}</div>
      <template v-if="isToolLong(toolContent)">
        <div v-if="!isToolExpanded" class="text-sm text-green-700 font-mono whitespace-pre-wrap break-all">{{ toolPreview(toolContent) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-gray-400 font-mono mt-0.5">...</div>
        <div v-if="isToolExpanded" class="text-sm text-green-700 font-mono whitespace-pre-wrap break-all">{{ toolContent }}</div>
        <button @click="toggleToolExpand" class="text-sm mt-0.5 transition-colors duration-150 text-blue-600 hover:text-blue-700">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-green-700 font-mono whitespace-pre-wrap break-all">{{ toolContent }}</div>
    </div>

    <div v-else-if="msg.role === 'agent'"
      class="border-l-2 border-blue-500 pl-3 py-1">
      <div class="text-sm text-blue-600 mb-0.5 font-medium">
        <HiChevronRight class="w-4 h-4 inline-block text-gray-400" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
      </div>
      <div v-if="msg.typing" class="text-sm leading-relaxed break-words text-gray-800 markdown-body" v-html="renderMarkdown(msg.content)"></div>
      <template v-else>
        <template v-for="(seg, si) in parseSegments(msg.content)" :key="si">
          <div v-if="seg.type === 'markdown'" class="text-sm leading-relaxed break-words text-gray-800 markdown-body" v-html="seg.content" />
          <FormBlock v-else :html="seg.content" :index="si" @submit="(data: Record<string, string>) => emit('formSubmit', data)" />
        </template>
      </template>
    </div>

    <div v-else-if="msg.role === 'plan' && msg.plan"
      class="border-l-2 border-blue-500 pl-3 py-1">
      <div class="text-sm text-blue-600 mb-1 font-medium">
        <HiChevronRight class="w-4 h-4 inline-block text-gray-400" /> plan · {{ msg.timestamp }}
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
      class="border-l-2 border-gray-300 pl-3 py-1">
      <div class="text-sm text-gray-500 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
      <div class="text-sm leading-relaxed break-words text-gray-900" v-html="highlightUserMessage(msg.content)"></div>
    </div>

    <div v-else-if="msg.role === 'system'"
      class="pl-3 py-0.5">
      <template v-if="isToolLong(msg.content)">
        <div v-if="!isToolExpanded" class="text-sm text-gray-500 font-mono">{{ toolPreview(msg.content) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-gray-500 font-mono">...</div>
        <div v-if="isToolExpanded" class="text-sm text-gray-500 font-mono">{{ msg.content }}</div>
        <button @click="toggleToolExpand" class="text-sm mt-0.5 text-blue-600 hover:text-blue-700 transition-colors duration-150">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-gray-500 font-mono">{{ msg.content }}</div>
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

const subagentPattern = /^\[subagent:([^\]]+)\]\s*(.*)$/

const toolContent = computed(() => {
  if (props.msg.role !== 'tool') return props.msg.content
  const m = props.msg.content.match(subagentPattern)
  return m ? m[2] : props.msg.content
})

const subagentBadge = computed(() => {
  if (props.msg.role !== 'tool') return null
  const m = props.msg.content.match(subagentPattern)
  return m ? `◈ ${m[1]}` : null
})

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
