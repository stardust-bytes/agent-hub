import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { MessageSegment } from './types'

export function renderMarkdown(content: string): string {
  let html = marked.parse(content) as string
  html = html.replace(
    /\[Source:\s*([^\]]+)\]/g,
    (_m, content) => {
      const sources: string[] = []
      const re = /&quot;([^&]+)&quot;[^§]*§(\d+)/g
      let m
      while ((m = re.exec(content)) !== null) {
        sources.push(`<span class="citation">[📄 ${m[1]} · §${m[2]}]</span>`)
      }
      return sources.join(' ')
    },
  )
  return DOMPurify.sanitize(html)
}

export function parseSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const formRegex = /```form\s*\n([\s\S]*?)```/g
  let lastIndex = 0
  let m

  while ((m = formRegex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      const markdownPart = content.slice(lastIndex, m.index).trim()
      if (markdownPart) {
        segments.push({ type: 'markdown', content: renderMarkdown(markdownPart) })
      }
    }
    segments.push({ type: 'form', content: m[1].trim() })
    lastIndex = m.index + m[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim()
    if (remaining) {
      segments.push({ type: 'markdown', content: renderMarkdown(remaining) })
    }
  }

  return segments
}

export function highlightUserMessage(content: string): string {
  return DOMPurify.sanitize(highlightSlash(content))
}

function highlightSlash(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (text.startsWith('/')) {
    const spaceIdx = text.indexOf(' ')
    if (spaceIdx !== -1) {
      const cmd = text.slice(0, spaceIdx)
      const rest = text.slice(spaceIdx)
      return `<span class="text-cyber-cyan">${esc(cmd)}</span><span class="text-cyber-text">${esc(rest)}</span>`
    }
    return `<span class="text-cyber-cyan">${esc(text)}</span>`
  }
  return `<span class="text-cyber-text">${esc(text)}</span>`
}
