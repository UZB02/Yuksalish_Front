import { downloadFile } from './download'
import { getData, getPage, http, sendData } from './http'
import type { Paginated, Student, StudentListParams, StudentPayload } from './types'

export const studentsApi = {
  list: (params: StudentListParams = {}): Promise<Paginated<Student>> =>
    getPage('/students', params),
  get: (id: string) => getData<Student>(`/students/${id}`),
  create: (payload: StudentPayload) => sendData<Student>('post', '/students', payload),
  update: (id: string, payload: Partial<StudentPayload>) =>
    sendData<Student>('patch', `/students/${id}`, payload),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/students/${id}`)
  },
  transfer: (id: string, classId: string) =>
    sendData<Student>('post', `/students/${id}/transfer`, { classId }),
  exportXlsx: (classId?: string) =>
    downloadFile('/students/export', {
      params: classId ? { classId } : undefined,
      fallbackName: 'oquvchilar.xlsx',
    }),
}
