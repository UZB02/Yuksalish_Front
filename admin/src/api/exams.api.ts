import { downloadFile } from './download'
import { deleteData, getData, getPage, http, sendData } from './http'
import type {
  ApiSuccess,
  BulkStatusResult,
  ExamAssetInfo,
  ExamAnalysis,
  ExamAttemptsResponse,
  ExamLiveRaw,
  RandomAvailability,
  RandomPreview,
  RandomQuestion,
  RandomSel,
  ExamLiveResponse,
  ExamLiveRosterEntry,
  ExamResultDetail,
  ExamResultsResponse,
  ExamCandidate,
  ExamCandidateBody,
  ExamClassOption,
  ExamParticipantsBody,
  ExamSection,
  ExamSectionsPreview,
  ExamBlockInput,
  FileKeyParse,
  FileTestFileInfo,
  FileTestSaveBody,
  FileTestView,
  ExamCopyResult,
  ExamDeleteMode,
  ExamResultListItem,
  BlockCounts,
  BlockQuestionList,
  MyBlockDetail,
  MyBlockItem,
  PasteCommitBody,
  ProfileExamResults,
  RemindResult,
  PasteCommitResult,
  PastePreview,
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

/** Jonli ekran: ixcham javobni to'liq qatorlarga yoyadi (ro'yxat kechi mijozda saqlanadi, faqat o'zgarganda qayta yuklanadi) */
const liveRoster = new Map<string, { key: string; roster: ExamLiveRosterEntry[] }>()
export function expandLive(raw: ExamLiveRaw, roster: ExamLiveRosterEntry[]): ExamLiveResponse {
  const byKey = new Map(roster.map((p) => [p.key, p]))
  const { rows, roster: _r, rosterKey: _k, ...rest } = raw
  return {
    ...rest,
    items: rows.map((r) => {
      const p = byKey.get(r.key)
      return {
        kind: 'student',
        fullName: '',
        className: null,
        answered: 0,
        total: 0,
        block: null,
        startedAt: null,
        submittedAt: null,
        deadline: null,
        lastSeenAt: null,
        leaves: 0,
        leaveDetail: { blur: 0, fullscreen: 0, hidden: 0 },
        lastLeaveAt: null,
        reconnects: 0,
        warningsSent: 0,
        warningsPending: 0,
        lastWarnAt: null,
        terminated: null,
        fullTimeGranted: false,
        extraMinutes: 0,
        allowReentry: false,
        ...p,
        ...r,
      } as ExamLiveResponse['items'][number]
    }),
  }
}
async function fetchLive(id: string): Promise<ExamLiveResponse> {
  const known = liveRoster.get(id)
  let raw = await getData<ExamLiveRaw>(
    `/exams/sessions/${id}/live`,
    known ? { roster: known.key } : undefined,
  )
  if (!raw.roster && !known) {
    // kalit yuborilmagan bo'lsa server ro'yxatni doim yuboradi; shunga qaramay yo'q bo'lsa qayta so'raymiz
    raw = await getData<ExamLiveRaw>(`/exams/sessions/${id}/live`)
  }
  if (raw.roster) liveRoster.set(id, { key: raw.rosterKey, roster: raw.roster })
  return expandLive(raw, liveRoster.get(id)?.roster ?? [])
}

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
  /** Fan va sinflar bo'yicha shu fanni o'qitadigan o'qituvchilar (avtomatik taklif) */
  suggestTeachers: (subjectId: string, classIds: string[]) =>
    getData<{ teacherIds: string[] }>('/exams/sessions/suggest-teachers', {
      subjectId,
      classIds: classIds.join(','),
    }),
  /** "Tayyor" belgisi (o'qituvchi yoki tuzuvchi) */
  markBlockReady: (sessionId: string, blockId: string, ready: boolean) =>
    sendData<{ blockId: string; status: 'open' | 'ready' }>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/ready`,
      { ready },
    ),
  myBlocksSummary: () => getData<{ pending: number; total: number }>('/exams/my-blocks/summary'),
  previewBlocks: (blocks: ExamBlockInput[]) =>
    sendData<ExamSectionsPreview>('post', '/exams/templates/preview', { blocks }),
  listTemplates: () => getData<ExamTemplate[]>('/exams/templates'),
  createTemplate: (body: {
    title: string
    subjectId?: string | null
    sections?: ExamSection[]
    blocks?: ExamBlockInput[]
    scoringMode?: 'points' | 'coefficient'
    timingMode?: 'common' | 'per_block'
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
  /** Urinishli imtihon: mode majburiy; with_results uchun confirmTitle = imtihon nomi */
  async deleteSession(id: string, body: { mode?: ExamDeleteMode; confirmTitle?: string } = {}) {
    const res = await http.delete<ApiSuccess<{ id: string; deleted: boolean; mode: string }>>(
      SID(id),
      { data: body },
    )
    return res.data.data
  },
  copySession: (id: string) => sendData<ExamCopyResult>('post', `${SID(id)}/copy`),
  returnToDraft: (id: string) => sendData<ExamSession>('post', `${SID(id)}/return-to-draft`),
  listResults: (
    params: {
      page?: number
      limit?: number
      q?: string
      from?: string
      to?: string
      subjectId?: string
      classId?: string
    } = {},
  ): Promise<Paginated<ExamResultListItem>> => getPage('/exams/results', params),
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
  /** Rejalashtirish; maqsaddan kam savol bo'lsa 409, confirmShort bilan tasdiqlanadi */
  submitSession: (id: string, confirmShort = false) =>
    sendData<ExamSession>('post', `${SID(id)}/submit`, confirmShort ? { confirmShort: true } : {}),
  // ---- Bloklar: tuzuvchi ----
  composerBlockQuestions: (id: string, blockId: string) =>
    getData<BlockQuestionList>(`${SID(id)}/blocks/${blockId}/questions`),
  composerRemoveBlockQuestion: (id: string, blockId: string, qid: string) =>
    deleteData<BlockCounts & { removed: boolean }>(`${SID(id)}/blocks/${blockId}/questions/${qid}`),
  setBlockReady: (id: string, blockId: string, ready: boolean) =>
    sendData<{ blockId: string; status: 'open' | 'ready' }>(
      'post',
      `${SID(id)}/blocks/${blockId}/ready`,
      { ready },
    ),
  remindSession: (id: string) => sendData<RemindResult>('post', `${SID(id)}/remind`),
  // ---- Bloklar: biriktirilgan o'qituvchi ----
  myBlocks: () => getData<MyBlockItem[]>('/exams/my-blocks'),
  myBlock: (sessionId: string, blockId: string) =>
    getData<MyBlockDetail>(`/exams/my-blocks/${sessionId}/${blockId}`),
  addToBlock: (sessionId: string, blockId: string, questionIds: string[]) =>
    sendData<BlockCounts & { added: number; skipped: number }>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/questions`,
      { questionIds },
    ),
  createInBlock: (sessionId: string, blockId: string, payload: Record<string, unknown>) =>
    sendData<BlockCounts & { question: { id: string } }>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/questions/new`,
      payload,
    ),
  // ---- Fayl + kalit bloki (§22) ----
  fileTest: (sessionId: string, blockId: string) =>
    getData<FileTestView>(`/exams/my-blocks/${sessionId}/${blockId}/file-test`),
  saveFileTest: (sessionId: string, blockId: string, body: FileTestSaveBody) =>
    sendData<FileTestView>('put', `/exams/my-blocks/${sessionId}/${blockId}/file-test`, body),
  parseFileKey: (
    sessionId: string,
    blockId: string,
    body: { text: string; options?: number; points?: number },
  ) =>
    sendData<FileKeyParse>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/file-test/key/parse`,
      body,
    ),
  async uploadTestFile(
    sessionId: string,
    blockId: string,
    file: File,
  ): Promise<{ file: FileTestFileInfo }> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiSuccess<{ file: FileTestFileInfo }>>(
      `/exams/my-blocks/${sessionId}/${blockId}/files`,
      form,
      { timeout: 120000 },
    )
    return res.data.data
  },
  /** Fayl token talab qiladi (<img src>/pdfjs bevosita ocholmaydi): blob sifatida olinadi */
  async fetchTestFile(sessionId: string, blockId: string, fileId: string): Promise<Blob> {
    const res = await http.get<Blob>(`/exams/my-blocks/${sessionId}/${blockId}/files/${fileId}`, {
      responseType: 'blob',
      timeout: 120000,
    })
    return res.data
  },
  // ---- Daraja bo'yicha tasodifiy tanlash (E8) ----
  randomAvailability: (sessionId: string, blockId: string, sel: RandomSel) =>
    sendData<RandomAvailability>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/random/availability`,
      sel,
    ),
  randomPreview: (
    sessionId: string,
    blockId: string,
    body: RandomSel & { counts: { easy: number; medium: number; hard: number } },
  ) =>
    sendData<RandomPreview>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/random/preview`,
      body,
    ),
  randomReplace: (
    sessionId: string,
    blockId: string,
    body: RandomSel & { difficulty: number; exclude: string[] },
  ) =>
    sendData<{ item: RandomQuestion; remaining: number }>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/random/replace`,
      body,
    ),
  addBlockRule: (
    sessionId: string,
    blockId: string,
    body: RandomSel & { difficulty: number; count: number },
  ) =>
    sendData<{ ruleId: string; poolSize: number; enough: boolean }>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/rules`,
      body,
    ),
  updateBlockRule: (sessionId: string, blockId: string, ruleId: string, count: number) =>
    sendData<{ ruleId: string; count: number }>(
      'patch',
      `/exams/my-blocks/${sessionId}/${blockId}/rules/${ruleId}`,
      { count },
    ),
  removeBlockRule: (sessionId: string, blockId: string, ruleId: string) =>
    deleteData<{ removed: boolean }>(`/exams/my-blocks/${sessionId}/${blockId}/rules/${ruleId}`),
  composerRemoveRule: (id: string, blockId: string, ruleId: string) =>
    deleteData<{ removed: boolean }>(`${SID(id)}/blocks/${blockId}/rules/${ruleId}`),
  removeFromBlock: (sessionId: string, blockId: string, qid: string) =>
    deleteData<BlockCounts & { removed: boolean }>(
      `/exams/my-blocks/${sessionId}/${blockId}/questions/${qid}`,
    ),
  async blockImportPreview(
    sessionId: string,
    blockId: string,
    kind: 'excel' | 'word',
    file: File,
  ): Promise<ExamImportPreview> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiSuccess<ExamImportPreview>>(
      `/exams/my-blocks/${sessionId}/${blockId}/import/${kind}`,
      form,
      { timeout: 120000 },
    )
    return res.data.data
  },
  blockImportCommit: (
    sessionId: string,
    blockId: string,
    importId: string,
    body: { exclude: number[]; overrides: ExamImportOverride[] },
  ) =>
    sendData<ExamImportResult & BlockCounts & { addedToBlock: number }>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/import/${importId}/commit`,
      body,
    ),
  // ---- "Matnni joylash" (vazifa ichida va savollar bankida) ----
  blockPastePreview: (sessionId: string, blockId: string, text: string) =>
    sendData<PastePreview>('post', `/exams/my-blocks/${sessionId}/${blockId}/paste/preview`, {
      text,
    }),
  blockPasteCommit: (sessionId: string, blockId: string, body: PasteCommitBody) =>
    sendData<PasteCommitResult>(
      'post',
      `/exams/my-blocks/${sessionId}/${blockId}/paste/commit`,
      body,
    ),
  pastePreview: (text: string) =>
    sendData<PastePreview>('post', '/exams/questions/paste/preview', { text }),
  pasteCommit: (body: PasteCommitBody) =>
    sendData<PasteCommitResult>('post', '/exams/questions/paste/commit', body),
  rejectSession: (id: string, reason: string) =>
    sendData<ExamSession>('post', `${SID(id)}/reject`, { reason }),
  cancelSession: (id: string, reason?: string) =>
    sendData<ExamSession>('post', `${SID(id)}/cancel`, reason ? { reason } : {}),
  reopenSession: (id: string, body: { reason: string; newEnd: string }) =>
    sendData<ExamSession & { codeChanged: boolean }>('post', `${SID(id)}/reopen`, body),
  extendSession: (id: string, body: { minutes: number; reason?: string }) =>
    sendData<ExamSession>('post', `${SID(id)}/extend`, body),
  sessionResults: (id: string) => getData<ExamResultsResponse>(`${SID(id)}/results`),
  resultDetail: (id: string, key: string) => getData<ExamResultDetail>(`${SID(id)}/results/${key}`),
  gradeEssay: (id: string, key: string, qid: string, body: { points: number; comment: string }) =>
    sendData<{ earned: number; max: number; essayPending: number }>(
      'put',
      `${SID(id)}/results/${key}/essays/${qid}`,
      body,
    ),
  publishResults: (id: string, body: { published: boolean; confirmPending?: boolean }) =>
    sendData<{ published: boolean; publishedAt: string | null }>(
      'post',
      `${SID(id)}/results/publish`,
      body,
    ),
  resultsAnalysis: (id: string) => getData<ExamAnalysis>(`${SID(id)}/results/analysis`),
  downloadResults: (id: string, format: 'xlsx' | 'pdf') =>
    downloadFile(`${SID(id)}/results/export`, {
      params: { format },
      fallbackName: `natijalar.${format}`,
    }),
  /** Nazoratchi jonli ekrani: har 5 s da so'raladi (yengil: savol matni va javoblar yo'q) */
  sessionLive: (id: string) => fetchLive(id),
  warnParticipant: (id: string, key: string, text: string) =>
    sendData<{ warningId: string; sentAt: string }>('post', `${SID(id)}/participants/${key}/warn`, {
      text,
    }),
  terminateParticipant: (id: string, key: string, reason: string) =>
    sendData<{ terminated: boolean; score: { earned: number; max: number } }>(
      'post',
      `${SID(id)}/participants/${key}/terminate`,
      { reason },
    ),
  sessionAttempts: (id: string) => getData<ExamAttemptsResponse>(`${SID(id)}/attempts`),
  allowReentry: (id: string, key: string) =>
    sendData<{ allowReentry: boolean }>('post', `${SID(id)}/participants/${key}/allow-reentry`),
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
  candidateResults: (id: string) => getData<ProfileExamResults>(`/exams/candidates/${id}/results`),
  /** Ishtirokchining shaxsiy kirish kodi (ro'yxatda chiqmaydi; faqat shu endpoint, audit bilan) */
  participantCode: (sessionId: string, key: string) =>
    getData<{ code: string | null }>(`${SID(sessionId)}/participants/${key}/code`),
  createCandidate: (body: ExamCandidateBody) =>
    sendData<ExamCandidate>('post', '/exams/candidates', body),
  updateCandidate: (id: string, body: Partial<ExamCandidateBody>) =>
    sendData<ExamCandidate>('patch', `/exams/candidates/${id}`, body),
  removeCandidate: (id: string) =>
    deleteData<{ id: string; deleted: boolean }>(`/exams/candidates/${id}`),
}
