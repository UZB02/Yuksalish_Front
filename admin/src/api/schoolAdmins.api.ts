import { getData, getPage, sendData } from './http'
import type {
  Paginated,
  SchoolAdmin,
  SchoolAdminCreatePayload,
  SchoolAdminListParams,
  SchoolAdminUpdatePayload,
} from './types'

export const schoolAdminsApi = {
  list: (params: SchoolAdminListParams = {}): Promise<Paginated<SchoolAdmin>> =>
    getPage('/school-admins', params),
  get: (id: string) => getData<SchoolAdmin>(`/school-admins/${id}`),
  create: (payload: SchoolAdminCreatePayload) =>
    sendData<SchoolAdmin>('post', '/school-admins', payload),
  update: (id: string, payload: SchoolAdminUpdatePayload) =>
    sendData<SchoolAdmin>('patch', `/school-admins/${id}`, payload),
  setPermissions: (id: string, permissions: string[]) =>
    sendData<SchoolAdmin>('put', `/school-admins/${id}/permissions`, { permissions }),
  resetPassword: (id: string, newPassword: string) =>
    sendData<unknown>('post', `/school-admins/${id}/reset-password`, { newPassword }),
}
