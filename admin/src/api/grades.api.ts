import { getData, getPage, http, sendData } from './http'
import type {
  BulkGradesPayload,
  BulkScoresResult,
  GradeAssignments,
  GradeListParams,
  GradeSheet,
  GradeUpdatePayload,
  Paginated,
  StudentGradeSummary,
  SubjectGrade,
} from './types'

export const gradesApi = {
  list: (params: GradeListParams = {}): Promise<Paginated<SubjectGrade>> =>
    getPage('/grades', params),
  update: (id: string, payload: GradeUpdatePayload) =>
    sendData<SubjectGrade>('patch', `/grades/${id}`, payload),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/grades/${id}`)
  },
  bulk: (payload: BulkGradesPayload) => sendData<BulkScoresResult>('post', '/grades/bulk', payload),
  assignments: () => getData<GradeAssignments>('/grades/my-assignments'),
  sheet: (
    classId: string,
    subjectId: string,
    date?: string,
    lessonNo?: number | null,
    teacherId?: string,
  ) =>
    getData<GradeSheet>('/grades/sheet', {
      classId,
      subjectId,
      date,
      lessonNo: lessonNo ?? undefined,
      teacherId,
    }),
  studentSummary: (studentId: string, params: { from?: string; to?: string } = {}) =>
    getData<StudentGradeSummary>(`/students/${studentId}/grade-summary`, params),
}
