import { getData, getPage, sendData } from './http'
import type {
  Paginated,
  Teacher,
  TeacherCreatePayload,
  TeacherListParams,
  TeacherUpdatePayload,
} from './types'

export const teachersApi = {
  list: (params: TeacherListParams = {}): Promise<Paginated<Teacher>> =>
    getPage('/teachers', params),
  get: (id: string) => getData<Teacher>(`/teachers/${id}`),
  create: (payload: TeacherCreatePayload) => sendData<Teacher>('post', '/teachers', payload),
  update: (id: string, payload: TeacherUpdatePayload) =>
    sendData<Teacher>('patch', `/teachers/${id}`, payload),
  setPermissions: (id: string, permissions: string[]) =>
    sendData<Teacher>('put', `/teachers/${id}/permissions`, { permissions }),
  setClasses: (id: string, classIds: string[]) =>
    sendData<Teacher>('put', `/teachers/${id}/classes`, { classIds }),
  resetPassword: (id: string, newPassword: string) =>
    sendData<unknown>('post', `/teachers/${id}/reset-password`, { newPassword }),
}
