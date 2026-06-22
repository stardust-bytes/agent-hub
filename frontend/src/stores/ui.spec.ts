import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useUiStore } from './ui'

describe('ui store theme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('toggleTheme flips theme and toggles dark class + persists', () => {
    const ui = useUiStore()
    expect(ui.theme).toBe('light')
    ui.toggleTheme()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('workspace.theme')).toBe('dark')
    ui.toggleTheme()
    expect(ui.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('initTheme reads persisted value', () => {
    localStorage.setItem('workspace.theme', 'dark')
    const ui = useUiStore()
    ui.initTheme()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
