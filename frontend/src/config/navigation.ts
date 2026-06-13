import type { Component } from 'vue'
import { HiCode, HiClipboardList, HiDocumentText, HiCog, HiDownload } from 'vue-icons-plus/hi'

export interface NavItem {
  name: string
  path: string
  labelKey: string
  icon: Component | string
}

export const navItems: NavItem[] = [
  { name: 'cowork', path: '/cowork', labelKey: 'nav.cowork', icon: HiCode },
  { name: 'tasks', path: '/tasks', labelKey: 'nav.tasks', icon: HiClipboardList },
  { name: 'notes', path: '/notes', labelKey: 'nav.notes', icon: HiDocumentText },
  { name: 'connectors', path: '/connectors', labelKey: 'nav.connectors', icon: HiCog },
  { name: 'agent-output', path: '/agent-output', labelKey: 'nav.agentOutput', icon: HiDownload },
]

export const settingsNav: NavItem = { name: 'settings', path: '/settings', labelKey: 'nav.settings', icon: HiCog }
