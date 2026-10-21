import type { AcademicYear, ReportType, Role } from '@/api/types'
import { shiftDate } from './scoring'

export const MAX_SPAN_DAYS = 366

export type ReportTab = 'class' | 'student' | 'teachers' | 'school' | 'behavior' | 'schools'
export const ALL_REPORT_TABS: ReportTab[] = [
  'class',
  'student',
  'teachers',
  'school',
  'behavior',
  'schools',
]
const TEACHER_TABS: ReportTab[] = ['class', 'student']

/** Ko'rinadigan tablar: o'qituvchi - Sinf/O'quvchi; maktab admini - 5 ta; "Maktablar" faqat superadmin. */
export function visibleReportTabs(
  role: Role | undefined,
  hasPermission: (permission: string) => boolean,
): ReportTab[] {
  if (!role || !hasPermission('reports.view')) return []
  if (role === 'teacher') return [...TEACHER_TABS]
  const tabs = ALL_REPORT_TABS.filter((t) => t !== 'schools')
  return role === 'superadmin' ? [...tabs, 'schools'] : tabs
}

// ---- Davr ----
export type PeriodPreset = 'today' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom' | string

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** Ikkala chegarani ham hisoblab, kunlar soni. */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => {
    const [y, m, day] = d.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((ms(to) - ms(from)) / 86_400_000) + 1
}

export type PeriodError = 'required' | 'order' | 'future' | 'tooLong'

export function validatePeriod(from: string, to: string, today: string): PeriodError | null {
  if (!from || !to) return 'required'
  if (from > to) return 'order'
  if (to > today) return 'future'
  if (daysBetween(from, to) > MAX_SPAN_DAYS) return 'tooLong'
  return null
}

const dateOnly = (v: string) => v.slice(0, 10)

export interface YearLike {
  startDate: string
  endDate: string
  periods: { name: string; startDate: string; endDate: string }[]
}

/**
 * Tezkor tanlovni sana oralig'iga aylantiradi. Kelajak chegarasi bugunga qisqartiriladi.
 * `quarter:<i>` - faol o'quv yili choragi; `year` - o'quv yili boshidan bugungacha.
 * Hisoblab bo'lmasa (masalan, chorak hali boshlanmagan) `null`.
 */
export function resolvePreset(
  preset: PeriodPreset,
  today: string,
  year: YearLike | null,
): { from: string; to: string } | null {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const clamp = (from: string, to: string) =>
    from > today ? null : { from, to: to > today ? today : to }
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return { from: shiftDate(today, -6), to: today }
    case 'month':
      return { from: `${y}-${pad(m)}-01`, to: today }
    case 'lastMonth':
      return {
        from: fmt(new Date(Date.UTC(y, m - 2, 1))),
        to: fmt(new Date(Date.UTC(y, m - 1, 0))),
      }
    case 'year':
      return year ? clamp(dateOnly(year.startDate), dateOnly(year.endDate)) : null
    default: {
      if (preset.startsWith('quarter:')) {
        const p = year?.periods[Number(preset.slice(8))]
        return p ? clamp(dateOnly(p.startDate), dateOnly(p.endDate)) : null
      }
      return null
    }
  }
}

export interface PresetOption {
  value: PeriodPreset
  /** i18n kaliti (reports.presets.*) yoki o'z nomi (chorak) */
  labelKey?: string
  label?: string
}

export function presetOptions(year: Pick<AcademicYear, 'periods'> | null): PresetOption[] {
  return [
    { value: 'today', labelKey: 'today' },
    { value: 'week', labelKey: 'week' },
    { value: 'month', labelKey: 'month' },
    { value: 'lastMonth', labelKey: 'lastMonth' },
    ...(year?.periods ?? []).map((p, i) => ({ value: `quarter:${i}`, label: p.name })),
    ...(year ? [{ value: 'year', labelKey: 'year' }] : []),
    { value: 'custom', labelKey: 'custom' },
  ]
}

// ---- URL holati ----
export interface ReportState {
  tab: ReportTab
  preset: PeriodPreset
  from: string
  to: string
  classId: string
  studentId: string
}

type Query = Record<string, unknown>
const str = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? String(v[0] ?? '') : ''
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseReportQuery(query: Query, allowed: ReportTab[]): ReportState {
  const tabRaw = str(query.tab) as ReportTab
  const from = str(query.from)
  const to = str(query.to)
  return {
    tab: allowed.includes(tabRaw) ? tabRaw : (allowed[0] ?? 'class'),
    preset: str(query.preset) || (DATE_RE.test(from) ? 'custom' : 'month'),
    from: DATE_RE.test(from) ? from : '',
    to: DATE_RE.test(to) ? to : '',
    classId: str(query.classId),
    studentId: str(query.studentId),
  }
}

/** Faqat standart bo'lmagan qiymatlar URL ga yoziladi. Maxsus davrda from/to ham. */
export function toReportQuery(state: ReportState): Record<string, string> {
  const q: Record<string, string> = { tab: state.tab }
  if (state.preset !== 'month') q.preset = state.preset
  if (state.preset === 'custom') {
    if (state.from) q.from = state.from
    if (state.to) q.to = state.to
  }
  if (state.classId && ['class', 'student', 'teachers', 'behavior'].includes(state.tab)) {
    q.classId = state.classId
  }
  if (state.tab === 'student' && state.studentId) q.studentId = state.studentId
  return q
}

// ---- Eksport / so'rov ----
export interface ReportRequest {
  type: ReportType
  params: { from: string; to: string; classId?: string }
  studentId?: string
}

/** Tabga qarab so'rov parametrlari; majburiy filtr yetishmasa `null`. */
export function reportRequest(
  state: ReportState,
  period: { from: string; to: string },
): ReportRequest | null {
  const base = { from: period.from, to: period.to }
  switch (state.tab) {
    case 'class':
      return state.classId ? { type: 'class', params: { ...base, classId: state.classId } } : null
    case 'student':
      return state.studentId ? { type: 'student', params: base, studentId: state.studentId } : null
    case 'teachers':
    case 'behavior':
      return {
        type: state.tab,
        params: state.classId ? { ...base, classId: state.classId } : base,
      }
    default:
      return { type: state.tab, params: base }
  }
}

// ---- Ko'rsatkichlar ----
export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

/** O'qituvchi qamrovi: < 20% qizil, < 50% sariq, aks holda yashil. */
export function coverageTone(rate: number | null): Tone {
  if (rate === null) return 'neutral'
  if (rate < 20) return 'danger'
  if (rate < 50) return 'warning'
  return 'success'
}

export const formatScore = (n: number | null | undefined, digits = 1): string =>
  n === null || n === undefined ? '-' : String(Number(n.toFixed(digits)))

// ---- Saralash ----
export type SortDir = 'asc' | 'desc'

/** Barqaror saralash; null/undefined qiymatlar har ikki yo'nalishda ham oxirida. */
export function sortRows<T>(
  rows: readonly T[],
  accessor: (row: T) => string | number | null | undefined,
  dir: SortDir,
): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((row, i) => ({ row, i, v: accessor(row) }))
    .sort((a, b) => {
      const an = a.v === null || a.v === undefined
      const bn = b.v === null || b.v === undefined
      if (an || bn) return an && bn ? a.i - b.i : an ? 1 : -1
      if (typeof a.v === 'string' && typeof b.v === 'string') {
        const c = a.v.localeCompare(b.v, 'uz')
        return c !== 0 ? sign * c : a.i - b.i
      }
      const d = (a.v as number) - (b.v as number)
      return d !== 0 ? sign * d : a.i - b.i
    })
    .map((x) => x.row)
}

export const toneTextClass: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-fg-muted',
}
