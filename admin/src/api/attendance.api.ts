import { getData, getPage, http, sendData } from './http'
import type {
  AttendanceBulkPayload,
  AttendanceListParams,
  AttendanceProgress,
  AttendanceRecord,
  AttendanceSheet,
  AttendanceSummary,
  AttendanceUpdatePayload,
  BulkScoresResult,
  Paginated,
  StudentAttendanceSummary,
} from './types'

export const attendanceApi = {
  sheet: (classId: string, params: { date?: string; lessonNo?: number; teacherId?: string } = {}) =>
    getData<AttendanceSheet>(`/classes/${classId}/attendance-sheet`, params),
  bulk: (payload: AttendanceBulkPayload) =>
    sendData<BulkScoresResult>('post', '/attendance/bulk', payload),
  list: (params: AttendanceListParams = {}): Promise<Paginated<AttendanceRecord>> =>
    getPage('/attendance', params),
  update: (id: string, payload: AttendanceUpdatePayload) =>
    sendData<AttendanceRecord>('patch', `/attendance/${id}`, payload),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/attendance/${id}`)
  },
  summary: (params: { classId?: string; from?: string; to?: string }) =>
    getData<AttendanceSummary>('/attendance/summary', params),
  studentSummary: (studentId: string, params: { from?: string; to?: string } = {}) =>
    getData<StudentAttendanceSummary>(`/students/${studentId}/attendance-summary`, params),
  todayProgress: () => getData<AttendanceProgress[]>('/attendance/today-progress'),
}
