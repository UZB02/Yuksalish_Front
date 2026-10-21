import type { AttendanceCategory, AttendanceSettings, AttendanceStatus } from '@/api/types'
import { shiftDate } from './scoring'

export const NOTE_MAX = 300
export const MINUTES_MAX = 600

export const CATEGORIES: AttendanceCategory[] = [
  'present',
  'late',
  'absent_excused',
  'absent_unexcused',
]

/** Kategoriya ranglari (kalendar va statistika uchun; holat rangi alohida). */
export const CATEGORY_COLORS: Record<AttendanceCategory, string> = {
  present: '#16a34a',
  late: '#d97706',
  absent_excused: '#0284c7',
  absent_unexcused: '#dc2626',
}

/** "Kelgan" hisoblanadigan kategoriyalar (TZ 4.5.2). */
export const isAttended = (c: AttendanceCategory) => c === 'present' || c === 'late'

/** Davomat qatori qoralamasi. */
export interface AttendanceDraft {
  statusId: string | null
  minutesLate: string
  note: string
}

export interface AttendanceErrors {
  status?: string
  minutes?: string
  note?: string
}

export const hasAttendanceErrors = (e: AttendanceErrors) => Object.keys(e).length > 0

export const draftsEqual = (a: AttendanceDraft, b: AttendanceDraft) =>
  a.statusId === b.statusId &&
  a.minutesLate.trim() === b.minutesLate.trim() &&
  a.note.trim() === b.note.trim()

/** Xato kalitlari i18n `attendance.errors.*` ga mos. */
export function validateAttendanceDraft(
  draft: AttendanceDraft,
  status: Pick<AttendanceStatus, 'category'> | undefined,
  settings: Pick<AttendanceSettings, 'noteRequiredCategories'>,
): AttendanceErrors {
  const e: AttendanceErrors = {}
  if (!draft.statusId || !status) {
    e.status = 'statusRequired'
    return e
  }
  const minutes = draft.minutesLate.trim()
  // Daqiqa faqat "kechikdi" kategoriyasida (ixtiyoriy)
  if (status.category === 'late' && minutes !== '') {
    const n = Number(minutes)
    if (!/^\d+$/.test(minutes) || n < 1 || n > MINUTES_MAX) e.minutes = 'minutesRange'
  }
  const note = draft.note.trim()
  if (draft.note.length > NOTE_MAX) e.note = 'noteTooLong'
  else if (settings.noteRequiredCategories.includes(status.category) && note === '') {
    e.note = 'noteRequired'
  }
  return e
}

// ---- Sana va ish kunlari (TZ mustaqil: faqat 'YYYY-MM-DD' satrlari bilan) ----
/** ISO hafta kuni: 1 = dushanba ... 7 = yakshanba. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = yakshanba
  return wd === 0 ? 7 : wd
}

export const isWorkingDay = (date: string, workingWeekdays: readonly number[]) =>
  workingWeekdays.includes(isoWeekday(date))

/**
 * Davomat sahifasining boshlang'ich sanasi: bugun ish kuni bo'lsa - bugun, aks holda
 * backdateDays ichidagi eng yaqin oldingi ish kuni (topilmasa - bugun).
 */
export function nearestWorkingDay(
  today: string,
  workingWeekdays: readonly number[],
  backdateDays: number,
): string {
  for (let i = 0; i <= Math.max(0, backdateDays); i++) {
    const d = shiftDate(today, -i)
    if (isWorkingDay(d, workingWeekdays)) return d
  }
  return today
}

export const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM' oyni `delta` oyga siljitadi. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export interface CalendarCell {
  /** null - oy chegarasidan tashqari bo'sh katak */
  date: string | null
  day: number
  isoWeekday: number
}

/** Oylik kalendar to'ri: haftalar (dushanbadan boshlanadi), bo'sh kataklar bilan. */
export function monthGrid(month: string): CalendarCell[][] {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const first = `${month}-01`
  const lead = isoWeekday(first) - 1
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: CalendarCell[] = []
  for (let i = 0; i < lead; i++) cells.push({ date: null, day: 0, isoWeekday: i + 1 })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${pad(d)}`
    cells.push({ date, day: d, isoWeekday: isoWeekday(date) })
  }
  while (cells.length % 7 !== 0)
    cells.push({ date: null, day: 0, isoWeekday: (cells.length % 7) + 1 })
  const weeks: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export const monthOf = (date: string) => date.slice(0, 7)

/** Davomat foizi: 0..100, null - ma'lumot yo'q. */
export function rateTone(rate: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (rate === null) return 'neutral'
  if (rate >= 90) return 'success'
  if (rate >= 75) return 'warning'
  return 'danger'
}

export const formatRate = (rate: number | null): string =>
  rate === null ? '-' : `${Math.round(rate * 10) / 10}%`

/** Rang ustidagi matn: oq yoki to'q (WCAG luminance bo'yicha). */
export function textOn(hex: string): string {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#64748b'
  const ch = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5)
  // Oq bilan kontrast (1.05/(lum+0.05)) to'q (#0f172a ~ lum 0.009) bilan kontrastdan yuqori bo'lsa oq
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.059 ? '#ffffff' : '#0f172a'
}

export type RangePreset = 'today' | 'week' | 'month' | 'quarter'

/** Tezkor davrlar (bugun, oxirgi 7 / 30 / 90 kun) - 'YYYY-MM-DD' oralig'i. */
export function presetRange(
  preset: RangePreset,
  today: string,
  shift: (d: string, days: number) => string,
): { from: string; to: string } {
  const back = { today: 0, week: 6, month: 29, quarter: 89 }[preset]
  return { from: shift(today, -back), to: today }
}
