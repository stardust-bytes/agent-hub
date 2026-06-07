<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">◈ {{ t('artifacts.header') }}</span>
      <span v-if="lastMessage" class="text-cyber-accent/40 text-xs font-mono">{{ t('artifacts.label.lastReply') }}</span>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      <div
        v-if="!lastMessage"
        class="flex items-center justify-center h-full text-cyber-accent/30 text-sm font-mono"
      >
        {{ t('artifacts.empty') }}
      </div>

      <template v-else>
        <div v-for="(block, i) in codeBlocks" :key="`code-${i}`" class="mb-3">
          <div class="bg-cyber-dark border border-cyber-border rounded overflow-hidden">
            <div class="px-3 py-1 border-b border-cyber-border text-cyber-accent/50 text-xs font-mono">
              {{ block.lang || 'code' }}
            </div>
            <pre class="px-3 py-2 text-xs text-slate-300 overflow-x-auto leading-relaxed font-mono">{{ block.code }}</pre>
          </div>
        </div>

        <div
          v-if="proseHtml"
          class="text-sm text-slate-300 leading-relaxed font-mono prose-invert"
          v-html="proseHtml"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{ lastMessage: string }>()
const { t } = useI18n()

interface CodeBlock {
  lang: string
  code: string
}

const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g

const codeBlocks = computed<CodeBlock[]>(() => {
  if (!props.lastMessage) return []
  const blocks: CodeBlock[] = []
  const re = new RegExp(CODE_FENCE_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(props.lastMessage)) !== null) {
    blocks.push({ lang: match[1] ?? '', code: match[2].trimEnd() })
  }
  return blocks
})

const proseHtml = computed<string>(() => {
  if (!props.lastMessage) return ''
  const prose = props.lastMessage.replace(new RegExp(CODE_FENCE_RE.source, 'g'), '').trim()
  if (!prose) return ''
  const raw = marked.parse(prose) as string
  return DOMPurify.sanitize(raw)
})
</script>
