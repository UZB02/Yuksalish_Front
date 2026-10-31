import type {
  EntryPayload,
  TimetableEntry,
  TimetableOptions,
  TimetableWarning,
} from '@/api/timetable.api'

/** Bir kundagi darslarning eng ko'pi (backend MAX_LESSON_NO bilan bir xil) */
export const TIMETABLE_MAX_LESSONS = 12

/** Ko'rsatiladigan qatorlar soni: max(sozlamadagi darslar soni, ishlatilgan eng katta dars raqami, 1), 12 gacha */
export const rowCountFor = (lessonsPerDay: number, usedMax: number) =>
  Math.min(TIMETABLE_MAX_LESSONS, Math.max(lessonsPerDay || 0, usedMax || 0, 1))

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
/**
 * Katak -> shu vaqtdagi darslar. Bir katakda bir nechta dars bo'lishi mumkin (parallel o'qituvchilar);
 * bo'sh katak xaritada bo'lmaydi.
 */
export type CellMap = Record<string, CellValue[]>

/** Bir xil (fan, o'qituvchi) juftligi katakda ikki marta bo'lmaydi; o'qituvchi ham ikki marta bo'lmaydi */
export const lessonLabel = (c: Pick<CellValue, 'subjectName' | 'teacherName'>) =>
  [c.subjectName ?? '?', c.teacherName ?? '?'].join(' · ')

export function entriesToCells(entries: TimetableEntry[]): CellMap {
  const out: CellMap = {}
  for (const e of entries) {
    const k = cellKey(e.weekday, e.lessonNo)
    ;(out[k] ??= []).push({
      subjectId: e.subjectId,
      teacherId: e.teacherId,
      room: e.room ?? null,
      subjectName: e.subject?.name,
      teacherName: e.teacher?.fullName,
    })
  }
  return out
}

export function cellsToPayload(cells: CellMap): EntryPayload[] {
  return Object.entries(cells)
    .flatMap(([k, list]) => {
      const [weekday, lessonNo] = k.split(':').map(Number) as [number, number]
      return list.map((v) => ({
        weekday,
        lessonNo,
        subjectId: v.subjectId,
        teacherId: v.teacherId,
        room: v.room?.trim() ? v.room.trim() : null,
      }))
    })
    .sort((a, b) => a.weekday - b.weekday || a.lessonNo - b.lessonNo)
}

/** Kataklardagi eng katta dars raqami (`weekday` berilsa, faqat shu kun); yo'q bo'lsa 0 */
export function maxLessonNo(cells: CellMap, weekday?: number): number {
  let m = 0
  for (const k of Object.keys(cells)) {
    const [w, n] = k.split(':').map(Number) as [number, number]
    if (weekday === undefined || w === weekday) m = Math.max(m, n)
  }
  return m
}

/** Dirty hisobi uchun: nomlarsiz, tartiblangan ko'rinish */
export const cellsSignature = (cells: CellMap): string => JSON.stringify(cellsToPayload(cells))

/** `from` kunining barcha darslarini `to` kuniga nusxalaydi (`to` dagi mavjud darslar almashtiriladi) */
export function copyDay(cells: CellMap, from: number, to: number, lessons: number): CellMap {
  const out: CellMap = {}
  for (const [k, v] of Object.entries(cells)) if (!k.startsWith(`${to}:`)) out[k] = v
  for (let n = 1; n <= lessons; n++) {
    const src = cells[cellKey(from, n)]
    if (src?.length) out[cellKey(to, n)] = src.map((c) => ({ ...c }))
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
export function severityOf(ws: { severity: 'error' | 'warning' }[] | undefined): CellSeverity {
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

/** Fan tanlanganda o'qituvchi: avval ClassSubject'dagi (birinchisi) */
export function defaultTeacherFor(opts: TimetableOptions, subjectId: string): string | null {
  return opts.classAssignments.find((a) => a.subjectId === subjectId)?.teacherId ?? null
}

/** Sinfda shu fanga biriktirilgan barcha o'qituvchilar (bir nechta bo'lishi mumkin) */
export const assignedTeachersOf = (
  opts: Pick<TimetableOptions, 'classAssignments'>,
  subjectId: string,
) => opts.classAssignments.filter((a) => a.subjectId === subjectId).map((a) => a.teacherId)

export interface PairOption {
  /** `subjectId:teacherId` */
  key: string
  subjectId: string
  teacherId: string
  /** "Ingliz tili · Aliyeva" */
  label: string
}

/**
 * Sinfga biriktirilgan har bir (fan, o'qituvchi) juftligi alohida variant:
 * "Ingliz tili · Aliyeva", "Ingliz tili · G'aniyeva".
 */
export function pairOptions(opts: TimetableOptions): PairOption[] {
  const subjects = new Map(opts.subjects.map((s) => [s.id, s.name]))
  const teachers = new Map(opts.teachers.map((t) => [t.id, t.fullName]))
  return opts.classAssignments
    .map((a) => ({
      key: `${a.subjectId}:${a.teacherId}`,
      subjectId: a.subjectId,
      teacherId: a.teacherId,
      label: `${subjects.get(a.subjectId) ?? '?'} · ${teachers.get(a.teacherId) ?? '?'}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'uz'))
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
  const assignedIds = subjectId ? assignedTeachersOf(opts, subjectId) : []
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
  const assigned = pick(assignedIds)
  const subject = pick([...others]).sort((a, b) => a.label.localeCompare(b.label, 'uz'))
  const rest = pick(all.map((t) => t.id)).sort((a, b) => a.label.localeCompare(b.label, 'uz'))
  const groups: OptionGroup[] = [
    { key: 'assigned', items: assigned },
    { key: 'subject', items: subject },
    { key: 'all', items: rest },
  ]
  return groups.filter((g) => g.items.length)
}

/** Katak muammolaridan aynan shu darsga (o'qituvchiga) tegishlilari; o'qituvchisiz muammo hammasiga */
export const issuesForLesson = <T extends { teacherId?: string }>(
  issues: T[] | undefined,
  lesson: Pick<CellValue, 'teacherId'>,
): T[] => (issues ?? []).filter((i) => !i.teacherId || i.teacherId === lesson.teacherId)

/** Haftalik darslar soni (parallel darslar alohida sanaladi) */
export const countCells = (cells: CellMap) =>
  Object.values(cells).reduce((n, list) => n + list.length, 0)

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
  if (v.phase === 'replaced') {
    return `${t('timetable.phase.replaced')} · ${fmt(v.validFrom)} – (${t('timetable.replacedNote')})`
  }
  const range = `${fmt(v.validFrom)} – ${v.validTo ? fmt(v.validTo) : ''}`.trim()
  return `${t(`timetable.phase.${v.phase}`)}: ${range}`
}

/** Tarixda necha kun ko'rinib turadi (backend TIMETABLE_RETENTION_DAYS bilan bir xil) */
export const TIMETABLE_HISTORY_DAYS = 30

const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Eski tarix: tugaganiga 30 kundan oshgan versiya (validTo bugundan 30 kun oldingi sanadan avval).
 * Joriy, kelgusi, qoralama va almashtirilgan (30 kun ichida) versiyalar hech qachon yashirilmaydi.
 */
export const isOldHistory = (
  v: { phase: string; validTo: string | null },
  today: string,
): boolean =>
  v.phase === 'past' && !!v.validTo && v.validTo < addDays(today, -TIMETABLE_HISTORY_DAYS)

/** Bugundan sanagacha qolgan kunlar (YYYY-MM-DD) */
export const daysUntil = (date: string, today: string): number =>
  Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      86_400_000,
  )
