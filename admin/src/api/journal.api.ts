import { downloadFile } from './download'
import { getData } from './http'
import type { ExportFormat } from './types'

export type JournalAbsence = 'N' | 'B' | 'partial'

export interface JournalCellData {
  grade?: 2 | 3 | 4 | 5
  gradeId?: string
  absence?: JournalAbsence
}

export interface JournalStudent {
  id: string
  fullName: string
  studentCode: string | null
  photo: string | null
  /** Hozir bu sinfda emas, lekin davrda bahosi bor */
  transferred: boolean
}

export interface JournalSummaryRow {
  avg: number | null
  count: number
  absentN: number
  absentB: number
}

/**
 * Jurnal ustuni. key: `YYYY-MM-DD#lessonNo` (dars) yoki `YYYY-MM-DD` (ish kuni, lessonNo 0).
 * source: timetable - jadval darsi; workday - jadval qamramagan ish kuni; record - ustuni yo'q baho.
 */
export interface JournalColumn {
  key: string
  date: string
  weekday: number
  lessonNo: number
  source: 'timetable' | 'workday' | 'record'
  cancelled: boolean
}

export interface JournalGridData {
  class: { id: string; name: string }
  subject: { id: string; name: string }
  teacher: { id: string; fullName: string } | null
  school: { id: string; name: string }
  from: string
  to: string
  columns: JournalColumn[]
  students: JournalStudent[]
  cells: Record<string, Record<string, JournalCellData>>
  summary: {
    perStudent: Record<string, JournalSummaryRow>
    perColumn: Record<string, { avg: number | null; count: number }>
    classAvg: number | null
    classCount: number
  }
}

export interface JournalOptions {
  today: string
  workingWeekdays: number[]
  periods: { id: string; name: string; from: string; to: string }[]
  mode: 'all' | 'assigned'
  classes: {
    id: string
    name: string
    grade: number
    homeroom: boolean
    subjects: { id: string; name: string; assigned: boolean }[]
  }[]
}

export interface JournalQuery {
  classId: string
  subjectId: string
  from: string
  to: string
}

export const journalApi = {
  options: () => getData<JournalOptions>('/journal/options'),
  subject: (q: JournalQuery) => getData<JournalGridData>('/journal/subject', q),
  /** Excel/PDF eksport (autentifikatsiyali blob yuklash) */
  export: (format: ExportFormat, q: JournalQuery): Promise<string> =>
    downloadFile(`/journal/subject/export.${format}`, {
      params: { ...q },
      fallbackName: `jurnal_${q.from}_${q.to}.${format}`,
    }),
}
