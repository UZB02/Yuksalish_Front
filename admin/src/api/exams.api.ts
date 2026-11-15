import { downloadFile } from './download'
import { deleteData, getData, getPage, http, sendData } from './http'
import type {
  ApiSuccess,
  ExamAssetInfo,
  ExamSubjectsResponse,
  ExamTopic,
  ExamTopicsResponse,
  ExamImportOverride,
  ExamImportPreview,
  ExamImportResult,
  ShareTeacher,
  Paginated,
  Question,
  QuestionListItem,
  QuestionListParams,
  QuestionPayload,
} from './types'

export const examsApi = {
  subjects: () => getData<ExamSubjectsResponse>('/exams/subjects'),
  /** Ulashish uchun o'qituvchilar (fanni o'qitadiganlar birinchi) */
  teachers: (subjectId?: string) => getData<ShareTeacher[]>('/exams/teachers', { subjectId }),

  // ---- Mavzular ----
  listTopics: (subjectId: string) =>
    getData<ExamTopicsResponse>(`/exams/subjects/${subjectId}/topics`),
  getTopic: (id: string) => getData<ExamTopic>(`/exams/topics/${id}`),
  createTopic: (subjectId: string, body: { name: string; description?: string }) =>
    sendData<ExamTopic>('post', `/exams/subjects/${subjectId}/topics`, body),
  updateTopic: (id: string, body: { name?: string; description?: string }) =>
    sendData<ExamTopic>('patch', `/exams/topics/${id}`, body),
  removeTopic: (id: string) => deleteData<{ id: string; deleted: boolean }>(`/exams/topics/${id}`),
  reorderTopics: (subjectId: string, ids: string[]) =>
    sendData<ExamTopicsResponse>('post', '/exams/topics/reorder', { subjectId, ids }),

  // ---- Savollar ----
  listQuestions: (params: QuestionListParams = {}): Promise<Paginated<QuestionListItem>> =>
    getPage('/exams/questions', params),
  getQuestion: (id: string) => getData<Question>(`/exams/questions/${id}`),
  createQuestion: (payload: QuestionPayload) =>
    sendData<Question>('post', '/exams/questions', payload),
  updateQuestion: (id: string, payload: Partial<QuestionPayload>) =>
    sendData<Question>('patch', `/exams/questions/${id}`, payload),
  archiveQuestion: (id: string) => sendData<Question>('post', `/exams/questions/${id}/archive`),
  restoreQuestion: (id: string) => sendData<Question>('post', `/exams/questions/${id}/restore`),
  duplicateQuestion: (id: string) => sendData<Question>('post', `/exams/questions/${id}/duplicate`),
  removeQuestion: (id: string) =>
    deleteData<{ id: string; deleted: boolean }>(`/exams/questions/${id}`),

  // ---- Import ----
  downloadTemplate: (kind: 'excel' | 'word') =>
    downloadFile(`/exams/import/template/${kind}`, {
      fallbackName: kind === 'excel' ? 'savollar-shablon.xlsx' : 'savollar-shablon.docx',
    }),
  async importPreview(
    kind: 'excel' | 'word',
    file: File,
    topicId: string,
  ): Promise<ExamImportPreview> {
    const form = new FormData()
    form.append('topicId', topicId)
    form.append('file', file)
    const res = await http.post<ApiSuccess<ExamImportPreview>>(`/exams/import/${kind}`, form, {
      timeout: 120000,
    })
    return res.data.data
  },
  importCommit: (id: string, body: { exclude: number[]; overrides: ExamImportOverride[] }) =>
    sendData<ExamImportResult>('post', `/exams/import/${id}/commit`, body),

  // ---- Rasmlar ----
  async uploadAsset(file: File): Promise<ExamAssetInfo> {
    const form = new FormData()
    form.append('image', file)
    const res = await http.post<ApiSuccess<ExamAssetInfo>>('/exams/assets', form, {
      timeout: 60000,
    })
    return res.data.data
  },
  /** Rasm autentifikatsiya talab qiladi (<img src> orqali bo'lmaydi): blob sifatida olinadi. */
  async fetchAssetBlob(id: string): Promise<Blob> {
    const res = await http.get<Blob>(`/exams/assets/${id}`, { responseType: 'blob' })
    return res.data
  },
}
