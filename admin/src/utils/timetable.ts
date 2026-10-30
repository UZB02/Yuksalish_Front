import type {
  EntryPayload,
  TimetableEntry,
  TimetableOptions,
  TimetableWarning,
} from '@/api/timetable.api'

/** Katak kaliti: "hafta kuni:dars raqami" */
export const cellKey = (weekday: number, lessonNo: number) => `${weekday}:${lessonNo}`

export interface CellValue {
  subjectId: string
  teacherId: string
  room: string | null
  /** Ko'rsatish uchun (serverdan kelgan nomlar; inactive fan/o'qituvchi uchun ham) */
  subjectName?: string
  teacherName?: string
}
export type CellMap = Record<string, CellValue>

export function entriesToCells(entries: TimetableEntry[]): CellMap {
  const out: CellMap = {}
  for (const e of entries) {
    out[cellKey(e.weekday, e.lessonNo)] = {
      subjectId: e.subjectId,
      teacherId: e.teacherId,
      room: e.room ?? null,
      subjectName: e.subject?.name,
      teacherName: e.teacher?.fullName,
    }
  }
  return out
}

export function cellsToPayload(cells: CellMap): EntryPayload[] {
  return Object.entries(cells)
    .map(([k, v]) => {
      const [weekday, lessonNo] = k.split(':').map(Number) as [number, number]
      return {
        weekday,
        lessonNo,
        subjectId: v.subjectId,
        teacherId: v.teacherId,
        room: v.room?.trim() ? v.room.trim() : null,
      }
    })
    .sort((a, b) => a.weekday - b.weekday || a.lessonNo - b.lessonNo)
}

/** Dirty hisobi uchun: nomlarsiz, tartiblangan ko'rinish */
export const cellsSignature = (cells: CellMap): string => JSON.stringify(cellsToPayload(cells))

/** `from` kunining barcha darslarini `to` kuniga nusxalaydi (`to` dagi mavjud darslar almashtiriladi) */
export function copyDay(cells: CellMap, from: number, to: number, lessons: number): CellMap {
  const out: CellMap = {}
  for (const [k, v] of Object.entries(cells)) if (!k.startsWith(`${to}:`)) out[k] = v
  for (let n = 1; n <= lessons; n++) {
    const src = cells[cellKey(from, n)]
    if (src) out[cellKey(to, n)] = { ...src }
  }
  return out
}

export function clearDay(cells: CellMap, weekday: number): CellMap {
  const out: CellMap = {}
  for (const [k, v] of Object.entries(cells)) if (!k.startsWith(`${weekday}:`)) out[k] = v
  return out
}

export function warningsByCell(warnings: TimetableWarning[]): Record<string, TimetableWarning[]> {
  const out: Record<string, TimetableWarning[]> = {}
  for (const w of warnings) (out[cellKey(w.weekday, w.lessonNo)] ??= []).push(w)
  return out
}

export type CellSeverity = 'error' | 'warning' | null
export function severityOf(ws: TimetableWarning[] | undefined): CellSeverity {
  if (!ws?.length) return null
  return ws.some((w) => w.severity === 'error') ? 'error' : 'warning'
}

export interface OptionGroup {
  key: 'assigned' | 'subject' | 'all'
  items: { id: string; label: string }[]
}

/** Fan variantlari: sinfga biriktirilganlar birinchi */
export function subjectOptions(opts: TimetableOptions, extra?: { id: string; name: string }[]) {
  const assigned = new Set(opts.classAssignments.map((a) => a.subjectId))
  const list = [...opts.subjects]
  for (const e of extra ?? []) if (!list.some((s) => s.id === e.id)) list.push(e)
  return list
    .map((s) => ({ id: s.id, label: s.name, assigned: assigned.has(s.id) }))
    .sort((a, b) => Number(b.assigned) - Number(a.assigned) || a.label.localeCompare(b.label, 'uz'))
}

/** Fan tanlanganda o'qituvchi: avval ClassSubject'dagi */
export function defaultTeacherFor(opts: TimetableOptions, subjectId: string): string | null {
  return opts.classAssignments.find((a) => a.subjectId === subjectId)?.teacherId ?? null
}

/**
 * O'qituvchi variantlari tartibi: sinfda shu fanga biriktirilgan, so'ng shu fanni boshqa sinfda
 * o'tadiganlar, so'ng qolganlari.
 */
export function teacherOptions(
  opts: TimetableOptions,
  subjectId: string,
  extra?: { id: string; fullName: string }[],
): OptionGroup[] {
  const all = [...opts.teachers]
  for (const e of extra ?? []) if (!all.some((t) => t.id === e.id)) all.push(e)
  const assignedId = subjectId ? defaultTeacherFor(opts, subjectId) : null
  const others = new Set(subjectId ? (opts.subjectTeachers[subjectId] ?? []) : [])
  const used = new Set<string>()
  const pick = (ids: (string | null)[]) =>
    ids
      .filter((id): id is string => !!id && !used.has(id))
      .map((id) => all.find((t) => t.id === id))
      .filter((t): t is { id: string; fullName: string } => !!t)
      .map((t) => {
        used.add(t.id)
        return { id: t.id, label: t.fullName }
      })
  const assigned = pick([assignedId])
  const subject = pick([...others]).sort((a, b) => a.label.localeCompare(b.label, 'uz'))
  const rest = pick(all.map((t) => t.id)).sort((a, b) => a.label.localeCompare(b.label, 'uz'))
  const groups: OptionGroup[] = [
    { key: 'assigned', items: assigned },
    { key: 'subject', items: subject },
    { key: 'all', items: rest },
  ]
  return groups.filter((g) => g.items.length)
}

/** Haftalik darslar soni (o'qituvchi hafta jadvali uchun) */
export const countCells = (cells: CellMap) => Object.keys(cells).length

/** Faollashtirish sanasi bugundan oldinmi (tasdiq kerak) */
export const isPastDate = (date: string, today: string) => !!date && date < today

/** Ertangi kun (YYYY-MM-DD) */
export function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Sana tushgan haftaning dushanbasi */
export function mondayOf(date: string): string {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay() || 7
  return addDaysIso(date, -(wd - 1))
}

type Translate = (key: string, named?: Record<string, unknown>) => string

/** Versiya yorlig'i: "Faol: 02.09.2026 - 31.10.2026" */
export function versionLabel(
  v: { phase: string; validFrom: string; validTo: string | null },
  t: Translate,
  fmt: (d: string | null) => string,
): string {
  const range = `${fmt(v.validFrom)} – ${v.validTo ? fmt(v.validTo) : ''}`.trim()
  return `${t(`timetable.phase.${v.phase}`)}: ${range}`
}
