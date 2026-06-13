import type { Component } from 'vue'
import { HiCode, HiDocumentText, HiCog, HiDownload } from 'vue-icons-plus/hi'

export interface NavItem {
  name: string
  path: string
  labelKey: string
  icon: Component | string
}

export const NAV: Record<string, NavItem> = {
  cowork:          { name: 'cowork',        path: '/cowork',        labelKey: 'nav.cowork',      icon: HiCode },
  notes:           { name: 'notes',         path: '/notes',         labelKey: 'nav.notes',       icon: HiDocumentText },
  connectors:      { name: 'connectors',    path: '/connectors',    labelKey: 'nav.connectors',  icon: HiCog },
  'agent-output':  { name: 'agent-output',  path: '/agent-output',  labelKey: 'nav.agentOutput', icon: HiDownload },
  plans:           { name: 'plans',         path: '/plans',         labelKey: 'nav.plans',       icon: '📋' },
  settings:        { name: 'settings',      path: '/settings',      labelKey: 'nav.settings',    icon: HiCog },
}

export function pickNav(names: string[]): NavItem[] {
  return names.map(n => NAV[n])
}

export const sidebarItems = pickNav(['cowork', 'notes', 'connectors', 'agent-output'])
export const settingsNav = NAV.settings
export const bottomItems = pickNav(['cowork', 'agent-output', 'plans', 'notes', 'connectors', 'settings'])
