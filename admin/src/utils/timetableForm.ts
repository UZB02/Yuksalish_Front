import type { TimetableAttendanceSettings, TimetableEnforcement } from '@/api/types'

export const TIMETABLE_KEYS = [
  'enforcement',
  'homeroomCanTakeAnyLesson',
  'strictNoTimetable',
] as const
export type TimetableKey = (typeof TIMETABLE_KEYS)[number]
export type TimetableFormErrors = Partial<Record<TimetableKey, string>>

export const ENFORCEMENT_MODES: TimetableEnforcement[] = ['off', 'suggest', 'strict']

export const DEFAULT_TIMETABLE_FORM: TimetableAttendanceSettings = {
  enforcement: 'suggest',
  homeroomCanTakeAnyLesson: true,
  strictNoTimetable: 'manual',
}

/** Qiymatlar enum/boolean: faqat noma'lum qiymat xato (server ham tekshiradi). */
export function validateTimetableSettings(
  v: TimetableAttendanceSettings,
  t: (key: string) => string,
): TimetableFormErrors {
  const e: TimetableFormErrors = {}
  if (!ENFORCEMENT_MODES.includes(v.enforcement)) e.enforcement = t('validation.required')
  if (v.strictNoTimetable !== 'manual' && v.strictNoTimetable !== 'block') {
    e.strictNoTimetable = t('validation.required')
  }
  return e
}
