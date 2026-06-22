<template>
  <div>
    <div v-if="isThinking" class="border-l-2 border-primary/30 pl-3 py-1">
      <div class="text-sm text-muted-foreground font-sans">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
    </div>

    <div v-else-if="msg.role === 'tool' && !msg.isResult"
      class="border-l-2 border-amber-300 pl-3 py-1.5">
      <div v-if="subagentBadge" class="text-xs text-primary font-sans mb-0.5">{{ subagentBadge }}</div>
      <template v-if="isToolLong(toolContent)">
        <div v-if="!isToolExpanded" class="text-sm text-warning font-sans break-all">[⚙] {{ toolPreview(toolContent) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-muted-foreground font-sans">...</div>
        <div v-if="isToolExpanded" class="text-sm text-warning font-sans break-all">[⚙] {{ toolContent }}</div>
        <button @click="toggleToolExpand" class="text-sm mt-0.5 text-primary hover:text-primary transition-colors duration-150">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-warning font-sans break-all">[⚙] {{ toolContent }}</div>
    </div>

    <div v-else-if="msg.role === 'tool' && msg.isResult"
      class="border-l-2 border-green-300 pl-3 py-1.5">
      <div v-if="subagentBadge" class="text-xs text-primary font-sans mb-0.5">{{ subagentBadge }}</div>
      <template v-if="isToolLong(toolContent)">
        <div v-if="!isToolExpanded" class="text-sm text-success font-sans whitespace-pre-wrap break-all">{{ toolPreview(toolContent) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-muted-foreground font-sans mt-0.5">...</div>
        <div v-if="isToolExpanded" class="text-sm text-success font-sans whitespace-pre-wrap break-all">{{ toolContent }}</div>
        <button @click="toggleToolExpand" class="text-sm mt-0.5 transition-colors duration-150 text-primary hover:text-primary">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-success font-sans whitespace-pre-wrap break-all">{{ toolContent }}</div>
    </div>

    <div v-else-if="msg.role === 'agent'"
      class="border-l-2 border-primary pl-3 py-1">
      <div class="text-sm text-primary mb-0.5 font-medium">
        <HiChevronRight class="w-4 h-4 inline-block text-muted-foreground" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
      </div>
      <div v-if="msg.typing" class="text-sm leading-relaxed break-words text-foreground markdown-body" v-html="renderMarkdown(msg.content)"></div>
      <template v-else>
        <template v-for="(seg, si) in parseSegments(msg.content)" :key="si">
          <div v-if="seg.type === 'markdown'" class="text-sm leading-relaxed break-words text-foreground markdown-body" v-html="seg.content" />
          <FormBlock v-else :html="seg.content" :index="si" @submit="(data: Record<string, string>) => emit('formSubmit', data)" />
        </template>
      </template>
    </div>

    <div v-else-if="msg.role === 'plan' && msg.plan"
      class="border-l-2 border-primary pl-3 py-1">
      <div class="text-sm text-primary mb-1 font-medium">
        <HiChevronRight class="w-4 h-4 inline-block text-muted-foreground" /> plan · {{ msg.timestamp }}
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
      class="border-l-2 border-input pl-3 py-1">
      <div class="text-sm text-muted-foreground mb-0.5 font-sans">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
      <div class="text-sm leading-relaxed break-words text-foreground" v-html="highlightUserMessage(msg.content)"></div>
    </div>

    <div v-else-if="msg.role === 'system'"
      class="pl-3 py-0.5">
      <template v-if="isToolLong(msg.content)">
        <div v-if="!isToolExpanded" class="text-sm text-muted-foreground font-sans">{{ toolPreview(msg.content) }}</div>
        <div v-if="!isToolExpanded" class="text-sm text-muted-foreground font-sans">...</div>
        <div v-if="isToolExpanded" class="text-sm text-muted-foreground font-sans">{{ msg.content }}</div>
        <button @click="toggleToolExpand" class="text-sm mt-0.5 text-primary hover:text-primary transition-colors duration-150">{{ isToolExpanded ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
      </template>
      <div v-else class="text-sm text-muted-foreground font-sans">{{ msg.content }}</div>
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
