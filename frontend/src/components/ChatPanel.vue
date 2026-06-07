<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">◈ AGENT CHAT</span>
      <span class="text-cyber-accent/40 text-xs font-mono">stub mode</span>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">
        <div class="text-xs mb-1" :class="roleColor(msg.role)">
          {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
        </div>
        <div
          class="text-sm leading-relaxed break-words"
          :class="{
            'text-cyber-accent/50': msg.role === 'system',
            'text-slate-300': msg.role === 'agent',
            'text-slate-100': msg.role === 'user',
          }"
        >
          {{ msg.content }}<span v-if="msg.typing" class="animate-blink text-cyber-accent ml-px">█</span>
        </div>
      </div>
    </div>

    <div class="px-3 py-2 border-t border-cyber-border bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 border border-cyber-dim rounded px-3 py-2">
        <span class="text-cyber-accent text-sm font-mono">$</span>
        <input
          v-model="input"
          class="flex-1 bg-transparent text-slate-100 text-sm outline-none font-mono placeholder-cyber-accent/30"
          placeholder="type a command or question_"
          :disabled="loading"
          autocomplete="off"
          spellcheck="false"
        />
        <span v-if="!loading" class="animate-blink text-cyber-accent text-sm">█</span>
        <span v-else class="text-cyber-accent/50 text-xs">…</span>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface Message {
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: string
  typing?: boolean
}

const emit = defineEmits<{ lastMessage: [content: string] }>()

const messages = ref<Message[]>([
  {
    role: 'system',
    content: 'Agent initialized. SQLite connected. Stub mode active.',
    timestamp: now(),
  },
])
const input = ref('')
const loading = ref(false)
const messagesEl = ref<HTMLElement | null>(null)

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return '$ user'
  if (role === 'agent') return '▶ agent'
  return '[system]'
}

function roleColor(role: string): string {
  if (role === 'user') return 'text-cyber-accent/60'
  if (role === 'agent') return 'text-cyber-accent'
  return 'text-cyber-accent/40'
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

async function submit() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  loading.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(err.message ?? `HTTP ${res.status}`)
    }

    const data: { reply: string; timestamp: string } = await res.json()
    await typewriterAppend(data.reply)
    emit('lastMessage', data.reply)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    messages.value.push({
      role: 'system',
      content: `[error] ${msg}. Is the backend running?`,
      timestamp: now(),
    })
    await scrollToBottom()
  } finally {
    loading.value = false
  }
}

async function typewriterAppend(fullText: string) {
  const msg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
  messages.value.push(msg)
  await scrollToBottom()

  for (const char of fullText) {
    msg.content += char
    await new Promise<void>(resolve => setTimeout(resolve, 18))
    await scrollToBottom()
  }
  msg.typing = false
}
</script>
