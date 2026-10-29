import type { JournalAbsence, JournalCellData } from '@/api/journal.api'

/** Jurnal davrining eng ko'p kalendar kuni (backend bilan bir xil) */
export const JOURNAL_MAX_DAYS = 93
/** Past o'rtacha chegarasi: shundan kichik bo'lsa ogohlantirish */
export const LOW_AVG = 3

/** Baho rangi: mavzu tokenlari (yorug'/qorong'i rejimda ishlaydi) */
export const GRADE_CLASS: Record<number, string> = {
  5: 'bg-success-soft text-success',
  4: 'bg-primary-100 text-primary-700',
  3: 'bg-warning-soft text-warning',
  2: 'bg-danger-soft text-danger',
}

export const ABSENCE_CLASS: Record<'N' | 'B', string> = {
  N: 'text-danger/70',
  B: 'text-fg-muted',
}

export const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-05" -> 5 */
export const dayOf = (date: string) => Number(date.slice(8, 10))
/** "2026-10-05" -> 10 */
export const monthOf = (date: string) => Number(date.slice(5, 7))
/** "2026-10-05" -> "05.10.2026" */
export const fmtDate = (date: string) =>
  `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Ikki sana orasidagi kalendar kunlar soni (ikkalasi ham kiradi) */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000) + 1
}

export const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

export function monthRange(today: string, offset = 0): { from: string; to: string } {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7)) - 1 + offset
  const first = new Date(Date.UTC(y, m, 1))
  const last = new Date(Date.UTC(y, m + 1, 0))
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
}

/** Davr xatosi kaliti (i18n: journal.errors.*) yoki null */
export function rangeError(from: string, to: string): 'order' | 'tooLong' | null {
  if (from > to) return 'order'
  if (daysBetween(from, to) > JOURNAL_MAX_DAYS) return 'tooLong'
  return null
}

/** Ish kunlarini oy bo'yicha guruhlaydi */
export function groupByMonth<T extends { date: string }>(dates: T[]) {
  const groups: { key: string; month: number; dates: T[] }[] = []
  for (const d of dates) {
    const key = d.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.dates.push(d)
    else groups.push({ key, month: monthOf(d.date), dates: [d] })
  }
  return groups
}

export const fmtAvg = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '—' : v.toFixed(digits)

export const isLowAvg = (v: number | null | undefined) =>
  v !== null && v !== undefined && v < LOW_AVG

/** Katakni qisqa belgilash: baho bo'lsa baho, aks holda N/B */
export function cellLabel(c: JournalCellData | undefined): string {
  if (!c) return ''
  if (c.grade !== undefined) return String(c.grade)
  if (c.absence === 'N' || c.absence === 'B') return c.absence
  return ''
}

export const absenceKey = (a: JournalAbsence) =>
  a === 'N' ? 'journal.absence.N' : a === 'B' ? 'journal.absence.B' : 'journal.absence.partial'
