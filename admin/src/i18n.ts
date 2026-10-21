import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'

export const SUPPORTED_LOCALES = ['uz'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const i18n = createI18n({
  legacy: false,
  locale: 'uz',
  fallbackLocale: 'uz',
  messages: { uz },
})
