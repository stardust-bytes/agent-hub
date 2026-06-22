import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import CommandPalette from './CommandPalette.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const messages = { en: { 'nav.group': { workspace: 'Workspace', knowledge: 'Knowledge', config: 'Config' },
  nav: { cowork: 'Cowork', tasks: 'Tasks', notes: 'Notes', agentOutput: 'Agent Output', connectors: 'Connectors', settings: 'Settings', lang: 'EN' },
  'memory': { title: 'Memories' }, providers: { header: 'Providers' }, agents: { header: 'Agents' }, tools: { header: 'Tools' },
  permissions: { header: 'Permissions' }, usage: { header: 'Usage' },
  palette: { placeholder: 'Go', empty: 'No results', section: { navigate: 'Navigate', actions: 'Actions' }, action: { toggleTheme: 'Toggle theme', toggleLang: 'Toggle language' } } } }
const i18n = createI18n({ legacy: false, locale: 'en', messages })

describe('CommandPalette', () => {
  beforeEach(() => { setActivePinia(createPinia()); push.mockClear() })

  it('computes filteredNav based on query', async () => {
    const wrapper = mount(CommandPalette, { props: { open: true }, global: { plugins: [i18n] } })
    const vm = wrapper.vm as any
    expect(vm.filteredNav.length).toBeGreaterThan(0)
    expect(vm.filteredNav[0].label).toBeTruthy()
  })

  it('filters when query changes', async () => {
    const wrapper = mount(CommandPalette, { props: { open: true }, global: { plugins: [i18n] } })
    const vm = wrapper.vm as any
    vm.query = 'cowork'
    await nextTick()
    expect(vm.filteredNav.every((e: any) => e.label.toLowerCase().includes('cowork'))).toBe(true)
  })
})
