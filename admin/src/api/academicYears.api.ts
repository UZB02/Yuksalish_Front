import { getPage, http, sendData } from './http'
import type { AcademicYear, AcademicYearPayload, PageParams, Paginated } from './types'

export const academicYearsApi = {
  list: (params: PageParams = {}): Promise<Paginated<AcademicYear>> =>
    getPage('/academic-years', { limit: 100, ...params }),
  create: (payload: AcademicYearPayload) =>
    sendData<AcademicYear>('post', '/academic-years', payload),
  update: (id: string, payload: Partial<AcademicYearPayload>) =>
    sendData<AcademicYear>('patch', `/academic-years/${id}`, payload),
  activate: (id: string) => sendData<AcademicYear>('post', `/academic-years/${id}/activate`),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/academic-years/${id}`)
  },
}
