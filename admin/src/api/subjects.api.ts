import { getPage, http, sendData } from './http'
import type {
  Paginated,
  Subject,
  SubjectCreatePayload,
  SubjectListParams,
  SubjectPayload,
} from './types'

export const subjectsApi = {
  list: (params: SubjectListParams = {}): Promise<Paginated<Subject>> =>
    getPage('/subjects', params),
  create: (payload: SubjectCreatePayload) => sendData<Subject>('post', '/subjects', payload),
  update: (id: string, payload: Partial<SubjectPayload>) =>
    sendData<Subject>('patch', `/subjects/${id}`, payload),
  activate: (id: string) => sendData<Subject>('post', `/subjects/${id}/activate`),
  deactivate: (id: string) => sendData<Subject>('post', `/subjects/${id}/deactivate`),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/subjects/${id}`)
  },
}
