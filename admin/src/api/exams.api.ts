import { downloadFile } from './download'
import { deleteData, getData, getPage, http, sendData } from './http'
import type {
  ApiSuccess,
  BulkStatusResult,
  ExamAssetInfo,
  ExamCandidate,
  ExamCandidateBody,
  ExamClassOption,
  ExamParticipantsBody,
  ExamSection,
  ExamSectionsPreview,
  ExamSession,
  ExamSessionBody,
  ExamSessionItem,
  ExamSessionMeta,
  ExamSessionParticipant,
  ExamTemplate,
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
  QuestionStatus,
  QuestionPayload,
} from './types'

export interface SessionListParams {
  page?: number
  limit?: number
  status?: string
  type?: string
}
const SID = (id: string) => `/exams/sessions/${id}`

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
  bulkStatus: (body: {
    ids?: string[]
    topicId?: string
    fromStatus?: QuestionStatus
    toStatus: 'active' | 'draft' | 'archived'
  }) => sendData<BulkStatusResult>('post', '/exams/questions/bulk-status', body),
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
  importCommit: (
    id: string,
    body: { exclude: number[]; overrides: ExamImportOverride[]; status?: 'draft' | 'active' },
  ) => sendData<ExamImportResult>('post', `/exams/import/${id}/commit`, body),

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

  // ---- Shablonlar ----
  previewSections: (sections: ExamSection[]) =>
    sendData<ExamSectionsPreview>('post', '/exams/templates/preview', { sections }),
  listTemplates: () => getData<ExamTemplate[]>('/exams/templates'),
  createTemplate: (body: {
    title: string
    subjectId?: string | null
    sections: ExamSection[]
    shuffleQuestions: boolean
    shuffleOptions: boolean
  }) => sendData<ExamTemplate>('post', '/exams/templates', body),
  removeTemplate: (id: string) =>
    deleteData<{ id: string; deleted: boolean }>(`/exams/templates/${id}`),

  // ---- Imtihonlar (sessiyalar) ----
  sessionMeta: () => getData<ExamSessionMeta>('/exams/sessions/meta'),
  classOptions: (subjectId?: string) =>
    getData<ExamClassOption[]>('/exams/sessions/class-options', { subjectId }),
  classStudents: (classId: string) =>
    getData<{ id: string; fullName: string }[]>(`/exams/sessions/class-students/${classId}`),
  listSessions: (params: SessionListParams = {}): Promise<Paginated<ExamSessionItem>> =>
    getPage('/exams/sessions', params),
  getSession: (id: string) => getData<ExamSession>(SID(id)),
  createSession: (body: ExamSessionBody) => sendData<ExamSession>('post', '/exams/sessions', body),
  updateSession: (id: string, body: Partial<ExamSessionBody>) =>
    sendData<ExamSession>('patch', SID(id), body),
  removeSession: (id: string) => deleteData<{ id: string; deleted: boolean }>(SID(id)),
  addParticipants: (id: string, body: ExamParticipantsBody) =>
    sendData<{ added: number; skipped: number; total: number }>(
      'post',
      `${SID(id)}/participants`,
      body,
    ),
  removeParticipant: (id: string, key: string) =>
    deleteData<{ removed: boolean; total: number }>(`${SID(id)}/participants/${key}`),
  regeneratePin: (id: string, key: string) =>
    sendData<{ regenerated: boolean }>('post', `${SID(id)}/participants/${key}/regenerate-pin`),
  grantTime: (id: string, key: string, body: { fullTime?: boolean; extraMinutes?: number }) =>
    sendData<ExamSessionParticipant>('post', `${SID(id)}/participants/${key}/grant`, body),
  sessionAction: (id: string, action: 'submit' | 'approve' | 'open' | 'close') =>
    sendData<ExamSession>('post', `${SID(id)}/${action}`),
  rejectSession: (id: string, reason: string) =>
    sendData<ExamSession>('post', `${SID(id)}/reject`, { reason }),
  cancelSession: (id: string, reason?: string) =>
    sendData<ExamSession>('post', `${SID(id)}/cancel`, reason ? { reason } : {}),
  downloadPinSheet: (id: string, className?: string) =>
    downloadFile(`${SID(id)}/pin-sheet`, {
      params: className ? { class: className } : undefined,
      fallbackName: 'pin.pdf',
    }),

  // ---- Nomzodlar ----
  listCandidates: (
    params: { page?: number; limit?: number; q?: string } = {},
  ): Promise<Paginated<ExamCandidate>> => getPage('/exams/candidates', params),
  getCandidate: (id: string) => getData<ExamCandidate>(`/exams/candidates/${id}`),
  createCandidate: (body: ExamCandidateBody) =>
    sendData<ExamCandidate>('post', '/exams/candidates', body),
  updateCandidate: (id: string, body: Partial<ExamCandidateBody>) =>
    sendData<ExamCandidate>('patch', `/exams/candidates/${id}`, body),
  removeCandidate: (id: string) =>
    deleteData<{ id: string; deleted: boolean }>(`/exams/candidates/${id}`),
}
