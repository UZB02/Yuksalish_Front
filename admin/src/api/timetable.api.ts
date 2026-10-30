import { deleteData, getData, sendData } from './http'

export type TimetableStatus = 'draft' | 'active' | 'superseded'
export type TimetablePhase = 'draft' | 'past' | 'current' | 'future'
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
  }
}

export interface VersionWithWarnings {
  version: TimetableVersion
  warnings: TimetableWarning[]
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
  day: (date?: string) => getData<TimetableDay>('/timetable/day', { date }),
  lessons: (classId: string, date: string) =>
    getData<{ classId: string; date: string; lessons: TimetableLesson[] }>('/timetable/lessons', {
      classId,
      date,
    }),
}
