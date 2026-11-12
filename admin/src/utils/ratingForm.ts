import type { RatingSettings, TieBreakKey } from '@/api/types'

type Translate = (key: string, params?: Record<string, unknown>) => string

export const RATING_KEYS = [
  'periodType',
  'customFrom',
  'customTo',
  'method',
  'minScoresCount',
  'tieBreak',
  'refreshMode',
  'weights',
  'behaviorPenaltyEnabled',
  'resultsEnabled',
  'resultsWeekday',
  'resultsTime',
  'resultsMonthDay',
  'resultsDate',
] as const
export type RatingKey = (typeof RATING_KEYS)[number]
export type RatingErrors = Partial<Record<RatingKey, string>>

export const DEFAULT_RATING: RatingSettings = {
  periodType: 'month',
  customFrom: null,
  customTo: null,
  method: 'average',
  minScoresCount: 3,
  tieBreak: ['daysCount', 'alphabetical'],
  refreshMode: 'realtime',
  weights: { conduct: 50, subjects: 50 },
  resultsEnabled: false,
  resultsWeekday: 6,
  resultsTime: '18:00',
  resultsMonthDay: 0,
  resultsDate: null,
  behaviorPenaltyEnabled: false,
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Haqiqiy kalendar sana (YYYY-MM-DD): 2026-02-30 yaroqsiz */
function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateRating(v: RatingSettings, t: Translate): RatingErrors {
  const e: RatingErrors = {}
  if (v.periodType === 'custom') {
    if (!v.customFrom || !DATE.test(v.customFrom)) e.customFrom = t('validation.required')
    if (!v.customTo || !DATE.test(v.customTo)) e.customTo = t('validation.required')
    if (!e.customFrom && !e.customTo && v.customFrom! > v.customTo!) {
      e.customTo = t('validation.endAfterStart')
    }
  }
  if (!Number.isInteger(v.minScoresCount) || v.minScoresCount < 1) {
    e.minScoresCount = t('settingsRating.errors.minDays')
  }
  const w = v.weights
  if (
    !w ||
    !Number.isInteger(w.conduct) ||
    !Number.isInteger(w.subjects) ||
    w.conduct < 0 ||
    w.subjects < 0 ||
    w.conduct > 100 ||
    w.subjects > 100
  ) {
    e.weights = t('settingsRating.errors.weightsInt')
  } else if (w.conduct + w.subjects !== 100) {
    e.weights = t('settingsRating.errors.weightsSum')
  }
  if (!HHMM.test(v.resultsTime ?? '')) e.resultsTime = t('settingsRating.errors.time')
  if (!Number.isInteger(v.resultsWeekday) || v.resultsWeekday < 1 || v.resultsWeekday > 7) {
    e.resultsWeekday = t('settingsRating.errors.weekday')
  }
  if (!Number.isInteger(v.resultsMonthDay) || v.resultsMonthDay < 0 || v.resultsMonthDay > 31) {
    e.resultsMonthDay = t('settingsRating.errors.monthDay')
  }
  if (v.resultsDate !== null && v.resultsDate !== undefined && !isRealDate(v.resultsDate)) {
    e.resultsDate = t('settingsRating.errors.date')
  }
  return e
}

/** Tie-break: 'alphabetical' har doim oxirida bitta marta; takrorlar olib tashlanadi. */
export function normalizeTieBreak(list: readonly TieBreakKey[]): TieBreakKey[] {
  const seen = new Set<TieBreakKey>()
  const head: TieBreakKey[] = []
  for (const k of list) {
    if (k === 'alphabetical' || seen.has(k)) continue
    seen.add(k)
    head.push(k)
  }
  return [...head, 'alphabetical']
}

export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  if (to < 0 || to >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item!)
  return next
}
