import type {
  BusyTeacher,
  TimetableOptions,
  TimetableWarning,
  WarningCode,
} from '@/api/timetable.api'
import { cellKey } from './timetable'

type Translate = (key: string, named?: Record<string, unknown>) => string

export type IssueSeverity = 'error' | 'warning' | 'info'

/** Muammo matnlarini boyitish uchun nomlar (bo'lmasa umumiy matn ishlatiladi) */
export interface IssueContext {
  subjectName?: (id: string) => string | undefined
  teacherName?: (id: string) => string | undefined
  /** Sinfda fanga biriktirilgan o'qituvchi ismi */
  assignedTeacherName?: (subjectId: string) => string | undefined
}

interface NamedLesson {
  subjectId: string
  teacherId: string
  subjectName?: string
  teacherName?: string
}

/** Sozlamalar (fanlar, o'qituvchilar, biriktirishlar) va kataklardagi nomlardan kontekst */
export function issueContextFrom(
  options: TimetableOptions | null | undefined,
  cells: Record<string, NamedLesson | NamedLesson[]> = {},
): IssueContext {
  const subjects = new Map((options?.subjects ?? []).map((s) => [s.id, s.name]))
  const teachers = new Map((options?.teachers ?? []).map((x) => [x.id, x.fullName]))
  for (const c of Object.values(cells).flat()) {
    if (c.subjectName && !subjects.has(c.subjectId)) subjects.set(c.subjectId, c.subjectName)
    if (c.teacherName && !teachers.has(c.teacherId)) teachers.set(c.teacherId, c.teacherName)
  }
  return {
    subjectName: (id) => subjects.get(id),
    teacherName: (id) => teachers.get(id),
    // Fanga bir nechta o'qituvchi biriktirilgan bo'lishi mumkin: hammasi vergul bilan
    assignedTeacherName: (sid) => {
      const names = (options?.classAssignments ?? [])
        .filter((x) => x.subjectId === sid)
        .map((x) => teachers.get(x.teacherId))
        .filter((n): n is string => !!n)
      return names.length ? names.join(', ') : undefined
    },
  }
}

export interface TimetableIssue {
  /** Takrorlanmas kalit (kod + katak + boshqa sinf) */
  key: string
  code: WarningCode
  severity: IssueSeverity
  weekday: number
  lessonNo: number
  title: string
  text: string
  /** "Dush · 1-dars · Informatika" */
  cellLabel: string
  /** Ogohlantirish aynan qaysi dars (o'qituvchi/fan) uchun — katakda bir nechta dars bo'lishi mumkin */
  teacherId?: string
  subjectId?: string
  /** To'qnashuvda: ikkinchi sinf */
  otherClass?: { id: string; name: string }
  /** Ommaviy faollashtirishda: ogohlantirish qaysi sinfniki */
  className?: string
  /** teacher_overlap_approved: ruxsat kim va qaysi yozuvga bergan */
  approval?: TimetableWarning['approval']
}

export const issueKey = (w: TimetableWarning) =>
  [w.code, w.weekday, w.lessonNo, w.other?.classId ?? '', w.classId ?? '', w.teacherId ?? ''].join(
    '|',
  )

const KNOWN: string[] = [
  'teacher_double_booked',
  'teacher_overlap_approved',
  'teacher_not_assigned',
  'subject_inactive',
  'teacher_inactive',
  'out_of_range',
]

/** Bitta ogohlantirishni sarlavha + tushuntirish ko'rinishiga keltiradi */
export function formatIssue(
  w: TimetableWarning,
  t: Translate,
  ctx: IssueContext = {},
): TimetableIssue {
  const day = t(`journal.weekdayLong.${w.weekday}`).toLowerCase()
  const subject = ctx.subjectName?.(w.subjectId)
  const teacher = ctx.teacherName?.(w.teacherId)
  const subjectText = subject ?? t('timetable.issues.subjectFallback')
  const teacherText = teacher ?? t('timetable.issues.teacherFallback')
  let title: string
  let text: string
  if (!KNOWN.includes(w.code)) {
    title = t(`timetable.issues.severity.${w.severity}`)
    text = w.message
  } else if (w.code === 'teacher_double_booked') {
    const n = w.other?.versions?.length ?? 0
    title = t('timetable.issues.title.teacher_double_booked')
    text = t('timetable.issues.text.teacher_double_booked', {
      day,
      no: w.lessonNo,
      teacher: teacherText,
      cls: w.other?.className ?? '?',
    })
    if (n > 1) text += ` ${t('timetable.issues.text.multiVersion', { n })}`
  } else if (w.code === 'teacher_overlap_approved') {
    title = t('timetable.issues.title.teacher_overlap_approved')
    text = t('timetable.issues.text.teacher_overlap_approved', {
      day,
      no: w.lessonNo,
      teacher: teacherText,
      cls: w.other?.className ?? '?',
    })
  } else if (w.code === 'teacher_not_assigned') {
    const assigned = ctx.assignedTeacherName?.(w.subjectId)
    if (assigned) {
      title = t('timetable.issues.title.other_teacher')
      text = t('timetable.issues.text.other_teacher', {
        subject: subjectText,
        assigned,
        teacher: teacherText,
      })
    } else {
      title = t('timetable.issues.title.teacher_not_assigned')
      text = t('timetable.issues.text.teacher_not_assigned', { subject: subjectText })
    }
  } else {
    title = t(`timetable.issues.title.${w.code}`)
    text = t(`timetable.issues.text.${w.code}`, {
      day,
      no: w.lessonNo,
      subject: subjectText,
      teacher: teacherText,
    })
  }
  return {
    key: issueKey(w),
    code: w.code,
    severity: w.severity,
    weekday: w.weekday,
    lessonNo: w.lessonNo,
    title,
    text,
    cellLabel: [
      t(`timetable.issues.dayShort.${w.weekday}`),
      t('timetable.issues.lessonNo', { no: w.lessonNo }),
      subject,
    ]
      .filter(Boolean)
      .join(' · '),
    teacherId: w.teacherId,
    subjectId: w.subjectId,
    otherClass: w.other ? { id: w.other.classId, name: w.other.className } : undefined,
    className: w.className,
    approval: w.approval,
  }
}

const RANK: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 }
const bySeverity = (a: TimetableIssue, b: TimetableIssue) => RANK[a.severity] - RANK[b.severity]

/**
 * Ogohlantirishlardan muammolar ro'yxati: takrorlar olib tashlanadi,
 * xatolar birinchi, so'ng hafta kuni / dars raqami bo'yicha.
 */
export function buildIssues(
  warnings: TimetableWarning[],
  t: Translate,
  ctx: IssueContext = {},
): TimetableIssue[] {
  const seen = new Set<string>()
  const out: TimetableIssue[] = []
  for (const w of warnings) {
    const k = issueKey(w)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(formatIssue(w, t, ctx))
  }
  return out.sort((a, b) => bySeverity(a, b) || a.weekday - b.weekday || a.lessonNo - b.lessonNo)
}

/** "Sinfga biriktirish" mumkin bo'lgan muammo: o'qituvchi va fan aniq */
export const isAssignable = (i: Pick<TimetableIssue, 'code' | 'teacherId' | 'subjectId'>) =>
  i.code === 'teacher_not_assigned' && !!i.teacherId && !!i.subjectId

/** "O'qituvchi tanlanmagan" holati: biriktirish emas, avval katakni to'ldirish kerak */
export const needsTeacher = (i: Pick<TimetableIssue, 'code' | 'teacherId'>) =>
  i.code === 'teacher_not_assigned' && !i.teacherId

/** Muammolardagi takrorlanmas (fan, o'qituvchi) juftliklari (bir juftlik bir necha kunda bo'lishi mumkin) */
export function assignablePairs(
  issues: TimetableIssue[],
): { subjectId: string; teacherId: string }[] {
  const seen = new Map<string, { subjectId: string; teacherId: string }>()
  for (const i of issues) {
    if (!isAssignable(i)) continue
    const k = `${i.subjectId}:${i.teacherId}`
    if (!seen.has(k))
      seen.set(k, { subjectId: i.subjectId as string, teacherId: i.teacherId as string })
  }
  return [...seen.values()]
}

export interface IssueCounts {
  error: number
  warning: number
  /** Ruxsat berilgan bir vaqtda o'tishlar (ma'lumot uchun; total ga kirmaydi) */
  info: number
  /** Xato + ogohlantirish */
  total: number
}
export function countIssues(issues: { severity: IssueSeverity }[]): IssueCounts {
  const error = issues.filter((i) => i.severity === 'error').length
  const warning = issues.filter((i) => i.severity === 'warning').length
  return { error, warning, info: issues.length - error - warning, total: error + warning }
}

export function issuesByCell(issues: TimetableIssue[]): Record<string, TimetableIssue[]> {
  const out: Record<string, TimetableIssue[]> = {}
  for (const i of issues) (out[cellKey(i.weekday, i.lessonNo)] ??= []).push(i)
  return out
}

/** Katak uchun qisqa matn (aria-label): "1 ta xato, 2 ta ogohlantirish" */
export function cellIssueSummary(issues: { severity: IssueSeverity }[] | undefined, t: Translate) {
  const c = countIssues(issues ?? [])
  return [
    c.error ? t('timetable.issues.nError', { n: c.error }) : '',
    c.warning ? t('timetable.issues.nWarning', { n: c.warning }) : '',
  ]
    .filter(Boolean)
    .join(', ')
}

/** Katak tooltip matni (native title) */
export const issueTooltip = (issues: TimetableIssue[] | undefined) =>
  (issues ?? []).map((i) => `${i.title}: ${i.text}`).join('\n')

/** O'qituvchi shu vaqtda band bo'lgan sinflar nomlari */
export function busyClassesOf(busy: BusyTeacher[], teacherId: string): string[] {
  return [...new Set(busy.filter((b) => b.teacherId === teacherId).map((b) => b.className))]
}

/** Ruxsat talab qiladigan sinflar: o'qituvchi band va boshqa sinfdagi yozuvda ruxsat yo'q */
export function unapprovedBusyClassesOf(busy: BusyTeacher[], teacherId: string): string[] {
  return [
    ...new Set(
      busy.filter((b) => b.teacherId === teacherId && !b.approved).map((b) => b.className),
    ),
  ]
}

/**
 * Tahrirlash oynasida jonli ko'rinish: tanlangan fan/o'qituvchi bo'yicha mijoz tomonida
 * hisoblangan ogohlantirishlar (to'qnashuv — band o'qituvchilar ro'yxatidan, biriktirish — sozlamalardan).
 */
export function previewCellWarnings(input: {
  weekday: number
  lessonNo: number
  subjectId: string
  teacherId: string
  options: Pick<TimetableOptions, 'classAssignments'>
  busy: BusyTeacher[]
  /** Shu darsga bir vaqtda o'tish ruxsati berilgan (tahrirlash oynasida belgilangan yoki saqlangan) */
  approved?: boolean
}): TimetableWarning[] {
  const { weekday, lessonNo, subjectId, teacherId } = input
  if (!subjectId || !teacherId) return []
  const base = { weekday, lessonNo, subjectId, teacherId }
  const out: TimetableWarning[] = []
  const seen = new Set<string>()
  for (const b of input.busy) {
    if (b.teacherId !== teacherId || seen.has(b.classId)) continue
    seen.add(b.classId)
    // Juftlik ruxsat bilan qoplangan (shu dars yoki boshqa sinfdagi yozuv): xato emas, info
    const covered = !!input.approved || !!b.approved
    out.push({
      ...base,
      code: covered ? 'teacher_overlap_approved' : 'teacher_double_booked',
      severity: covered ? 'info' : 'error',
      message: '',
      other: {
        classId: b.classId,
        className: b.className,
        versionId: '',
        validFrom: '',
        validTo: null,
      },
    })
  }
  // Fanga bir nechta o'qituvchi biriktirilgan bo'lishi mumkin: ulardan biri bo'lsa ogohlantirilmaydi
  const assigned = input.options.classAssignments.some(
    (a) => a.subjectId === subjectId && a.teacherId === teacherId,
  )
  if (!assigned) {
    out.push({ ...base, code: 'teacher_not_assigned', severity: 'warning', message: '' })
  }
  return out
}
