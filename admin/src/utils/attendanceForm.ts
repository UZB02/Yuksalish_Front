import type { AttendanceSettings } from '@/api/types'

type Translate = (key: string, params?: Record<string, unknown>) => string

export const ATTENDANCE_KEYS = [
  'mode',
  'lessonsPerDay',
  'workingWeekdays',
  'editWindowHours',
  'backdateDays',
  'noteRequiredCategories',
  'ratingImpact',
] as const
export type AttendanceKey = (typeof ATTENDANCE_KEYS)[number]
export type AttendanceFormErrors = Partial<Record<AttendanceKey, string>>

export const DEFAULT_ATTENDANCE_FORM: AttendanceSettings = {
  mode: 'daily',
  lessonsPerDay: 6,
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  editWindowHours: 24,
  backdateDays: 3,
  noteRequiredCategories: [],
  ratingImpact: {
    enabled: false,
    penaltyLate: 0,
    penaltyAbsentExcused: 0,
    penaltyAbsentUnexcused: 0,
  },
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function validateAttendanceSettings(
  v: AttendanceSettings,
  t: Translate,
): AttendanceFormErrors {
  const e: AttendanceFormErrors = {}
  // Dars soni faqat dars rejimida tekshiriladi (kunlikda ko'rinmaydi)
  if (
    v.mode === 'lesson' &&
    (!isInt(v.lessonsPerDay) || v.lessonsPerDay < 1 || v.lessonsPerDay > 12)
  ) {
    e.lessonsPerDay = t('settingsAttendance.errors.lessons')
  }
  if (
    v.workingWeekdays.length === 0 ||
    v.workingWeekdays.some((d) => !isInt(d) || d < 1 || d > 7)
  ) {
    e.workingWeekdays = t('settingsAttendance.errors.weekdays')
  }
  if (!isInt(v.editWindowHours) || v.editWindowHours < 0) {
    e.editWindowHours = t('settings.errors.nonNegativeInt')
  }
  if (!isInt(v.backdateDays) || v.backdateDays < 0) {
    e.backdateDays = t('settings.errors.nonNegativeInt')
  }
  const r = v.ratingImpact
  if (
    r.enabled &&
    [r.penaltyLate, r.penaltyAbsentExcused, r.penaltyAbsentUnexcused].some(
      (p) => !isNum(p) || p < 0,
    )
  ) {
    e.ratingImpact = t('settingsAttendance.errors.penalty')
  }
  return e
}

/** Ish kunlarini qo'shish/olib tashlash: tartiblangan, takrorsiz. */
export function toggleWeekday(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
}

/** Reytingga ta'sir yoqilayotgan bo'lsa (o'chiq -> yoqilgan) tasdiq kerak. */
export const ratingImpactBeingEnabled = (before: AttendanceSettings, after: AttendanceSettings) =>
  !before.ratingImpact.enabled && after.ratingImpact.enabled
