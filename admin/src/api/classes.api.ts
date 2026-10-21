import { getData, getPage, sendData } from './http'
import type {
  ClassListParams,
  ClassSubjectInput,
  ClassPayload,
  ClassTeachersPayload,
  Paginated,
  SchoolClass,
} from './types'

export const classesApi = {
  list: (params: ClassListParams = {}): Promise<Paginated<SchoolClass>> =>
    getPage('/classes', params),
  get: (id: string) => getData<SchoolClass>(`/classes/${id}`),
  create: (payload: ClassPayload) => sendData<SchoolClass>('post', '/classes', payload),
  update: (id: string, payload: Partial<ClassPayload>) =>
    sendData<SchoolClass>('patch', `/classes/${id}`, payload),
  archive: (id: string) => sendData<SchoolClass>('post', `/classes/${id}/archive`),
  unarchive: (id: string) => sendData<SchoolClass>('post', `/classes/${id}/unarchive`),
  setSubjects: (id: string, subjects: ClassSubjectInput[]) =>
    sendData<SchoolClass>('put', `/classes/${id}/subjects`, { subjects }),
  setTeachers: (id: string, payload: ClassTeachersPayload) =>
    sendData<SchoolClass>('put', `/classes/${id}/teachers`, payload),
}
