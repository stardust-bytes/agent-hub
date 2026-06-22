import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import ThemeToggle from './ThemeToggle.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('ThemeToggle', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); document.documentElement.classList.remove('dark') })

  it('toggles theme on click', async () => {
    const wrapper = mount(ThemeToggle, { global: { plugins: [i18n] } })
    await wrapper.get('button').trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
