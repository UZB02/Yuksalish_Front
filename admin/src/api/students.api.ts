import { downloadFile } from './download'
import { deleteData, getData, getPage, http, putPhoto, sendData } from './http'
import type {
  Paginated,
  ProfileExamResults,
  Student,
  StudentListParams,
  StudentPayload,
} from './types'

export const studentsApi = {
  list: (params: StudentListParams = {}): Promise<Paginated<Student>> =>
    getPage('/students', params),
  get: (id: string) => getData<Student>(`/students/${id}`),
  /** Yakunlangan imtihon natijalari (profil "Imtihonlar" bo'limi) */
  examResults: (id: string) => getData<ProfileExamResults>(`/students/${id}/exam-results`),
  create: (payload: StudentPayload) => sendData<Student>('post', '/students', payload),
  update: (id: string, payload: Partial<StudentPayload>) =>
    sendData<Student>('patch', `/students/${id}`, payload),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/students/${id}`)
  },
  setPhoto: (id: string, file: File) => putPhoto<Student>(`/students/${id}/photo`, file),
  removePhoto: (id: string) => deleteData<Student>(`/students/${id}/photo`),
  transfer: (id: string, classId: string) =>
    sendData<Student>('post', `/students/${id}/transfer`, { classId }),
  exportXlsx: (classId?: string) =>
    downloadFile('/students/export', {
      params: classId ? { classId } : undefined,
      fallbackName: 'oquvchilar.xlsx',
    }),
}
