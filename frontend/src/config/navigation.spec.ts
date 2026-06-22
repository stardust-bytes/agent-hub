import { describe, it, expect } from 'vitest'
import { navGroups } from './navigation'

describe('navGroups', () => {
  it('exposes three groups with items', () => {
    expect(navGroups.map(g => g.labelKey)).toEqual(['nav.group.workspace', 'nav.group.knowledge', 'nav.group.config'])
    const all = navGroups.flatMap(g => g.items.map(i => i.name))
    expect(all).toContain('cowork')
    expect(all).toContain('providers')
    const configItems = navGroups[2].items.map(i => i.name)
    expect(configItems).toContain('providers')
    expect(configItems).toContain('connectors')
    // settings-backed config items use /settings/ routes
    expect(navGroups[2].items.find(i => i.name === 'providers')!.path).toBe('/settings/providers')
  })
})
