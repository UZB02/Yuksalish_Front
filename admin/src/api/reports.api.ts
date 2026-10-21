import { downloadFile } from './download'
import { clean, getData } from './http'
import type {
  BehaviorReport,
  ClassReport,
  ExportFormat,
  ReportParams,
  ReportType,
  SchoolReport,
  SchoolsReport,
  StudentReport,
  TeachersReport,
} from './types'

type Period = Pick<ReportParams, 'from' | 'to'>

/** Hisobot (va eksport) URL: o'quvchi hisoboti id ni yo'lda oladi. */
export function reportPath(type: ReportType, studentId?: string): string {
  return type === 'student' ? `/reports/student/${studentId ?? ''}` : `/reports/${type}`
}

export const reportsApi = {
  class: (p: Period & { classId: string }) => getData<ClassReport>('/reports/class', p),
  student: (studentId: string, p: Period) =>
    getData<StudentReport>(`/reports/student/${studentId}`, p),
  teachers: (p: ReportParams) => getData<TeachersReport>('/reports/teachers', p),
  school: (p: Period) => getData<SchoolReport>('/reports/school', p),
  behavior: (p: ReportParams) => getData<BehaviorReport>('/reports/behavior', p),
  schools: (p: Period) => getData<SchoolsReport>('/reports/schools', p),

  /** Eksport: autentifikatsiyali blob yuklash (download.ts). Fayl nomi serverdan, bo'lmasa zaxira. */
  export(
    type: ReportType,
    format: ExportFormat,
    params: Partial<ReportParams>,
    studentId?: string,
  ): Promise<string> {
    return downloadFile(`${reportPath(type, studentId)}/export`, {
      params: { ...clean(params), format },
      fallbackName: `hisobot-${type}.${format}`,
    })
  },
}
