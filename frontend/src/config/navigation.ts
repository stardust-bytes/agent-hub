import type { Component } from 'vue'
import {
  HiCode, HiClipboardList, HiDocumentText, HiCog, HiDownload,
  HiClipboardCheck, HiFolder, HiDatabase, HiServer, HiUserGroup,
  HiAdjustments, HiShieldCheck, HiChartBar,
} from 'vue-icons-plus/hi'

export interface NavItem {
  name: string
  path: string
  labelKey: string
  icon: Component | string
}

export interface NavGroup {
  labelKey: string
  items: NavItem[]
}

export const NAV: Record<string, NavItem> = {
  cowork:          { name: 'cowork',        path: '/cowork',        labelKey: 'nav.cowork',      icon: HiCode },
  tasks:           { name: 'tasks',         path: '/tasks',         labelKey: 'nav.tasks',       icon: HiClipboardList },
  plans:           { name: 'plans',         path: '/plans',         labelKey: 'nav.plans',       icon: HiClipboardCheck },
  'agent-output':  { name: 'agent-output',  path: '/agent-output',  labelKey: 'nav.agentOutput', icon: HiDownload },
  notes:           { name: 'notes',         path: '/notes',         labelKey: 'nav.notes',       icon: HiDocumentText },
  files:           { name: 'files',         path: '/settings/general', labelKey: 'nav.files',    icon: HiFolder },
  connectors:      { name: 'connectors',    path: '/connectors',    labelKey: 'nav.connectors',  icon: HiCog },
  settings:        { name: 'settings',      path: '/settings',      labelKey: 'nav.settings',    icon: HiCog },
}

export const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.group.workspace',
    items: [
      { name: 'cowork',       path: '/cowork',       labelKey: 'nav.cowork',      icon: HiCode },
      { name: 'tasks',        path: '/tasks',        labelKey: 'nav.tasks',       icon: HiClipboardList },
      { name: 'plans',        path: '/plans',        labelKey: 'nav.plans',       icon: HiClipboardCheck },
      { name: 'agent-output', path: '/agent-output', labelKey: 'nav.agentOutput', icon: HiDownload },
    ],
  },
  {
    labelKey: 'nav.group.knowledge',
    items: [
      { name: 'notes',       path: '/notes',             labelKey: 'nav.notes',      icon: HiDocumentText },
      { name: 'memories',    path: '/settings/memories', labelKey: 'memory.title',   icon: HiDatabase },
    ],
  },
  {
    labelKey: 'nav.group.config',
    items: [
      { name: 'providers',   path: '/settings/providers',   labelKey: 'providers.header',   icon: HiServer },
      { name: 'agents',      path: '/settings/agents',      labelKey: 'agents.header',      icon: HiUserGroup },
      { name: 'tools',       path: '/settings/tools',       labelKey: 'tools.header',       icon: HiAdjustments },
      { name: 'connectors',  path: '/connectors',           labelKey: 'nav.connectors',     icon: HiCog },
      { name: 'permissions', path: '/settings/permissions', labelKey: 'permissions.header', icon: HiShieldCheck },
      { name: 'usage',       path: '/settings/usage',       labelKey: 'usage.header',       icon: HiChartBar },
      { name: 'general',     path: '/settings/general',     labelKey: 'nav.settings',       icon: HiCog },
    ],
  },
]

export function pickNav(names: string[]): NavItem[] {
  return names.map(n => NAV[n])
}

export const sidebarItems = pickNav(['cowork', 'tasks', 'notes', 'connectors', 'agent-output'])
export const settingsNav = NAV.settings
export const bottomItems = pickNav(['cowork', 'tasks', 'agent-output', 'plans', 'notes', 'connectors', 'settings'])
