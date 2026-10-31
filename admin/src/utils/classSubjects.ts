import type { ClassSubjectAssignment, ClassSubjectInput } from '@/api/types'

/** Sinfdagi bir fan va uning barcha o'qituvchilari: "Ingliz tili — Aliyeva, G'aniyeva" */
export interface SubjectTeachers {
  subjectId: string
  name: string
  teachers: { id: string; fullName: string }[]
}

/**
 * Biriktirishlarni fan bo'yicha guruhlaydi: bir fanga bir nechta o'qituvchi bo'lishi mumkin
 * (har bir fan-o'qituvchi juftligi alohida kurs). Tartib: fan nomi, o'qituvchi ismi.
 */
export function groupBySubject(list: ClassSubjectAssignment[] | undefined): SubjectTeachers[] {
  const out = new Map<string, SubjectTeachers>()
  for (const a of list ?? []) {
    let g = out.get(a.subjectId)
    if (!g) {
      g = { subjectId: a.subjectId, name: a.subject?.name ?? '?', teachers: [] }
      out.set(a.subjectId, g)
    }
    if (!g.teachers.some((t) => t.id === a.teacherId)) {
      g.teachers.push({ id: a.teacherId, fullName: a.teacher?.fullName ?? '?' })
    }
  }
  return [...out.values()]
    .map((g) => ({
      ...g,
      teachers: [...g.teachers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'uz'))
}

/** Matnli ko'rinish: "Ingliz tili — Aliyeva, G'aniyeva" */
export const subjectTeachersLabel = (g: SubjectTeachers): string =>
  `${g.name} — ${g.teachers.map((t) => t.fullName).join(', ')}`

/** "Abdullajonov Navro'zbek" -> "Abdullajonov N." (Familiya I.) */
export function shortName(fullName: string): string {
  const [last, first] = fullName.trim().split(/\s+/)
  return first ? `${last} ${first.charAt(0).toUpperCase()}.` : (last ?? '')
}

/** Aynan bir xil (fan, o'qituvchi) juftligi takrorlanganmi (to'liq qatorlar bo'yicha) */
export function hasDuplicatePair(rows: ClassSubjectInput[]): boolean {
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.subjectId || !r.teacherId) continue
    const k = `${r.subjectId}:${r.teacherId}`
    if (seen.has(k)) return true
    seen.add(k)
  }
  return false
}
