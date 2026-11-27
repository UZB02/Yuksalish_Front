import type { ExamResultRow, ExamResultsResponse } from '@/api/types'

/** Natijalar sahifasi hisob-kitoblari (hammasi `ExamResultsResponse` dan frontda; backendga tegilmaydi) */
export type ResultFilter = 'all' | 'ok' | 'no' | 't' | 'n' | 'ep'
export type RowTone = 'ok' | 'no' | 't' | 'n' | 'x'
export type SortKey = 'rank' | 'name' | 'percent' | 'time'

/** Ko'rinish toni: kirmagan / to'xtatilgan / o'tdi / o'tmadi / boshqa (baholanmagan) */
export function rowTone(r: ExamResultRow): RowTone {
  if (r.status === 'not_started') return 'n'
  if (r.terminated) return 't'
  if (r.passed === true) return 'ok'
  if (r.passed === false) return 'no'
  return 'x'
}

/** Rang tokenlari (yorug'/tungi mavzuga mos) */
export const TONE_COLOR: Record<RowTone, string> = {
  ok: 'rgb(var(--success))',
  no: 'rgb(var(--danger))',
  t: 'rgb(var(--warning))',
  n: 'rgb(var(--border))',
  x: 'rgb(var(--primary-600))',
}

export const isScored = (r: ExamResultRow): boolean => r.percent !== null && r.earned !== null

export function matchFilter(r: ExamResultRow, f: ResultFilter, absentOpen: boolean): boolean {
  switch (f) {
    case 'all':
      return r.status !== 'not_started' || absentOpen
    case 'ok':
      return r.passed === true
    case 'no':
      return r.passed === false
    case 't':
      return !!r.terminated
    case 'n':
      return r.status === 'not_started'
    default:
      return r.essayPending > 0
  }
}

export interface FilterCounts {
  ok: number
  no: number
  t: number
  n: number
  ep: number
}
export function filterCounts(rows: ExamResultRow[]): FilterCounts {
  const c: FilterCounts = { ok: 0, no: 0, t: 0, n: 0, ep: 0 }
  for (const r of rows) {
    if (r.passed === true) c.ok++
    if (r.passed === false) c.no++
    if (r.terminated) c.t++
    if (r.status === 'not_started') c.n++
    if (r.essayPending > 0) c.ep++
  }
  return c
}

export function sortRows(rows: ExamResultRow[], key: SortKey, dir: 1 | -1): ExamResultRow[] {
  const nz = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v)
  const cmp = (a: ExamResultRow, b: ExamResultRow): number => {
    let r = 0
    if (key === 'name') r = a.fullName.localeCompare(b.fullName)
    else if (key === 'percent') r = (b.percent ?? -1) - (a.percent ?? -1)
    else if (key === 'time') r = nz(a.timeSpentSec) - nz(b.timeSpentSec)
    else r = nz(a.rank) - nz(b.rank)
    if (r === 0) r = a.fullName.localeCompare(b.fullName)
    return r * dir
  }
  return [...rows].sort(cmp)
}

const mean = (a: number[]): number | null =>
  a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null

export interface ClassStat {
  /** Sinf nomi ('' = sinfsiz) */
  name: string
  total: number
  submitted: number
  avg: number | null
  passed: number
  failed: number
}
export function classStat(rows: ExamResultRow[], name: string): ClassStat {
  const mine = rows.filter((r) => (r.className ?? '') === name)
  const scored = mine.filter(isScored)
  return {
    name,
    total: mine.length,
    submitted: scored.length,
    avg: mean(scored.map((r) => r.percent!)),
    passed: mine.filter((r) => r.passed === true).length,
    failed: mine.filter((r) => r.passed === false).length,
  }
}

export function classNames(rows: ExamResultRow[]): string[] {
  const set = new Set(rows.map((r) => r.className ?? ''))
  return [...set].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'uz', { numeric: true }),
  )
}

/** Ball taqsimoti: 10 ta 10% oralig'i (100% oxirgisiga kiradi) */
export function histogram(rows: ExamResultRow[]): number[] {
  const b = Array<number>(10).fill(0)
  for (const r of rows) {
    if (r.percent === null) continue
    b[Math.min(9, Math.max(0, Math.floor(r.percent / 10)))]!++
  }
  return b
}

/** Eng yaxshi 3 (o'rin bo'yicha) */
export const topThree = (rows: ExamResultRow[]): ExamResultRow[] =>
  rows
    .filter((r) => r.rank !== null && isScored(r))
    .sort((a, b) => a.rank! - b.rank! || a.fullName.localeCompare(b.fullName))
    .slice(0, 3)

export interface SubjectStat {
  id: string
  title: string
  avg: number | null
  byClass: { name: string; avg: number | null }[]
}
/** Fanlar (bloklar) bo'yicha o'rtacha % + sinflar kesimida. Faqat bir nechta blokda */
export function subjectStats(data: ExamResultsResponse): SubjectStat[] {
  const heads = data.blocks ?? []
  if (heads.length <= 1) return []
  const classes = classNames(data.rows).filter(Boolean)
  const pct = (rows: ExamResultRow[], id: string): number | null =>
    mean(
      rows.flatMap((r) => {
        const b = r.blocks?.find((x) => x.blockId === id)
        return b && b.max > 0 ? [(b.earned / b.max) * 100] : []
      }),
    )
  return heads.map((h) => ({
    id: h.id,
    title: h.title || h.subjectName || '',
    avg: pct(data.rows, h.id),
    byClass:
      classes.length > 1
        ? classes.map((c) => ({
            name: c,
            avg: pct(
              data.rows.filter((r) => r.className === c),
              h.id,
            ),
          }))
        : [],
  }))
}

export const fmtTime = (sec: number | null): string =>
  sec === null ? '—' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
export const minutes = (sec: number | null): number | null =>
  sec === null ? null : Math.max(1, Math.round(sec / 60))

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/** Fan/blok ranglari: faqat mavjud tokenlar */
export const SUBJECT_COLORS = [
  'rgb(var(--primary-600))',
  'rgb(var(--success))',
  'rgb(var(--warning))',
  'rgb(var(--danger))',
  'rgb(var(--primary-500))',
]
export const subjectColor = (i: number): string => SUBJECT_COLORS[i % SUBJECT_COLORS.length]!
