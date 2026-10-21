import { getData } from './http'
import type { DashboardSummary } from './types'

export const dashboardApi = {
  summary: () => getData<DashboardSummary>('/dashboard/summary'),
}
