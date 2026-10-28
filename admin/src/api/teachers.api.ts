import { downloadFile, parseFilename, saveBlob } from './download'
import { deleteData, getData, getPage, http, putPhoto, sendData } from './http'
import type {
  ApiSuccess,
  Paginated,
  Teacher,
  TeacherImportPreview,
  TeacherImportResult,
  TeacherImportResultRow,
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
  setPhoto: (id: string, file: File) => putPhoto<Teacher>(`/teachers/${id}/photo`, file),
  removePhoto: (id: string) => deleteData<Teacher>(`/teachers/${id}/photo`),
  setPermissions: (id: string, permissions: string[]) =>
    sendData<Teacher>('put', `/teachers/${id}/permissions`, { permissions }),
  setClasses: (id: string, classIds: string[]) =>
    sendData<Teacher>('put', `/teachers/${id}/classes`, { classIds }),
  resetPassword: (id: string, newPassword: string) =>
    sendData<unknown>('post', `/teachers/${id}/reset-password`, { newPassword }),

  // ---- Excel'dan ommaviy import ----
  downloadImportTemplate: () =>
    downloadFile('/teachers/import/template', { fallbackName: 'oqituvchilar-shablon.xlsx' }),

  async importPreview(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<TeacherImportPreview> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiSuccess<TeacherImportPreview>>(
      '/teachers/import/preview',
      form,
      {
        timeout: 120000,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      },
    )
    return res.data.data
  },

  /** Server faylni qayta tekshirib yaratadi (mijoz qiymatlariga ishonmaydi). */
  async importConfirm(file: File): Promise<TeacherImportResult> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiSuccess<TeacherImportResult>>('/teachers/import/confirm', form, {
      timeout: 300000,
    })
    return res.data.data
  },

  /** Login-parollar Excel'i (parollar serverda saqlanmaydi, faqat fayl yasaladi). */
  async downloadCredentials(rows: TeacherImportResultRow[]): Promise<string> {
    const res = await http.post<Blob>(
      '/teachers/import/credentials',
      {
        rows: rows.map((r) => ({
          fullName: r.fullName,
          phone: r.phone,
          login: r.login,
          password: r.password,
          status: r.status,
        })),
      },
      { responseType: 'blob' },
    )
    const name =
      parseFilename(res.headers['content-disposition'] as string | undefined) ??
      'login-parollar.xlsx'
    saveBlob(res.data, name)
    return name
  },
}
