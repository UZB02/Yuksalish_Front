import { downloadFile } from './download'
import { deleteData, getData, sendData } from './http'
import type { ExportFormat, MyTodayLessons } from './types'

export type TimetableStatus = 'draft' | 'active' | 'superseded' | 'replaced'
export type TimetablePhase = 'draft' | 'past' | 'current' | 'future' | 'replaced'
export type WarningCode =
  | 'teacher_double_booked'
  | 'teacher_not_assigned'
  | 'subject_inactive'
  | 'teacher_inactive'
  | 'out_of_range'

export interface TimetableEntry {
  weekday: number
  lessonNo: number
  subjectId: string
  teacherId: string
  groupKey?: string | null
  room: string | null
  subject?: { id: string; name: string } | null
  teacher?: { id: string; fullName: string } | null
  outOfRange?: boolean
}

export interface EntryPayload {
  weekday: number
  lessonNo: number
  subjectId: string
  teacherId: string
  room: string | null
}

export interface TimetableVersionSummary {
  id: string
  classId: string
  status: TimetableStatus
  phase: TimetablePhase
  validFrom: string
  validTo: string | null
  entryCount: number
  note: string | null
  forced: boolean
  activatedAt: string | null
  /** Almashtirilgan (status=replaced) versiya: qachon va qaysi versiya almashtirgan */
  replacedAt?: string | null
  replacedBy?: string | null
  /** Avtomatik o'chiriladigan sana (YYYY-MM-DD): almashtirilgan versiya yoki eski qoralama */
  purgeAt?: string | null
  updatedAt: string
}

export interface TimetableVersion extends TimetableVersionSummary {
  academicYearId: string
  weekPattern: string
  basedOnVersionId: string | null
  entries: TimetableEntry[]
}

export interface TimetableWarning {
  code: WarningCode
  severity: 'error' | 'warning'
  weekday: number
  lessonNo: number
  subjectId: string
  teacherId: string
  message: string
  other?: {
    classId: string
    className: string
    versionId: string
    validFrom: string
    validTo: string | null
    /** Shu sinfning to'qnashayotgan versiyalari (eski serverda bo'lmasligi mumkin) */
    versions?: { versionId: string; validFrom: string; validTo: string | null }[]
  }
  /** Ommaviy faollashtirish oldindan ko'rishida: ogohlantirish qaysi sinfniki */
  classId?: string
  className?: string
}

export interface BusyTeacher {
  teacherId: string
  classId: string
  className: string
}

/** Faollashtirilsa almashtiriladigan (amal qilmay qoladigan) versiya */
export interface WillReplace {
  id: string
  validFrom: string
  validTo: string | null
  /** Ommaviy faollashtirishda: qaysi sinfniki */
  classId?: string
  className?: string
}

export interface VersionWithWarnings {
  version: TimetableVersion
  warnings: TimetableWarning[]
  /** Faqat qoralama uchun (eski serverda bo'lmasligi mumkin) */
  willReplace?: WillReplace[]
}

/** Faollashtirish oynasi oldindan ko'rishi: ogohlantirishlar + almashtiriladigan versiyalar */
export interface ActivationPreview {
  warnings: TimetableWarning[]
  willReplace?: WillReplace[]
}

export interface TimetableSettings {
  workingWeekdays: number[]
  lessonsPerDay: number
}

export interface ClassVersions {
  class: { id: string; name: string; grade: number; isArchived: boolean }
  academicYear: { id: string; name: string; startDate: string; endDate: string }
  settings: TimetableSettings
  today: string
  versions: TimetableVersionSummary[]
}

export interface ClassOverviewRow {
  classId: string
  name: string
  grade: number
  current: TimetableVersionSummary | null
  upcoming: TimetableVersionSummary | null
  draft: TimetableVersionSummary | null
  warningsCount: number
  errorsCount: number
}

export interface TimetableOverview {
  today: string
  classes: ClassOverviewRow[]
}

export interface TimetableOptions {
  subjects: { id: string; name: string }[]
  teachers: { id: string; fullName: string }[]
  classAssignments: { subjectId: string; teacherId: string }[]
  subjectTeachers: Record<string, string[]>
}

export interface TimetableLesson {
  classId: string
  date: string
  weekday: number
  lessonNo: number
  subjectId: string
  teacherId: string
  room: string | null
  source: 'timetable' | 'override'
  cancelled: boolean
  /** Almashtirish (override) bo'lsa: turi va id; asl o'qituvchi/fan (bo'lsa) */
  overrideType?: OverrideType | null
  overrideId?: string | null
  originalTeacherId?: string | null
  originalSubjectId?: string | null
  versionId: string | null
  class: { id: string; name: string; grade: number } | null
  subject: { id: string; name: string }
  teacher: { id: string; fullName: string }
}

export interface TeacherWeek {
  teacher: { id: string; fullName: string }
  from: string
  to: string
  today: string
  settings: TimetableSettings
  weeklyCount: number
  days: { date: string; weekday: number; lessons: TimetableLesson[] }[]
}

export interface TimetableDay {
  date: string
  weekday: number
  today: string
  working: boolean
  settings: TimetableSettings
  classes: { classId: string; name: string; grade: number; lessons: TimetableLesson[] }[]
}

export interface ActivatePayload {
  validFrom: string
  force?: boolean
  note?: string | null
  syncAssignments?: boolean
  confirmPast?: boolean
}

export type OverrideType = 'substitute' | 'replace' | 'cancel' | 'extra'

export interface OverrideDto {
  id: string
  classId: string
  class: { id: string; name: string }
  date: string
  lessonNo: number
  type: OverrideType
  subject: { id: string; name: string } | null
  teacher: { id: string; fullName: string } | null
  originalSubject: { id: string; name: string } | null
  originalTeacher: { id: string; fullName: string } | null
  room: string | null
  reason: string | null
  moveGroupId: string | null
  createdAt: string
  createdBy: { id: string; fullName: string } | null
}

export interface DayLessonDto {
  classId: string
  class: { id: string; name: string }
  lessonNo: number
  subject: { id: string; name: string }
  teacher: { id: string; fullName: string }
  originalTeacher: { id: string; fullName: string } | null
  source: 'timetable' | 'override'
  overrideType: OverrideType | null
  overrideId: string | null
  cancelled: boolean
}

export interface TeacherDayLessons {
  date: string
  isWorkday: boolean
  lessons: DayLessonDto[]
}

export interface FreeTeacher {
  id: string
  fullName: string
  free: boolean
  teachesSubject: boolean
  lessonsThatDay: number
}

export interface CreateOverridePayload {
  classId: string
  date: string
  lessonNo: number
  type: OverrideType
  subjectId?: string
  teacherId?: string
  room?: string | null
  reason?: string | null
}

export interface MoveOverridePayload {
  classId: string
  from: { date: string; lessonNo: number }
  to: { date: string; lessonNo: number }
  teacherId?: string
  reason?: string | null
}

export type CopyFrom = 'active' | string | { classId: string }

export const timetableApi = {
  overview: () => getData<TimetableOverview>('/timetable/classes'),
  options: (classId?: string) => getData<TimetableOptions>('/timetable/options', { classId }),
  versions: (classId: string) => getData<ClassVersions>(`/timetable/classes/${classId}/versions`),
  createVersion: (
    classId: string,
    body: { validFrom?: string; copyFrom?: CopyFrom; note?: string | null } = {},
  ) => sendData<VersionWithWarnings>('post', `/timetable/classes/${classId}/versions`, body),
  version: (id: string, validFrom?: string) =>
    getData<VersionWithWarnings>(`/timetable/versions/${id}`, { validFrom }),
  /** Katak (hafta kuni + dars) uchun boshqa sinflarda band o'qituvchilar */
  busyTeachers: (id: string, weekday: number, lessonNo: number, validFrom?: string) =>
    getData<{ items: BusyTeacher[] }>(`/timetable/versions/${id}/busy-teachers`, {
      weekday,
      lessonNo,
      validFrom,
    }),
  saveDraft: (
    id: string,
    body: { entries: EntryPayload[]; validFrom?: string; note?: string | null },
  ) => sendData<VersionWithWarnings>('put', `/timetable/versions/${id}`, body),
  deleteVersion: (id: string) => deleteData<{ deleted: boolean }>(`/timetable/versions/${id}`),
  activate: (id: string, body: ActivatePayload) =>
    sendData<
      VersionWithWarnings & { syncedAssignments: { subjectId: string; teacherId: string }[] }
    >('post', `/timetable/versions/${id}/activate`, body),
  activateBulk: (body: ActivatePayload & { versionIds: string[] }) =>
    sendData<{ activated: { versionId: string; classId: string; className: string }[] }>(
      'post',
      '/timetable/activate-bulk',
      body,
    ),
  bulkPreview: (body: { versionIds: string[]; validFrom: string }) =>
    sendData<{
      warnings: (TimetableWarning & { versionId: string; classId: string; className: string })[]
      willReplace?: WillReplace[]
    }>('post', '/timetable/activate-bulk/preview', body),
  correct: (
    id: string,
    body: {
      entries: EntryPayload[]
      force?: boolean
      note?: string | null
      syncAssignments?: boolean
    },
  ) => sendData<VersionWithWarnings>('post', `/timetable/versions/${id}/correct`, body),
  teacherWeek: (teacherId: string, date?: string) =>
    getData<TeacherWeek>(`/timetable/teachers/${teacherId}/week`, { date }),
  myWeek: (date?: string) => getData<TeacherWeek>('/timetable/me/week', { date }),
  /** Excel/PDF eksport (haftalik jadval, almashtirishlarsiz): autentifikatsiyali blob yuklash */
  exportClass: (
    classId: string,
    format: ExportFormat,
    q: { date?: string; versionId?: string } = {},
  ): Promise<string> =>
    downloadFile(`/timetable/classes/${classId}/export`, {
      params: { format, ...q },
      fallbackName: `dars-jadvali.${format}`,
    }),
  exportTeacher: (teacherId: string, format: ExportFormat, date?: string): Promise<string> =>
    downloadFile(`/timetable/teachers/${teacherId}/export`, {
      params: { format, date },
      fallbackName: `dars-jadvali.${format}`,
    }),
  exportMine: (format: ExportFormat, date?: string): Promise<string> =>
    downloadFile('/timetable/me/export', {
      params: { format, date },
      fallbackName: `dars-jadvali.${format}`,
    }),
  exportSchool: (
    kind: 'classes' | 'teachers',
    format: ExportFormat,
    date?: string,
  ): Promise<string> =>
    downloadFile('/timetable/export', {
      params: { kind, format, date },
      fallbackName: `dars-jadvali-maktab.${format}`,
    }),
  /** Bugungi darslarim (davomat holati bilan) */
  myToday: () => getData<MyTodayLessons>('/timetable/me/today'),
  day: (date?: string) => getData<TimetableDay>('/timetable/day', { date }),
  lessons: (classId: string, date: string) =>
    getData<{ classId: string; date: string; lessons: TimetableLesson[] }>('/timetable/lessons', {
      classId,
      date,
    }),
  /** O'qituvchi bo'yicha kun darslari (almashtirish uchun) */
  teacherDay: (date: string, teacherId: string) =>
    getData<TeacherDayLessons>('/timetable/teacher-day', { date, teacherId }),
  overrides: (date: string) => getData<{ items: OverrideDto[] }>('/timetable/overrides', { date }),
  freeTeachers: (date: string, lessonNo: number, subjectId?: string) =>
    getData<{ items: FreeTeacher[] }>('/timetable/free-teachers', { date, lessonNo, subjectId }),
  createOverride: (body: CreateOverridePayload) =>
    sendData<OverrideDto>('post', '/timetable/overrides', body),
  moveLesson: (body: MoveOverridePayload) =>
    sendData<{ items: OverrideDto[] }>('post', '/timetable/overrides/move', body),
  deleteOverride: (id: string) => deleteData<void>(`/timetable/overrides/${id}`),
}
