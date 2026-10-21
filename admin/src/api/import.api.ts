import { downloadFile } from './download'
import { http, sendData } from './http'
import type { ApiSuccess, DuplicateMode, ImportPreview, ImportResult } from './types'

export const importApi = {
  downloadTemplate: () =>
    downloadFile('/students/import/template', { fallbackName: 'oquvchilar-shablon.xlsx' }),

  async preview(
    file: File,
    classId?: string,
    onProgress?: (percent: number) => void,
  ): Promise<ImportPreview> {
    const form = new FormData()
    form.append('file', file)
    if (classId) form.append('classId', classId)
    const res = await http.post<ApiSuccess<ImportPreview>>('/students/import/preview', form, {
      timeout: 120000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    return res.data.data
  },

  confirm: (importId: string, onDuplicate: DuplicateMode) =>
    sendData<ImportResult>('post', '/students/import/confirm', { importId, onDuplicate }),

  downloadErrors: (importId: string) =>
    downloadFile(`/students/import/${importId}/errors`, { fallbackName: 'xato-qatorlar.xlsx' }),
}
