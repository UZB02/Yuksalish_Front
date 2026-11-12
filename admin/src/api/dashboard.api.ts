import { getData } from './http'
import type { AttendanceTrend, AttentionStudents, DashboardSummary, UnscoredClasses } from './types'

export const dashboardApi = {
  summary: () => getData<DashboardSummary>('/dashboard/summary'),
  unscoredClasses: () => getData<UnscoredClasses>('/dashboard/unscored-classes'),
  attentionStudents: () => getData<AttentionStudents>('/dashboard/attention-students'),
  attendanceTrend: () => getData<AttendanceTrend>('/dashboard/attendance-trend'),
}
