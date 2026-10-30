import { deleteData, getData, getPage, postFile, sendData } from './http'
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
  uploadLogo: (id: string, file: File) => postFile<School>(`/schools/${id}/logo`, file),
  deleteLogo: (id: string) => deleteData<School>(`/schools/${id}/logo`),
}
