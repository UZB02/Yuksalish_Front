import { getData, getPage, sendData } from './http'
import type {
  Paginated,
  School,
  SchoolListParams,
  SchoolPayload,
  SchoolUpdatePayload,
} from './types'

export const schoolsApi = {
  list: (params: SchoolListParams = {}): Promise<Paginated<School>> => getPage('/schools', params),
  get: (id: string) => getData<School>(`/schools/${id}`),
  create: (payload: SchoolPayload) => sendData<School>('post', '/schools', payload),
  update: (id: string, payload: SchoolUpdatePayload) =>
    sendData<School>('patch', `/schools/${id}`, payload),
}
