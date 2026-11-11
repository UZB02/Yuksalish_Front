import type { TelegramMessageSettings, TelegramNotifyToggles } from '@/api/types'

export const TELEGRAM_KEYS = [
  'workdays',
  'notify',
  'morningTime',
  'dailyReportTime',
  'dailyReportAbsentNames',
  'weeklyReportDay',
  'weeklyReportTime',
] as const satisfies readonly (keyof TelegramMessageSettings)[]
export type TelegramKey = (typeof TELEGRAM_KEYS)[number]
export type TelegramFormErrors = Partial<Record<TelegramKey, string>>

export const NOTIFY_KEYS: readonly (keyof TelegramNotifyToggles)[] = [
  'morningSchedule',
  'substitutions',
  'timetableChanges',
  'dailyReport',
  'weeklyReport',
  'ratingResults',
]

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export const DEFAULT_TELEGRAM_FORM: TelegramMessageSettings = {
  workdays: null,
  morningTime: '07:30',
  dailyReportTime: '16:00',
  weeklyReportDay: null,
  weeklyReportTime: '17:00',
  notify: {
    morningSchedule: true,
    substitutions: true,
    timetableChanges: true,
    dailyReport: true,
    weeklyReport: true,
    ratingResults: true,
  },
  dailyReportAbsentNames: true,
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Server qoidalari bilan bir xil: HH:MM, kamida 1 ish kuni, hisobot kuni ish kunlari ichida. */
export function validateTelegramSettings(
  v: TelegramMessageSettings,
  t: (key: string) => string,
): TelegramFormErrors {
  const e: TelegramFormErrors = {}
  for (const k of ['morningTime', 'dailyReportTime', 'weeklyReportTime'] as const) {
    if (!HHMM.test(v[k] ?? '')) e[k] = t('settingsTelegram.errors.time')
  }
  if (v.workdays && v.workdays.length === 0) e.workdays = t('settingsTelegram.errors.workdays')
  if (v.workdays && v.weeklyReportDay && !v.workdays.includes(v.weeklyReportDay)) {
    e.weeklyReportDay = t('settingsTelegram.errors.weeklyDay')
  }
  return e
}

export function toggleWorkday(days: number[], d: number): number[] {
  return (days.includes(d) ? days.filter((x) => x !== d) : [...days, d]).sort((a, b) => a - b)
}
