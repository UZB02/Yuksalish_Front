import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type {
  ExamResultDetail,
  ExamResultListItem,
  ExamResultsResponse,
  ExamSession,
  ExamSessionMeta,
  MyBlockDetail,
  User,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { parseDraft, WIZARD_DRAFT_VERSION } from '@/utils/examWizardDraft'

const api = {
  sessionMeta: vi.fn(),
  subjects: vi.fn(),
  listTopics: vi.fn(),
  listTemplates: vi.fn(),
  classOptions: vi.fn(),
  previewSections: vi.fn(),
  previewBlocks: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSession: vi.fn(),
  submitSession: vi.fn(),
  sessionAction: vi.fn(),
  sessionAttempts: vi.fn(),
  listSessions: vi.fn(),
  myBlocks: vi.fn(),
  myBlock: vi.fn(),
  addToBlock: vi.fn(),
  removeFromBlock: vi.fn(),
  composerBlockQuestions: vi.fn(),
  composerRemoveBlockQuestion: vi.fn(),
  setBlockReady: vi.fn(),
  listQuestions: vi.fn(),
  sessionResults: vi.fn(),
  resultDetail: vi.fn(),
  resultsAnalysis: vi.fn(),
  gradeEssay: vi.fn(),
  publishResults: vi.fn(),
  downloadResults: vi.fn(),
  fetchAssetBlob: vi.fn(),
  listResults: vi.fn(),
  deleteSession: vi.fn(),
  removeSession: vi.fn(),
  copySession: vi.fn(),
  returnToDraft: vi.fn(),
  classOptions2: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import ExamResultsListView from './ExamResultsListView.vue'
import ExamResultsView from './ExamResultsView.vue'
import MyBlockView from './MyBlockView.vue'
import SessionDetailView from './SessionDetailView.vue'
import SessionWizardView from './SessionWizardView.vue'
import SessionsView from './SessionsView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
})

async function mountView(
  comp: unknown,
  path: string,
  routePath: string,
  role: 'teacher' | 'school_admin' = 'school_admin',
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('t', {
    id: 'u1',
    role,
    schoolId: 's1',
    permissions: [],
  } as unknown as User)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, name: 'cur', component: comp as never },
      { path: '/exams/sessions', name: 'exam-sessions', component: empty },
      { path: '/exams/sessions/new', name: 'exam-session-new', component: empty },
      { path: '/exams/sessions/:id', name: 'exam-session', component: empty },
      { path: '/exams/sessions/:id/edit', name: 'exam-session-edit', component: empty },
      { path: '/exams/sessions/:id/results', name: 'exam-session-results', component: empty },
      { path: '/exams/results', name: 'exam-results-list', component: empty },
      { path: '/exams/blocks/:sessionId/:blockId', name: 'exam-my-block', component: empty },
      { path: '/exams/questions/new', name: 'exam-question-create', component: empty },
      { path: '/exams/questions/import', name: 'exam-question-import', component: empty },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    { global: { plugins: [pinia, i18n, router] }, attachTo: document.body },
  )
  mounted.push(w)
  await flushPromises()
  return { w, router }
}

const adminMeta = (): ExamSessionMeta => ({
  pinSecretConfigured: true,
  isAdministration: true,
  teachersCanCreateQuizzes: true,
  teacherQuizNeedsApproval: false,
  allowedTypes: ['quiz', 'quarter'],
  supervisors: [],
  contributors: [
    { id: 'tm', fullName: 'Matematik Ustoz', role: 'teacher', subjectIds: ['math'] },
    { id: 'tl', fullName: 'Ona tili Ustoz', role: 'teacher', subjectIds: ['lang'] },
    { id: 'sa', fullName: 'Maktab Admini', role: 'school_admin', subjectIds: null },
  ],
})

const baseSession = (over: Partial<ExamSession> = {}): ExamSession =>
  ({
    id: 'e1',
    title: 'DTM sinov',
    type: 'quarter',
    status: 'draft',
    phase: null,
    subjectId: null,
    subjectName: null,
    classes: [{ id: 'c1', name: '7-A' }],
    scheduledStart: '2026-12-01T05:00:00.000Z',
    durationMin: 50,
    endsAt: '2026-12-01T05:50:00.000Z',
    code: null,
    resultsMode: 'score',
    shuffleQuestions: true,
    shuffleOptions: true,
    participantsCount: 0,
    supervisors: [],
    approval: { status: 'none', reason: '', at: null },
    pool: { frozen: false, frozenAt: null },
    createdBy: 'u1',
    createdByName: 'Admin',
    isMine: true,
    cancelReason: '',
    createdAt: '2026-11-01T00:00:00.000Z',
    canEdit: true,
    canSubmit: true,
    canApprove: false,
    canManageParticipants: true,
    canGrant: false,
    canOpen: false,
    canClose: false,
    canCancel: true,
    canPrint: false,
    canDelete: true,
    canReopen: false,
    canExtend: false,
    canViewResults: false,
    timeUp: false,
    passPercent: null,
    resultsPublished: false,
    templateId: null,
    sections: [],
    scoringMode: 'coefficient',
    timingMode: 'per_block',
    contribDeadline: '2026-11-30T05:00:00.000Z',
    blocksCount: 2,
    blocks: [
      {
        id: 'b1',
        legacy: false,
        subjectId: 'math',
        subjectName: 'Matematika',
        title: 'Matematika',
        targetCount: 30,
        coefficient: 3.1,
        durationMin: 30,
        status: 'open',
        count: 12,
        contributors: [{ id: 'tm', fullName: 'Matematik Ustoz' }],
        items: [],
        contribQuestions: [
          { questionId: 'q1', addedBy: 'tm', addedByName: 'Matematik Ustoz', addedAt: null },
        ],
      },
      {
        id: 'b2',
        legacy: false,
        subjectId: 'lang',
        subjectName: 'Ona tili',
        title: 'Ona tili',
        targetCount: 20,
        coefficient: 2.1,
        durationMin: 20,
        status: 'ready',
        count: 20,
        contributors: [],
        items: [],
        contribQuestions: [],
      },
    ],
    participants: [],
    ...over,
  }) as ExamSession

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.clearAllMocks()
  api.sessionMeta.mockResolvedValue(adminMeta())
  api.subjects.mockResolvedValue({
    scope: 'all',
    subjects: [
      { id: 'math', name: 'Matematika' },
      { id: 'lang', name: 'Ona tili' },
    ],
  })
  api.listTopics.mockResolvedValue({ subject: {}, topics: [] })
  api.listTemplates.mockResolvedValue([])
  api.classOptions.mockResolvedValue([{ id: 'c1', name: '7-A', grade: 7, studentsCount: 25 }])
  api.myBlocks.mockResolvedValue([])
  api.listSessions.mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } })
  api.sessionAttempts.mockResolvedValue({
    items: [],
    joinAlert: { failures: 0, lastAt: null, alertAt: null },
  })
  api.previewBlocks.mockImplementation(async (blocks: { targetCount: number }[]) => ({
    sections: [],
    blocks: blocks.map((b) => ({
      title: '',
      items: [],
      count: b.targetCount,
      target: b.targetCount,
      ok: true,
    })),
    errors: [],
    poolSize: 10,
    questionsPerParticipant: 10,
    ok: true,
  }))
})

describe('mahalliy qoralama: versiya 2 (bloklar)', () => {
  const valid = {
    v: WIZARD_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    step: 1,
    form: {
      type: 'quarter',
      title: 'X',
      subjectId: '',
      classIds: [],
      templateId: '',
      mode: 'blocks',
      sections: [],
      blocks: [
        {
          subjectId: 'math',
          targetCount: 10,
          coefficient: 3.1,
          contributorIds: ['tm'],
          items: [{ kind: 'manual', questionIds: ['q1'] }],
        },
      ],
      scoringMode: 'coefficient',
      timingMode: 'per_block',
      contribDeadline: '',
      start: '2099-01-01T10:00',
      durationMin: '45',
      shuffleQuestions: true,
      shuffleOptions: true,
      resultsMode: 'score',
      passPercent: '',
      supervisorIds: [],
    },
  }
  it('versiya 2 qabul qilinadi; eski versiya (1) va noto`g`ri bloklar jimgina tashlanadi', () => {
    expect(WIZARD_DRAFT_VERSION).toBe(2)
    expect(parseDraft(JSON.stringify(valid))).not.toBeNull()
    expect(parseDraft(JSON.stringify({ ...valid, v: 1 }))).toBeNull()
    const noBlocks = { ...valid, form: { ...valid.form } } as Record<string, unknown>
    delete (noBlocks.form as Record<string, unknown>).blocks
    expect(parseDraft(JSON.stringify(noBlocks))).toBeNull()
    expect(
      parseDraft(JSON.stringify({ ...valid, form: { ...valid.form, timingMode: 'weekly' } })),
    ).toBeNull()
    expect(
      parseDraft(
        JSON.stringify({
          ...valid,
          form: { ...valid.form, blocks: [{ subjectId: 'm', targetCount: 'x' }] },
        }),
      ),
    ).toBeNull()
  })
})

describe('Usta: "Bloklar" qadami (ma`muriyat)', () => {
  it('blok qo`shish: fan, maqsad, koeffitsiyent (faqat koeffitsiyent rejimida), davomiylik (faqat blokma-blok), o`qituvchilar fanga qarab; yuborishda blok tuzilmasi', async () => {
    api.createSession.mockResolvedValue(baseSession())
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new', '/exams/sessions/new')
    // 1-qadam: nom (blok rejimida fan tanlovi yo'q)
    expect(w.find('[data-testid="wz-subject"]').exists()).toBe(false)
    await w.get('[data-testid="wz-title"]').setValue('DTM sinov')
    await w.get('[data-testid="wz-class-c1"] input').setValue(true)
    await w.get('[data-testid="wz-next"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="blocks-editor"]').exists()).toBe(true)
    // boshlang'ich: bitta bo'sh blok; koeffitsiyent/davomiylik maydonlari yo'q (ball rejimi, umumiy vaqt)
    expect(w.find('[data-testid="block-0"]').exists()).toBe(true)
    expect(w.find('[data-testid="block-coef-0"]').exists()).toBe(false)
    expect(w.find('[data-testid="block-duration-0"]').exists()).toBe(false)
    // rejimlar
    await w.get('[data-testid="wz-scoring"]').setValue('coefficient')
    await w.get('[data-testid="wz-timing"]').setValue('per_block')
    await flushPromises()
    expect(w.find('[data-testid="block-coef-0"]').exists()).toBe(true)
    expect(w.find('[data-testid="block-duration-0"]').exists()).toBe(true)
    // fan tanlanguncha o'qituvchilar ko'rsatilmaydi
    expect(w.find('[data-testid="block-contrib-0-tm"]').exists()).toBe(false)
    await w.get('[data-testid="block-subject-0"]').setValue('math')
    await flushPromises()
    // faqat matematika o'qituvchisi va maktab admini (istalgan fan)
    expect(w.find('[data-testid="block-contrib-0-tm"]').exists()).toBe(true)
    expect(w.find('[data-testid="block-contrib-0-tl"]').exists()).toBe(false)
    expect(w.find('[data-testid="block-contrib-0-sa"]').exists()).toBe(true)
    await w.get('[data-testid="block-contrib-0-tm"] input').setValue(true)
    await w.get('[data-testid="block-target-0"]').setValue('30')
    await w.get('[data-testid="block-coef-0"]').setValue('3.1')
    await w.get('[data-testid="block-duration-0"]').setValue('30')
    // 2-blok
    await w.get('[data-testid="add-block"]').trigger('click')
    await w.get('[data-testid="block-subject-1"]').setValue('lang')
    await w.get('[data-testid="block-target-1"]').setValue('20')
    await w.get('[data-testid="block-coef-1"]').setValue('2.1')
    await w.get('[data-testid="block-duration-1"]').setValue('20')
    await w.get('[data-testid="block-contrib-1-tl"] input').setValue(true)
    expect(w.find('[data-testid="block-contrib-1-tm"]').exists()).toBe(false)
    await sleep(450) // preview debounce
    await flushPromises()
    expect(api.previewBlocks).toHaveBeenCalled()
    expect(w.get('[data-testid="block-progress-0"]').text()).toContain('30/30')
    await w.get('[data-testid="wz-next"]').trigger('click')
    await flushPromises()
    // 3-qadam (vaqt): davomiylik yig'indisi, muddat maydoni (o'qituvchi biriktirilgani uchun)
    expect(w.find('[data-testid="wz-duration"]').exists()).toBe(false)
    expect(w.get('[data-testid="wz-duration-total"]').text()).toContain('50')
    expect(w.find('[data-testid="wz-contrib-deadline"]').exists()).toBe(true)
    await w.get('[data-testid="wz-start"]').setValue('2099-01-02T09:00')
    await w.get('[data-testid="wz-contrib-deadline"]').setValue('2099-01-03T09:00')
    // muddat boshlanishdan keyin: xato
    await w.get('[data-testid="wz-next"]').trigger('click')
    await flushPromises()
    expect(api.createSession).not.toHaveBeenCalled()
    await w.get('[data-testid="wz-contrib-deadline"]').setValue('2099-01-01T09:00')
    await w.get('[data-testid="wz-next"]').trigger('click')
    await flushPromises()
    expect(api.createSession).toHaveBeenCalledTimes(1)
    const body = api.createSession.mock.calls[0]![0]
    expect(body).toMatchObject({
      title: 'DTM sinov',
      scoringMode: 'coefficient',
      timingMode: 'per_block',
    })
    expect(body.durationMin).toBeUndefined()
    expect(body.sections).toBeUndefined()
    expect(body.contribDeadline).toMatch(/^2099-01-01T/)
    expect(body.blocks).toEqual([
      expect.objectContaining({
        subjectId: 'math',
        targetCount: 30,
        coefficient: 3.1,
        durationMin: 30,
        contributorIds: ['tm'],
      }),
      expect.objectContaining({
        subjectId: 'lang',
        targetCount: 20,
        coefficient: 2.1,
        durationMin: 20,
        contributorIds: ['tl'],
      }),
    ])
  })

  it('tekshiruv: fansiz blok, bo`sh blok (o`qituvchisiz) va blokma-blokda davomiylik yo`q bo`lsa keyingi qadamga o`tilmaydi', async () => {
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new', '/exams/sessions/new')
    await w.get('[data-testid="wz-title"]').setValue('X')
    await w.get('[data-testid="wz-next"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="wz-next"]').trigger('click') // fan tanlanmagan
    await flushPromises()
    expect(w.find('[data-testid="err-sections"]').exists()).toBe(true)
    expect(w.find('[data-testid="step-time"]').exists()).toBe(false)
    await w.get('[data-testid="block-subject-0"]').setValue('math')
    await w.get('[data-testid="wz-next"]').trigger('click') // elementlar ham o'qituvchi ham yo'q
    await flushPromises()
    expect(w.find('[data-testid="err-sections"]').exists()).toBe(true)
  })
})

describe('Imtihon sahifasi: bloklar paneli va rejalashtirish', () => {
  it('blok progressi (N/maqsad), o`qituvchilar, koeffitsiyent, davomiylik, tayyor holati va rejimlar ko`rinadi', async () => {
    api.getSession.mockResolvedValue(baseSession())
    api.sessionAction.mockResolvedValue(baseSession())
    const { w } = await mountView(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
    expect(w.find('[data-testid="blocks-panel"]').exists()).toBe(true)
    expect(w.get('[data-testid="detail-block-progress-0"]').text()).toBe('12/30')
    expect(w.get('[data-testid="detail-block-0"]').text()).toContain('Matematik Ustoz')
    expect(w.get('[data-testid="detail-block-0"]').text()).toContain('×3.1')
    expect(w.get('[data-testid="detail-block-0"]').text()).toContain('30 daqiqa')
    expect(w.get('[data-testid="detail-block-1"]').text()).toContain('Tayyor')
    expect(w.get('[data-testid="detail-scoring"]').text()).toBe('Blok koeffitsiyenti')
    expect(w.get('[data-testid="detail-timing"]').text()).toBe('Blokma-blok')
    expect(w.find('[data-testid="detail-contrib-deadline"]').exists()).toBe(true)
  })

  it('eski (blokisiz) imtihonda panel yo`q', async () => {
    api.getSession.mockResolvedValue(
      baseSession({
        blocks: [
          {
            id: 'main',
            legacy: true,
            subjectId: 'math',
            subjectName: 'Matematika',
            title: '',
            targetCount: 0,
            coefficient: 1,
            durationMin: null,
            status: 'ready',
            count: 5,
            contributors: [],
            items: [],
            contribQuestions: [],
          },
        ],
      }),
    )
    const { w } = await mountView(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
    expect(w.find('[data-testid="blocks-panel"]').exists()).toBe(false)
  })

  it('rejalashtirish: maqsaddan kam savol 409 bo`lsa tasdiq so`raladi, tasdiqlansa confirmShort bilan qayta yuboriladi', async () => {
    api.getSession.mockResolvedValue(baseSession())
    api.submitSession
      .mockRejectedValueOnce(
        new ApiError('CONFLICT', 'kam', 409, [{ path: 'blocks', message: 'Matematika: 12/30' }]),
      )
      .mockResolvedValueOnce(baseSession({ status: 'scheduled' }))
    const { w } = await mountView(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
    await w.get('[data-testid="act-submit"]').trigger('click')
    await flushPromises()
    expect(api.submitSession).toHaveBeenCalledWith('e1')
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    expect(c.state.options.message).toContain('Matematika: 12/30')
    c.settle(true)
    await flushPromises()
    expect(api.submitSession).toHaveBeenLastCalledWith('e1', true)
  })

  it('tasdiq rad etilsa qayta yuborilmaydi', async () => {
    api.getSession.mockResolvedValue(baseSession())
    api.submitSession.mockRejectedValueOnce(
      new ApiError('CONFLICT', 'kam', 409, [{ path: 'blocks', message: 'x' }]),
    )
    const { w } = await mountView(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
    await w.get('[data-testid="act-submit"]').trigger('click')
    await flushPromises()
    useConfirm().settle(false)
    await flushPromises()
    expect(api.submitSession).toHaveBeenCalledTimes(1)
  })
})

describe('Biriktirilgan o`qituvchi: "Menga biriktirilgan imtihon bloklari"', () => {
  const myBlock = (over: Partial<MyBlockDetail['block']> = {}): MyBlockDetail => ({
    exam: { id: 'e1', title: 'DTM sinov', contribDeadline: '2026-11-30T05:00:00.000Z' },
    block: {
      id: 'b1',
      subjectId: 'math',
      subjectName: 'Matematika',
      title: 'Matematika',
      targetCount: 30,
      count: 2,
      status: 'open',
      locked: false,
      lockReason: null,
      ...over,
    },
    questions: [
      {
        id: 'q1',
        missing: false,
        type: 'single',
        difficulty: 2,
        points: 2,
        status: 'active',
        preview: 'Mening savolim',
        hasMath: false,
        hasImage: false,
        authorName: 'Men',
        source: 'contributor',
        addedByName: 'Men',
        canRemove: true,
      },
      {
        id: 'q2',
        missing: false,
        type: 'multi',
        difficulty: 2,
        points: 4,
        status: 'active',
        preview: 'Tuzuvchi savoli',
        hasMath: false,
        hasImage: false,
        authorName: 'Admin',
        source: 'composer',
        addedByName: null,
        canRemove: false,
      },
    ],
    rules: [],
  })

  it('Imtihonlar sahifasida faqat o`z bloklari ro`yxati: imtihon nomi, fan, N/maqsad, muddat', async () => {
    api.myBlocks.mockResolvedValue([
      {
        sessionId: 'e1',
        blockId: 'b1',
        examTitle: 'DTM sinov',
        examStatus: 'draft',
        subjectId: 'math',
        subjectName: 'Matematika',
        title: 'Matematika',
        targetCount: 30,
        count: 2,
        blockStatus: 'open',
        contribDeadline: '2026-11-30T05:00:00.000Z',
        locked: false,
        lockReason: null,
      },
    ])
    const { w, router } = await mountView(
      SessionsView,
      '/exams/sessions',
      '/exams/sessions',
      'teacher',
    )
    const card = w.get('[data-testid="my-block-0"]')
    expect(w.get('[data-testid="my-blocks"]').text()).toContain(
      'Menga biriktirilgan imtihon bloklari',
    )
    expect(card.text()).toContain('DTM sinov')
    expect(card.text()).toContain('Matematika')
    expect(card.text()).toContain('2/30')
    await card.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-my-block')
    expect(router.currentRoute.value.params).toMatchObject({ sessionId: 'e1', blockId: 'b1' })
  })

  it('biriktirilgan blok yo`q bo`lsa bo`lim ko`rinmaydi', async () => {
    const { w } = await mountView(SessionsView, '/exams/sessions', '/exams/sessions', 'teacher')
    expect(w.find('[data-testid="my-blocks"]').exists()).toBe(false)
  })

  it('blok sahifasi: sarlavha, imtihon nomi, progress, muddat, savollar; faqat o`zi qo`shganini olib tashlash mumkin', async () => {
    api.myBlock.mockResolvedValue(myBlock())
    api.removeFromBlock.mockResolvedValue({ removed: true, count: 1, target: 30 })
    const { w } = await mountView(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
      'teacher',
    )
    expect(w.get('[data-testid="myblock-title"]').text()).toBe('Matematika')
    expect(w.get('[data-testid="myblock-exam"]').text()).toBe('DTM sinov')
    expect(w.get('[data-testid="myblock-progress"]').text()).toBe('2/30')
    expect(w.get('[data-testid="myblock-deadline"]').text()).not.toBe('—')
    expect(w.findAll('[data-testid^="myblock-q-"]')).toHaveLength(2)
    expect(w.find('[data-testid="myblock-remove-0"]').exists()).toBe(true)
    expect(w.find('[data-testid="myblock-remove-1"]').exists()).toBe(false) // tuzuvchi savoli
    expect(w.find('[data-testid="myblock-actions"]').exists()).toBe(true)
    expect(w.find('[data-testid="myblock-locked"]').exists()).toBe(false)
    await w.get('[data-testid="myblock-remove-0"]').trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(api.removeFromBlock).toHaveBeenCalledWith('e1', 'b1', 'q1')
  })

  it('yangi savol va import blok kontekstida ochiladi (query: blockSession, block)', async () => {
    api.myBlock.mockResolvedValue(myBlock())
    const { w, router } = await mountView(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
      'teacher',
    )
    await w.get('[data-testid="myblock-write"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-question-create')
    expect(router.currentRoute.value.query).toMatchObject({ blockSession: 'e1', block: 'b1' })
    await router.push('/exams/blocks/e1/b1')
  })

  it.each([
    ['deadline', 'Savol topshirish muddati tugagan'],
    ['ready', '"tayyor"'],
    ['status', 'qoralama holatidan chiqqan'],
  ] as const)('qulf (%s): amallar yashirin, sabab ko`rsatiladi', async (reason, text) => {
    api.myBlock.mockResolvedValue(myBlock({ locked: true, lockReason: reason }))
    const { w } = await mountView(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
      'teacher',
    )
    expect(w.get('[data-testid="myblock-locked"]').text()).toContain(text)
    expect(w.find('[data-testid="myblock-actions"]').exists()).toBe(false)
    // qulfda olib tashlash tugmasi ham yo'q (server canRemove=false bermaydi, lekin qulf ostida kerak emas)
  })

  it('boshqa blok / ruxsatsiz: server 404 bersa xato holati (ma`lumot ko`rinmaydi)', async () => {
    api.myBlock.mockRejectedValue(new ApiError('NOT_FOUND', 'yo`q', 404, []))
    const { w } = await mountView(
      MyBlockView,
      '/exams/blocks/e1/zzz',
      '/exams/blocks/:sessionId/:blockId',
      'teacher',
    )
    expect(w.find('[data-testid="myblock-title"]').exists()).toBe(false)
    expect(w.find('[data-testid="myblock-questions"]').exists()).toBe(false)
  })
})

const resultItem = (over: Partial<ExamResultListItem> = {}): ExamResultListItem => ({
  id: 'r1',
  title: 'DTM sinov',
  heldAt: '2026-12-01T05:00:00.000Z',
  endsAt: '2026-12-01T05:50:00.000Z',
  closedAt: '2026-12-01T06:00:00.000Z',
  subjects: [{ id: 'math', name: 'Matematika' }],
  classes: [{ id: 'c1', name: '7-A' }],
  blocksCount: 2,
  scoringMode: 'coefficient',
  participants: 20,
  submitted: 18,
  examDeleted: false,
  ...over,
})

describe('"Natijalar" moduli: ro`yxat', () => {
  it('yopilgan imtihonlar nom/sana/fan/sinf bilan; o`chirilgan imtihon belgisi; bosilsa natijalar sahifasi', async () => {
    api.listResults.mockResolvedValue({
      items: [
        resultItem(),
        resultItem({ id: 'r2', title: 'Eski', examDeleted: true, blocksCount: 1 }),
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
    const { w, router } = await mountView(ExamResultsListView, '/exams/results', '/exams/results')
    expect(api.listResults).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
    const rows = w.findAll('[data-testid^="rl-row-"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('DTM sinov')
    expect(rows[0]!.text()).toContain('Matematika')
    expect(rows[0]!.text()).toContain('7-A')
    expect(rows[0]!.text()).toContain('18/20')
    expect(rows[0]!.find('[data-testid="rl-deleted"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-testid="rl-deleted"]').exists()).toBe(true)
    await rows[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-session-results')
    expect(router.currentRoute.value.params.id).toBe('r2')
  })

  it('filtrlar (nom, sana, fan, sinf) API ga uzatiladi; bo`sh holat', async () => {
    api.listResults.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
    api.classOptions.mockResolvedValue([{ id: 'c1', name: '7-A', grade: 7, studentsCount: 1 }])
    const { w } = await mountView(ExamResultsListView, '/exams/results', '/exams/results')
    expect(w.find('[data-testid="rl-empty"]').exists()).toBe(true)
    await w.get('[data-testid="rl-search"]').setValue('dtm')
    await w.get('[data-testid="rl-from"]').setValue('2026-12-01')
    await w.get('[data-testid="rl-subject"]').setValue('math')
    await w.get('[data-testid="rl-class"]').setValue('c1')
    await sleep(400)
    await flushPromises()
    expect(api.listResults).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      q: 'dtm',
      from: '2026-12-01',
      to: undefined,
      subjectId: 'math',
      classId: 'c1',
    })
  })

  it('yon menyu bandi: Natijalar', async () => {
    const mod = (await import('@/constants/navigation')) as Record<string, unknown>
    const all = Object.values(mod).find(
      (v) =>
        Array.isArray(v) && (v as { name?: string }[]).some((x) => x.name === 'exam-results-list'),
    ) as { name: string; labelKey: string }[]
    expect(all.find((x) => x.name === 'exam-results-list')?.labelKey).toBe('nav.examResultsList')
    expect(uz.nav.examResultsList).toBe('Natijalar')
  })
})

describe('Imtihon sahifasi: o`chirish tanlovi, nusxa, qaytarish', () => {
  const draftLike = (over: Partial<ExamSession> = {}) =>
    baseSession({ blocks: [], timingMode: 'common', scoringMode: 'points', ...over })

  it('urinishli imtihon: ikki variantli oyna; "natijalar bilan" nomni yozmaguncha o`chirilmaydi', async () => {
    api.getSession.mockResolvedValue(
      draftLike({ status: 'closed', canDelete: true, hasAttempts: true, canSubmit: false }),
    )
    api.deleteSession.mockResolvedValue({ id: 'e1', deleted: true, mode: 'with_results' })
    const { w, router } = await mountView(
      SessionDetailView,
      '/exams/sessions/e1',
      '/exams/sessions/:id',
    )
    await w.get('[data-testid="act-delete"]').trigger('click')
    await flushPromises()
    expect($('delete-dialog')).toBeTruthy()
    expect(document.body.querySelector('[data-testid="delete-confirm-box"]')).toBeNull()
    ;($('delete-with-results') as HTMLInputElement).click()
    await flushPromises()
    expect($('delete-confirm-box').textContent).toContain('QAYTARIB BO')
    expect(($('delete-confirm') as HTMLButtonElement).disabled).toBe(true)
    const inp = document.body.querySelector('input[data-testid="delete-title"]') as HTMLInputElement
    inp.value = 'dtm sinov'
    inp.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(($('delete-confirm') as HTMLButtonElement).disabled).toBe(true)
    inp.value = 'DTM sinov'
    inp.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(($('delete-confirm') as HTMLButtonElement).disabled).toBe(false)
    ;($('delete-confirm') as HTMLButtonElement).click()
    await flushPromises()
    expect(api.deleteSession).toHaveBeenCalledWith('e1', {
      mode: 'with_results',
      confirmTitle: 'DTM sinov',
    })
    expect(router.currentRoute.value.name).toBe('exam-sessions')
  })

  it('"faqat imtihonni o`chirish" (standart variant): nom so`ralmaydi', async () => {
    api.getSession.mockResolvedValue(
      draftLike({ status: 'closed', canDelete: true, hasAttempts: true }),
    )
    api.deleteSession.mockResolvedValue({ id: 'e1', deleted: true, mode: 'exam_only' })
    const { w } = await mountView(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
    await w.get('[data-testid="act-delete"]').trigger('click')
    await flushPromises()
    ;($('delete-confirm') as HTMLButtonElement).click()
    await flushPromises()
    expect(api.deleteSession).toHaveBeenCalledWith('e1', {
      mode: 'exam_only',
      confirmTitle: undefined,
    })
  })

  it('urinishsiz imtihon: oddiy tasdiq dialogi (ikki variantli oyna yo`q)', async () => {
    api.getSession.mockResolvedValue(draftLike({ canDelete: true, hasAttempts: false }))
    api.deleteSession.mockResolvedValue({ id: 'e1', deleted: true, mode: 'none' })
    const { w } = await mountView(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
    await w.get('[data-testid="act-delete"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="delete-dialog"]')).toBeNull()
    useConfirm().settle(true)
    await flushPromises()
    expect(api.deleteSession).toHaveBeenCalledWith('e1', {})
  })

  it('nusxa: yangi qoralama ochiladi, ogohlantirishlar ko`rsatiladi; tugma canCopy ga bog`liq', async () => {
    api.getSession.mockResolvedValue(draftLike({ status: 'closed', canCopy: true }))
    api.copySession.mockResolvedValue({
      session: draftLike({ id: 'n1' }),
      warnings: ["1 ta savol bankdan o'chirilgan: nusxaga tushmadi"],
    })
    const { w, router } = await mountView(
      SessionDetailView,
      '/exams/sessions/e1',
      '/exams/sessions/:id',
    )
    await w.get('[data-testid="act-copy"]').trigger('click')
    await flushPromises()
    expect(api.copySession).toHaveBeenCalledWith('e1')
    expect(router.currentRoute.value.name).toBe('exam-session-edit')
    expect(router.currentRoute.value.params.id).toBe('n1')
    expect(JSON.stringify(useToast().toasts)).toContain('nusxaga tushmadi')
    document.body.innerHTML = ''
    api.getSession.mockResolvedValue(draftLike({ canCopy: false }))
    const { w: w2 } = await mountView(
      SessionDetailView,
      '/exams/sessions/e1',
      '/exams/sessions/:id',
    )
    expect(w2.find('[data-testid="act-copy"]').exists()).toBe(false)
  })

  it('qoralamaga qaytarish: faqat rejalashtirilgan va urinishsiz; tasdiqdan keyin usta ochiladi', async () => {
    api.getSession.mockResolvedValue(
      draftLike({
        status: 'scheduled',
        canReturnToDraft: true,
        hasAttempts: false,
        code: '123456',
      }),
    )
    api.returnToDraft.mockResolvedValue(draftLike())
    const { w, router } = await mountView(
      SessionDetailView,
      '/exams/sessions/e1',
      '/exams/sessions/:id',
    )
    await w.get('[data-testid="act-return"]').trigger('click')
    await flushPromises()
    expect(useConfirm().state.options.message).toContain('PIN')
    useConfirm().settle(true)
    await flushPromises()
    expect(api.returnToDraft).toHaveBeenCalledWith('e1')
    expect(router.currentRoute.value.name).toBe('exam-session-edit')
    document.body.innerHTML = ''
    api.getSession.mockResolvedValue(
      draftLike({ status: 'scheduled', canReturnToDraft: true, hasAttempts: true }),
    )
    const { w: w2 } = await mountView(
      SessionDetailView,
      '/exams/sessions/e1',
      '/exams/sessions/:id',
    )
    expect(w2.find('[data-testid="act-return"]').exists()).toBe(false)
  })
})

describe('Natijalar: blok ustunlari', () => {
  const multiResults = (): ExamResultsResponse => ({
    session: {
      id: 'e1',
      title: 'DTM sinov',
      status: 'closed',
      resultsMode: 'score',
      resultsPublished: false,
      publishedAt: null,
      passPercent: null,
      scheduledStart: '2026-12-01T05:00:00.000Z',
      endsAt: '2026-12-01T05:50:00.000Z',
      scoringMode: 'coefficient',
      timingMode: 'per_block',
    },
    blocks: [
      {
        id: 'b1',
        legacy: false,
        subjectId: 'math',
        subjectName: 'Matematika',
        title: 'Matematika',
        coefficient: 3.1,
        durationMin: 30,
      },
      {
        id: 'b2',
        legacy: false,
        subjectId: 'lang',
        subjectName: 'Ona tili',
        title: 'Ona tili',
        coefficient: 2.1,
        durationMin: 20,
      },
    ],
    summary: {
      participants: 1,
      started: 1,
      submitted: 1,
      averagePercent: 75,
      maxPercent: 75,
      minPercent: 75,
      passPercent: null,
      passRate: null,
      passedCount: 0,
      essayPending: 0,
    },
    rows: [
      {
        key: 'a',
        kind: 'student',
        fullName: 'Aliyev Vali',
        className: '7-A',
        status: 'submitted',
        earned: 78,
        max: 104,
        percent: 75,
        passed: null,
        answered: 50,
        total: 50,
        timeSpentSec: 900,
        warnings: 0,
        essayPending: 0,
        rank: 1,
        blocks: [
          { blockId: 'b1', earned: 24, max: 30 },
          { blockId: 'b2', earned: 54, max: 74 },
        ],
      },
    ],
  })
  const mountResults = (data: ExamResultsResponse) => {
    api.sessionResults.mockResolvedValue(data)
    return mountView(ExamResultsView, '/exams/sessions/e1/results', '/exams/sessions/:id/results')
  }

  it('har blok uchun ustun ("Matematika" 24/30), umumiy ball ham', async () => {
    const { w } = await mountResults(multiResults())
    expect(w.get('[data-testid="block-col-0"]').text()).toBe('Matematika')
    expect(w.get('[data-testid="block-col-1"]').text()).toBe('Ona tili')
    const row = w.get('[data-testid="result-row"]')
    expect(row.get('[data-testid="cell-block-0"]').text()).toBe('24/30')
    expect(row.get('[data-testid="cell-block-1"]').text()).toBe('54/74')
    expect(row.get('[data-testid="cell-score"]').text()).toBe('78 / 104')
  })

  it('bitta (eski) blokda blok ustunlari yo`q: jadval o`zgarmaydi', async () => {
    const d = multiResults()
    d.blocks = [d.blocks![0]!]
    const { w } = await mountResults(d)
    expect(w.find('[data-testid="block-col-0"]').exists()).toBe(false)
    expect(w.find('[data-testid="cell-block-0"]').exists()).toBe(false)
    const d2 = multiResults()
    delete (d2 as Partial<ExamResultsResponse>).blocks
    document.body.innerHTML = ''
    const { w: w2 } = await mountResults(d2)
    expect(w2.find('[data-testid="block-col-0"]').exists()).toBe(false)
  })

  it('tahlil blok bo`yicha guruhlanadi (blok sarlavhalari)', async () => {
    api.resultsAnalysis.mockResolvedValue({
      submittedAttempts: 1,
      blocks: multiResults().blocks,
      questions: [
        {
          id: 'q1',
          blockId: 'b1',
          index: 1,
          type: 'single',
          points: 2,
          content: [{ type: 'text', text: 'M1' }],
          shown: 1,
          answered: 1,
          correctPercent: 100,
          averagePoints: 2,
          options: [],
          flags: [],
        },
        {
          id: 'q2',
          blockId: 'b2',
          index: 2,
          type: 'single',
          points: 1,
          content: [{ type: 'text', text: 'L1' }],
          shown: 1,
          answered: 1,
          correctPercent: 0,
          averagePoints: 0,
          options: [],
          flags: [],
        },
      ],
    })
    const { w } = await mountResults(multiResults())
    await w.get('[data-testid="tab-analysis"]').trigger('click')
    await flushPromises()
    const titles = w.findAll('[data-testid="analysis-block-title"]').map((x) => x.text())
    expect(titles).toEqual(['Matematika', 'Ona tili'])
    expect(w.findAll('[data-testid="analysis-question"]')).toHaveLength(2)
  })

  it('ishtirokchi tafsiloti: blok ballari va blok sarlavhalari', async () => {
    const detail: ExamResultDetail = {
      participant: { key: 'a', fullName: 'Aliyev Vali', className: '7-A' },
      status: 'submitted',
      score: { earned: 78, max: 104, essayPending: 0 },
      percent: 75,
      blocks: multiResults().blocks,
      blockScores: [
        { blockId: 'b1', earned: 24, max: 30 },
        { blockId: 'b2', earned: 54, max: 74 },
      ],
      questions: [
        {
          id: 'q1',
          blockId: 'b1',
          index: 1,
          type: 'short',
          points: 1,
          content: [{ type: 'text', text: 'M1' }],
          options: [],
          given: '5',
          flagged: false,
          correct: { texts: ['5'] },
          got: 1,
          ok: true,
          graded: null,
          grade: null,
        },
        {
          id: 'q2',
          blockId: 'b2',
          index: 2,
          type: 'short',
          points: 1,
          content: [{ type: 'text', text: 'L1' }],
          options: [],
          given: 'x',
          flagged: false,
          correct: { texts: ['y'] },
          got: 0,
          ok: false,
          graded: null,
          grade: null,
        },
      ],
    }
    api.resultDetail.mockResolvedValue(detail)
    const { w } = await mountResults(multiResults())
    await w.get('[data-testid="result-row"]').trigger('click')
    await flushPromises()
    expect($('detail-block-score-b1').textContent).toContain('24 / 30')
    expect($('detail-block-score-b2').textContent).toContain('54 / 74')
    expect(document.body.querySelectorAll('[data-testid="detail-block-title"]')).toHaveLength(2)
    void w
  })
})
