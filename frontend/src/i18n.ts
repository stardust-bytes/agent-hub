import { createI18n } from 'vue-i18n'
import vi from './locales/vi.json'
import en from './locales/en.json'

const savedLang = localStorage.getItem('workspace.lang') ?? 'vi'

export const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: { vi, en },
})

export type Locale = 'vi' | 'en'
