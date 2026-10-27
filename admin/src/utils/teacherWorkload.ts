import type { Teacher } from '@/api/types'

export interface ClassRef {
  id: string
  name: string
}

export interface SubjectGroup {
  subjectId: string
  subjectName: string
  classes: ClassRef[]
}

export interface TeacherWorkload {
  /** Fanlar bo'yicha guruhlangan sinflar (sinflari ko'p fan birinchi) */
  subjects: SubjectGroup[]
  /** Sinf rahbarligi */
  homeroom: ClassRef[]
  /** Sinfga biriktirilgan, lekin hech qanday fani yo'q sinflar */
  noSubject: ClassRef[]
  /** Barcha farqli sinflar soni (sinflar + fan biriktirishlari + rahbarlik) */
  classesTotal: number
}

export type WorkloadChip =
  | { kind: 'subject'; key: string; name: string; count: number; classes: ClassRef[] }
  | { kind: 'homeroom'; key: string; classes: ClassRef[] }
  | { kind: 'noSubject'; key: string; classes: ClassRef[] }

const byName = (a: ClassRef, b: ClassRef) =>
  a.name.localeCompare(b.name, 'uz', { numeric: true, sensitivity: 'base' })

/** O'qituvchining sinf/fan/rahbarlik ma'lumotini ixcham yuklamaga aylantiradi. */
export function buildWorkload(
  teacher: Pick<Teacher, 'classes' | 'subjectAssignments' | 'homeroomClasses'>,
): TeacherWorkload {
  const groups = new Map<string, SubjectGroup>()
  const withSubject = new Set<string>()
  const all = new Map<string, ClassRef>()

  for (const a of teacher.subjectAssignments ?? []) {
    let g = groups.get(a.subjectId)
    if (!g) {
      g = { subjectId: a.subjectId, subjectName: a.subjectName, classes: [] }
      groups.set(a.subjectId, g)
    }
    if (!g.classes.some((c) => c.id === a.classId)) {
      g.classes.push({ id: a.classId, name: a.className })
    }
    withSubject.add(a.classId)
    all.set(a.classId, { id: a.classId, name: a.className })
  }
  for (const c of teacher.classes ?? []) all.set(c.id, c)
  const homeroom = [...(teacher.homeroomClasses ?? [])].sort(byName)
  for (const c of homeroom) all.set(c.id, c)

  const subjects = [...groups.values()]
    .map((g) => ({ ...g, classes: [...g.classes].sort(byName) }))
    .sort(
      (a, b) =>
        b.classes.length - a.classes.length ||
        a.subjectName.localeCompare(b.subjectName, 'uz', { sensitivity: 'base' }),
    )
  const noSubject = (teacher.classes ?? []).filter((c) => !withSubject.has(c.id)).sort(byName)

  return { subjects, homeroom, noSubject, classesTotal: all.size }
}

/** Ko'rsatiladigan chiplar tartibi: fanlar, rahbarlik, fansiz sinflar. */
export function workloadChips(w: TeacherWorkload): WorkloadChip[] {
  const chips: WorkloadChip[] = w.subjects.map((s) => ({
    kind: 'subject',
    key: `s-${s.subjectId}`,
    name: s.subjectName,
    count: s.classes.length,
    classes: s.classes,
  }))
  if (w.homeroom.length > 0) chips.push({ kind: 'homeroom', key: 'homeroom', classes: w.homeroom })
  if (w.noSubject.length > 0)
    chips.push({ kind: 'noSubject', key: 'noSubject', classes: w.noSubject })
  return chips
}

/** Birinchi `max` ta chip ko'rinadi, qolganlari "+N" ga yig'iladi. */
export function splitChips(
  chips: WorkloadChip[],
  max: number,
): { visible: WorkloadChip[]; hidden: number } {
  return { visible: chips.slice(0, max), hidden: Math.max(0, chips.length - max) }
}
