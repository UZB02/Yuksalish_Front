import type { PublicSettings } from '@/api/types'

type Translate = (key: string, params?: Record<string, unknown>) => string

export const PUBLIC_KEYS = [
  'enabled',
  'showScope',
  'includeInGlobal',
  'showClasses',
  'showStudents',
  'topStudents',
  'showScores',
  'showMedals',
  'showTrend',
  'title',
  'subtitle',
  'primaryColor',
  'autoRefreshSeconds',
  'tvSlideSeconds',
  'globalRatingEnabled',
] as const
export type PublicKey = (typeof PUBLIC_KEYS)[number]
export type PublicErrors = Partial<Record<PublicKey, string>>

/** Faqat global scope da bo'lishi mumkin (maktab override da 400). */
export const GLOBAL_ONLY_KEYS: PublicKey[] = ['globalRatingEnabled']
/** Override paneli maydonlari. */
export const OVERRIDABLE_KEYS = PUBLIC_KEYS.filter((k) => !GLOBAL_ONLY_KEYS.includes(k))

export const DEFAULT_PUBLIC: PublicSettings = {
  enabled: false,
  showScope: 'own',
  includeInGlobal: true,
  showClasses: true,
  showStudents: true,
  topStudents: 20,
  showScores: true,
  showMedals: true,
  showTrend: true,
  title: null,
  subtitle: null,
  primaryColor: null,
  autoRefreshSeconds: 120,
  tvSlideSeconds: 15,
  globalRatingEnabled: false,
}

export const TOP_PRESETS = [10, 20, 50, 100] as const

const inRange = (n: unknown, min: number, max: number): boolean =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max

export function validatePublic(v: PublicSettings, t: Translate): PublicErrors {
  const e: PublicErrors = {}
  if (v.topStudents !== null && !inRange(v.topStudents, 1, 500)) {
    e.topStudents = t('settingsPublic.errors.range', { min: 1, max: 500 })
  }
  if (v.title !== null && v.title.length > 80) e.title = t('validation.maxLength', { max: 80 })
  if (v.subtitle !== null && v.subtitle.length > 160) {
    e.subtitle = t('validation.maxLength', { max: 160 })
  }
  if (v.primaryColor !== null && !/^#[0-9a-fA-F]{6}$/.test(v.primaryColor)) {
    e.primaryColor = t('validation.color')
  }
  if (!inRange(v.autoRefreshSeconds, 30, 3600)) {
    e.autoRefreshSeconds = t('settingsPublic.errors.range', { min: 30, max: 3600 })
  }
  if (!inRange(v.tvSlideSeconds, 5, 120)) {
    e.tvSlideSeconds = t('settingsPublic.errors.range', { min: 5, max: 120 })
  }
  return e
}

/** topStudents tanlovi: 'all' | preset | 'custom' */
export function topMode(v: number | null): 'all' | 'custom' | number {
  if (v === null) return 'all'
  return (TOP_PRESETS as readonly number[]).includes(v) ? v : 'custom'
}
