import { getPage, sendData } from './http'
import type {
  AttendanceStatus,
  AttendanceStatusCreatePayload,
  AttendanceStatusListParams,
  AttendanceStatusPayload,
  Paginated,
} from './types'

export const attendanceStatusesApi = {
  list: (params: AttendanceStatusListParams = {}): Promise<Paginated<AttendanceStatus>> =>
    getPage('/attendance-statuses', { limit: 100, ...params }),
  create: (payload: AttendanceStatusCreatePayload) =>
    sendData<AttendanceStatus>('post', '/attendance-statuses', payload),
  update: (id: string, payload: Partial<AttendanceStatusPayload>) =>
    sendData<AttendanceStatus>('patch', `/attendance-statuses/${id}`, payload),
  activate: (id: string) =>
    sendData<AttendanceStatus>('post', `/attendance-statuses/${id}/activate`),
  deactivate: (id: string) =>
    sendData<AttendanceStatus>('post', `/attendance-statuses/${id}/deactivate`),
}
