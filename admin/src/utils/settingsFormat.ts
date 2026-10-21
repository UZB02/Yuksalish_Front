import { i18n } from '@/i18n'

type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * Sozlama qiymatini foydalanuvchiga ko'rsatish (o'zgarishlar xulosasi, "global qiymat" yozuvi).
 * Enum qiymatlar `settings.options.<key>.<value>` orqali tarjima qilinadi.
 */
export function formatSetting(t: Translate, key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    if (key === 'commentRequiredBelow') return t('settings.off')
    if (key === 'topStudents') return t('settings.options.topStudents.all')
    return t('settings.notSet')
  }
  if (key === 'workingWeekdays' && Array.isArray(value)) {
    return value.map((d) => t(`settingsAttendance.weekdays.${d}`)).join(', ')
  }
  if (key === 'noteRequiredCategories' && Array.isArray(value)) {
    return value.length
      ? value.map((c) => t(`attendance.categories.${c}`)).join(', ')
      : t('settings.no')
  }
  if (key === 'ratingImpact' && typeof value === 'object') {
    const r = value as {
      enabled: boolean
      penaltyLate: number
      penaltyAbsentExcused: number
      penaltyAbsentUnexcused: number
    }
    return r.enabled
      ? t('settingsAttendance.impactSummary', {
          late: r.penaltyLate,
          excused: r.penaltyAbsentExcused,
          unexcused: r.penaltyAbsentUnexcused,
        })
      : t('settings.no')
  }
  if (key === 'weights' && typeof value === 'object') {
    const w = value as { conduct: number; subjects: number }
    return t('settingsRating.weightsSummary', { conduct: w.conduct, subjects: w.subjects })
  }
  if (typeof value === 'boolean') return value ? t('settings.yes') : t('settings.no')
  if (Array.isArray(value)) {
    return value.map((v) => formatSetting(t, key, v)).join(' > ')
  }
  if (typeof value === 'string') {
    const k = `settings.options.${key}.${value}`
    if (i18n.global.te(k)) return t(k)
    if (key === 'dailyAggregation') return t(`settings.aggregation.${value}`)
  }
  return String(value)
}
