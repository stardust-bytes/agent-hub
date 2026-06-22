import type { Component } from 'vue'
import {
  HiCode, HiClipboardList, HiDocumentText, HiCog, HiDownload,
  HiFolder, HiDatabase, HiServer, HiUserGroup,
  HiAdjustments, HiLightBulb,
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
  'agent-output':  { name: 'agent-output',  path: '/agent-output',  labelKey: 'nav.agentOutput', icon: HiDownload },
  notes:           { name: 'notes',         path: '/notes',         labelKey: 'nav.notes',       icon: HiDocumentText },
  files:           { name: 'files',         path: '/settings/general', labelKey: 'nav.files',    icon: HiFolder },
  connectors:      { name: 'connectors',    path: '/connectors',    labelKey: 'nav.connectors',  icon: HiCog },
  settings:        { name: 'settings',      path: '/settings',      labelKey: 'nav.settings',    icon: HiCog },
  skills:          { name: 'skills',        path: '/skills',        labelKey: 'skills.header',   icon: HiLightBulb },
}

export const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.group.workspace',
    items: [
      { name: 'cowork',       path: '/cowork',       labelKey: 'nav.cowork',      icon: HiCode },
      { name: 'tasks',        path: '/tasks',        labelKey: 'nav.tasks',       icon: HiClipboardList },
      { name: 'agent-output', path: '/agent-output', labelKey: 'nav.agentOutput', icon: HiDownload },
    ],
  },
  {
    labelKey: 'nav.group.knowledge',
    items: [
      { name: 'notes',       path: '/notes',     labelKey: 'nav.notes',      icon: HiDocumentText },
      { name: 'memories',    path: '/memories',  labelKey: 'memory.title',   icon: HiDatabase },
      { name: 'skills',      path: '/skills',    labelKey: 'skills.header',  icon: HiLightBulb },
    ],
  },
  {
    labelKey: 'nav.group.config',
    items: [
      { name: 'providers',   path: '/providers',   labelKey: 'providers.header',   icon: HiServer },
      { name: 'agents',      path: '/agents',      labelKey: 'agents.header',      icon: HiUserGroup },
      { name: 'tools',       path: '/tools',       labelKey: 'tools.header',       icon: HiAdjustments },
      { name: 'connectors',  path: '/connectors',       labelKey: 'nav.connectors', icon: HiCog },
      { name: 'general',     path: '/settings/general', labelKey: 'nav.settings',   icon: HiCog },
    ],
  },
]

export function pickNav(names: string[]): NavItem[] {
  return names.map(n => NAV[n])
}

export const sidebarItems = pickNav(['cowork', 'tasks', 'notes', 'connectors', 'agent-output'])
export const settingsNav = NAV.settings
export const bottomItems = pickNav(['cowork', 'tasks', 'agent-output', 'notes', 'connectors', 'settings'])
