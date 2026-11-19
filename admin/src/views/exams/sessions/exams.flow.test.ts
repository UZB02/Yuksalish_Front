import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type {
  BlockQuestionList,
  ExamBlock,
  ExamSession,
  ExamSessionMeta,
  ExamSessionItem,
  Question,
  User,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  blockState,
  blocksSummary,
  examFlow,
  listPill,
  listStageOf,
  progressTone,
} from '@/utils/examFlow'

const api = {
  getSession: vi.fn(),
  sessionMeta: vi.fn(),
  sessionAttempts: vi.fn(),
  remindSession: vi.fn(),
  participantCode: vi.fn(),
  regeneratePin: vi.fn(),
  setBlockReady: vi.fn(),
  composerBlockQuestions: vi.fn(),
  composerRemoveBlockQuestion: vi.fn(),
  getQuestion: vi.fn(),
  submitSession: vi.fn(),
  listSessions: vi.fn(),
  myBlocks: vi.fn(),
  listResults: vi.fn(),
  subjects: vi.fn(),
  classOptions: vi.fn(),
  listCandidates: vi.fn(),
  createCandidate: vi.fn(),
  addParticipants: vi.fn(),
  classStudents: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import BlockReviewView from './BlockReviewView.vue'
import SessionDetailView from './SessionDetailView.vue'
import SessionsView from './SessionsView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

async function mountAt(comp: unknown, path: string, routePath: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('t', {
    id: 'u1',
    role: 'school_admin',
    schoolId: 's1',
    permissions: ['exams.manage'],
  } as unknown as User)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, name: 'cur', component: comp as never },
      { path: '/exams/sessions', name: 'exam-sessions', component: empty },
      { path: '/exams/sessions/:id', name: 'exam-session', component: empty },
      { path: '/exams/sessions/:id/edit', name: 'exam-session-edit', component: empty },
      { path: '/exams/sessions/:id/results', name: 'exam-session-results', component: empty },
      { path: '/exams/sessions/:id/review/:blockId', name: 'exam-block-review', component: empty },
      { path: '/exams/blocks/:sessionId/:blockId', name: 'exam-my-block', component: empty },
      { path: '/exams/questions/:id/edit', name: 'exam-question-edit', component: empty },
      { path: '/exams/tasks', name: 'exam-tasks', component: empty },
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

const block = (over: Partial<ExamBlock> = {}): ExamBlock => ({
  id: 'b1',
  legacy: false,
  subjectId: 'math',
  subjectName: 'Matematika',
  title: 'Matematika',
  targetCount: 30,
  coefficient: 3.1,
  durationMin: 30,
  status: 'open',
  readyBy: null,
  count: 12,
  contributors: [{ id: 'tm', fullName: 'Matematik Ustoz' }],
  items: [],
  contribQuestions: [],
  ...over,
})
const blocks3 = () => [
  block(),
  block({
    id: 'b2',
    subjectName: 'Ona tili',
    title: 'Ona tili',
    coefficient: 2.1,
    targetCount: 20,
    count: 20,
    status: 'ready',
    readyBy: 'contributor',
    contributors: [{ id: 'tl', fullName: 'Ona tili Ustoz' }],
  }),
  block({
    id: 'b3',
    subjectName: 'Fizika',
    title: 'Fizika',
    coefficient: 1,
    targetCount: 10,
    count: 10,
    status: 'ready',
    readyBy: 'composer',
    contributors: [{ id: 'tf', fullName: 'Fizik Ustoz' }],
  }),
]
const session = (over: Partial<ExamSession> = {}): ExamSession =>
  ({
    id: 'e1',
    title: 'DTM sinovi',
    type: 'quarter',
    status: 'draft',
    phase: null,
    subjectId: null,
    subjectName: null,
    classes: [
      { id: 'c1', name: '11-A' },
      { id: 'c2', name: '11-B' },
    ],
    scheduledStart: '2026-11-25T04:00:00.000Z',
    durationMin: 180,
    endsAt: '2026-11-25T07:00:00.000Z',
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
    contribDeadline: '2026-11-22T13:00:00.000Z',
    blocksCount: 3,
    blocks: blocks3(),
    participants: [],
    ...over,
  }) as ExamSession

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  api.sessionMeta.mockResolvedValue({
    pinSecretConfigured: true,
    isAdministration: true,
    teachersCanCreateQuizzes: true,
    teacherQuizNeedsApproval: false,
    allowedTypes: ['quarter'],
    supervisors: [],
    contributors: [],
  })
  api.sessionAttempts.mockResolvedValue({ items: [], joinAlert: { failures: 0 } })
  api.myBlocks.mockResolvedValue([])
  for (const t of [...useToast().toasts]) useToast().dismiss(t.id)
})

describe('utils/examFlow: fan holati va bosqichlar', () => {
  it('blockState: yig`ilmoqda / o`qituvchi tugatdi / tasdiqlangan / tasdiq shart emas', () => {
    expect(blockState(block())).toBe('collecting')
    expect(blockState(block({ status: 'ready', readyBy: 'contributor' }))).toBe('done')
    expect(blockState(block({ status: 'ready', readyBy: 'composer' }))).toBe('approved')
    // eski ma'lumot: tayyor, readyBy yo'q = tuzuvchi tasdig'i
    expect(blockState(block({ status: 'ready', readyBy: undefined }))).toBe('approved')
    expect(blockState(block({ contributors: [] }))).toBe('auto')
  })

  it('blocksSummary: jami, tasdiqlangan, tasdiq kutayotgan, yig`ilayotgan', () => {
    const s = blocksSummary(blocks3())
    expect(s).toMatchObject({ total: 3, approved: 1, done: 1, collecting: 1 })
    expect(s.questionsDone).toBe(false)
    expect(s.allApproved).toBe(false)
  })

  it('examFlow: qoralama -> yig`ilmoqda -> tasdiq kutilmoqda -> tayyor; keyingi holatlar', () => {
    const base = { participantsCount: 0 }
    const stateOf = (r: ReturnType<typeof examFlow>) => r.stages.map((x) => x.state).join(',')
    let r = examFlow({ ...base, status: 'draft', blocks: blocks3() })
    expect(r.pill).toBe('collecting')
    expect(stateOf(r)).toBe('done,current,todo,todo,todo,todo')
    const waiting = blocks3()
    waiting[0] = block({ status: 'ready', readyBy: 'contributor' })
    r = examFlow({ ...base, status: 'draft', blocks: waiting })
    expect(r.pill).toBe('awaiting_approval')
    expect(stateOf(r)).toBe('done,done,current,todo,todo,todo')
    const approved = waiting.map((b) => ({
      ...b,
      status: 'ready' as const,
      readyBy: 'composer' as const,
    }))
    r = examFlow({ ...base, status: 'draft', blocks: approved })
    expect(r.pill).toBe('ready')
    expect(stateOf(r)).toBe('done,done,done,current,todo,todo')
    r = examFlow({ participantsCount: 5, status: 'draft', blocks: approved })
    expect(stateOf(r)).toBe('done,done,done,done,current,todo')
    r = examFlow({ participantsCount: 5, status: 'scheduled', blocks: approved })
    expect(r.pill).toBe('scheduled')
    expect(stateOf(r)).toBe('done,done,done,done,current,todo')
    expect(examFlow({ participantsCount: 5, status: 'open', blocks: approved }).pill).toBe(
      'running',
    )
    r = examFlow({ participantsCount: 5, status: 'closed', blocks: approved })
    expect(r.pill).toBe('finished')
    expect(stateOf(r)).toBe('done,done,done,done,done,current')
    r = examFlow({ participantsCount: 5, status: 'cancelled', blocks: approved })
    expect(r.pill).toBe('cancelled')
    expect(r.stages.some((x) => x.state === 'current')).toBe(false)
  })

  it('o`qituvchisiz fan tasdiqni talab qilmaydi (maqsadga yetgach savollar bosqichi tugaydi)', () => {
    const own = [block({ contributors: [], count: 30 })]
    expect(blocksSummary(own).allApproved).toBe(true)
    expect(blocksSummary(own).questionsDone).toBe(true)
    expect(blocksSummary([block({ contributors: [], count: 5 })]).questionsDone).toBe(false)
  })

  it('progressTone va ro`yxat yordamchilari', () => {
    expect(progressTone(3, 30)).toBe('warning')
    expect(progressTone(15, 30)).toBe('primary')
    expect(progressTone(30, 30)).toBe('success')
    expect(progressTone(0, 0)).toBe('success')
    expect(listStageOf('draft')).toBe('preparing')
    expect(listStageOf('pending_approval')).toBe('preparing')
    expect(listStageOf('scheduled')).toBe('scheduled')
    expect(listStageOf('open')).toBe('scheduled')
    expect(listStageOf('closed')).toBe('past')
    expect(listStageOf('cancelled')).toBe('past')
    const p = { total: 3, done: 2, approved: 1 }
    expect(listPill({ status: 'draft', blocksCount: 3, blocksProgress: p })).toBe('collecting')
    expect(
      listPill({
        status: 'draft',
        blocksCount: 3,
        blocksProgress: { total: 3, done: 3, approved: 1 },
      }),
    ).toBe('awaiting_approval')
    expect(
      listPill({
        status: 'draft',
        blocksCount: 3,
        blocksProgress: { total: 3, done: 3, approved: 3 },
      }),
    ).toBe('ready')
    expect(listPill({ status: 'scheduled', blocksCount: 3, blocksProgress: p })).toBe('scheduled')
    expect(listPill({ status: 'draft' })).toBeNull()
  })
})

describe('Imtihon sahifasi: sarlavha, bosqichlar va "Fanlar" jadvali', () => {
  const mountDetail = (s = session()) => {
    api.getSession.mockResolvedValue(s)
    return mountAt(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
  }

  it('sarlavha: "Tur · sinflar · vaqt · davomiylik" va holat belgisi; bosqichlar ko`rsatkichi muddat bilan', async () => {
    const { w } = await mountDetail()
    expect(w.get('h1').text()).toBe('DTM sinovi')
    const header = w.text()
    expect(header).toContain('11-A, 11-B')
    expect(header).toContain('180 daqiqa')
    expect(header).toContain('25.11.2026')
    expect(w.get('[data-testid="detail-status"]').text()).toBe("Savollar yig'ilmoqda")
    const steps = w.findAll('[data-testid="stage-bar"] li').map((x) => x.attributes('data-testid'))
    expect(steps).toEqual([
      'stage-opened',
      'stage-questions',
      'stage-approval',
      'stage-participants',
      'stage-run',
      'stage-results',
    ])
    expect(w.get('[data-testid="stage-opened"]').attributes('data-state')).toBe('done')
    expect(w.get('[data-testid="stage-questions"]').attributes('data-state')).toBe('current')
    expect(w.get('[data-testid="stage-deadline"]').text()).toMatch(/^\d\d\.\d\d gacha$/)
  })

  it('jadval: fan + koeffitsiyent (×3,1), o`qituvchilar, N/maqsad, taraqqiyot rangi, holat va amal', async () => {
    const { w } = await mountDetail()
    const row = (i: number) => w.get(`[data-testid="detail-block-${i}"]`)
    expect(row(0).text()).toContain('Matematika')
    expect(w.get('[data-testid="detail-block-coef-0"]').text()).toBe('×3,1')
    expect(row(0).text()).toContain('Matematik Ustoz')
    expect(w.get('[data-testid="detail-block-progress-0"]').text()).toBe('12/30')
    expect(w.get('[data-testid="detail-block-bar-0"]').attributes('data-tone')).toBe('warning')
    expect(w.get('[data-testid="detail-block-bar-1"]').attributes('data-tone')).toBe('success')
    expect(w.get('[data-testid="detail-block-state-0"]').text()).toBe("Yig'ilmoqda")
    expect(w.get('[data-testid="detail-block-state-1"]').text()).toBe("O'qituvchi tugatdi")
    expect(w.get('[data-testid="detail-block-state-2"]').text()).toBe('Tasdiqlangan')
    expect(w.get('[data-testid="detail-block-action-0"]').text()).toBe('Ochish')
    expect(w.get('[data-testid="detail-block-action-1"]').text()).toBe("Ko'rib tasdiqlash")
    expect(w.get('[data-testid="detail-block-action-2"]').text()).toBe("Ko'rish")
    expect(w.get('[data-testid="approved-summary"]').text()).toContain('1 / 3 fan tasdiqlandi')
  })

  it('koeffitsiyent faqat koeffitsiyent rejimida ko`rinadi', async () => {
    const { w } = await mountDetail(session({ scoringMode: 'points' }))
    expect(w.find('[data-testid="detail-block-coef-0"]').exists()).toBe(false)
  })

  it('amallar: Ochish = vazifa sahifasi; Ko`rib tasdiqlash va Ko`rish = ko`rib chiqish sahifasi', async () => {
    const { w, router } = await mountDetail()
    await w.get('[data-testid="detail-block-action-0"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-my-block')
    await router.push('/exams/sessions/e1')
    await flushPromises()
    await w.get('[data-testid="detail-block-action-1"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-block-review')
    expect(router.currentRoute.value.params).toMatchObject({ id: 'e1', blockId: 'b2' })
  })

  it('"Sozlamalar" qoralamada tahrirlash sahifasiga; rejalashtirilgach tugmalar ("Eslatma", "Sozlamalar") yo`q', async () => {
    const { w, router } = await mountDetail()
    await w.get('[data-testid="act-settings"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-session-edit')
    document.body.innerHTML = ''
    const { w: w2 } = await mountDetail(session({ status: 'scheduled' }))
    expect(w2.find('[data-testid="act-settings"]').exists()).toBe(false)
    expect(w2.find('[data-testid="act-remind"]').exists()).toBe(false)
    expect(w2.get('[data-testid="detail-block-action-0"]').text()).toBe("Ko'rish")
  })

  it('"Eslatma": faqat tugallanmagan o`qituvchisi bor fan bo`lsa ko`rinadi; natijalar toast bilan', async () => {
    const { w } = await mountDetail()
    api.remindSession.mockResolvedValue({
      disabled: false,
      notConnected: false,
      sent: 1,
      blocks: [{ blockId: 'b1', subjectName: 'Matematika', state: 'sent' }],
    })
    await w.get('[data-testid="act-remind"]').trigger('click')
    await flushPromises()
    expect(api.remindSession).toHaveBeenCalledWith('e1')
    expect(JSON.stringify(useToast().toasts)).toContain('Eslatma yuborildi: 1 ta fan')
    api.remindSession.mockResolvedValue({
      disabled: false,
      notConnected: false,
      sent: 0,
      blocks: [{ blockId: 'b1', subjectName: 'Matematika', state: 'recent' }],
    })
    await w.get('[data-testid="act-remind"]').trigger('click')
    await flushPromises()
    expect(JSON.stringify(useToast().toasts)).toContain('soatiga bir marta')
    api.remindSession.mockResolvedValue({
      disabled: true,
      notConnected: false,
      sent: 0,
      blocks: [],
    })
    await w.get('[data-testid="act-remind"]').trigger('click')
    await flushPromises()
    expect(JSON.stringify(useToast().toasts)).toContain("o'chirilgan")
    api.remindSession.mockResolvedValue({
      disabled: false,
      notConnected: true,
      sent: 0,
      blocks: [],
    })
    await w.get('[data-testid="act-remind"]').trigger('click')
    await flushPromises()
    expect(JSON.stringify(useToast().toasts)).toContain('bot ulanmagan')
    // hammasi tugatgan: tugma yo'q
    document.body.innerHTML = ''
    const done = session({
      blocks: blocks3().map((b) => ({
        ...b,
        status: 'ready' as const,
        readyBy: 'contributor' as const,
      })),
    })
    const { w: w2 } = await mountDetail(done)
    expect(w2.find('[data-testid="act-remind"]').exists()).toBe(false)
  })

  it('rejalashtirish: tasdiqlanmagan fan bor = tugma o`chiq va xabarda fanlar nomi; hammasi tasdiqlangach ochiq; 409 (approval) toast', async () => {
    const { w } = await mountDetail()
    expect(w.get('[data-testid="act-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="stage-warning"]').text()).toContain('Matematika')
    expect(w.get('[data-testid="stage-warning"]').text()).toContain('Ona tili')
    expect(w.get('[data-testid="stage-warning"]').text()).not.toContain('Fizika')
    document.body.innerHTML = ''
    const ok = session({
      blocks: blocks3().map((b) => ({
        ...b,
        status: 'ready' as const,
        readyBy: 'composer' as const,
      })),
    })
    const { w: w2 } = await mountDetail(ok)
    api.submitSession.mockRejectedValueOnce(
      new ApiError('CONFLICT', 'x', 409, [
        { path: 'approval', message: "Matematika: ma'muriyat tasdiqlamagan" },
      ]),
    )
    await w2.get('[data-testid="act-submit"]').trigger('click')
    await flushPromises()
    expect(JSON.stringify(useToast().toasts)).toContain('tasdiqlamagan')
  })
})

describe('Fanni ko`rib chiqish va tasdiqlash', () => {
  const q = (id: string, over: Partial<Question> = {}): Question =>
    ({
      id,
      subjectId: 'math',
      topicId: 't',
      difficulty: 2,
      type: 'single',
      points: 2,
      status: 'active',
      version: 1,
      canEdit: true,
      content: [{ type: 'text', text: `Savol ${id}` }],
      options: [
        { id: 'a', content: [{ type: 'text', text: 'bir' }] },
        { id: 'b', content: [{ type: 'math', tex: 'x^2' }] },
      ],
      answer: { optionId: 'b' },
      ...over,
    }) as unknown as Question
  const rows = (ids: string[]): BlockQuestionList => ({
    questions: ids.map((id) => ({
      id,
      missing: false,
      type: 'single',
      difficulty: 2,
      points: 2,
      status: 'active',
      preview: id,
      hasMath: false,
      hasImage: false,
      authorName: 'Ustoz',
      source: 'contributor',
      addedByName: 'Matematik Ustoz',
      canRemove: true,
    })),
    rules: [],
  })
  const mountReview = (s = session(), ids = ['q1', 'q2']) => {
    api.getSession.mockResolvedValue(s)
    api.composerBlockQuestions.mockResolvedValue(rows(ids))
    api.getQuestion.mockImplementation(async (id: string) =>
      id === 'q2' ? q('q2', { type: 'multi', answer: { optionIds: ['a', 'b'] } }) : q(id),
    )
    return mountAt(
      BlockReviewView,
      '/exams/sessions/e1/review/b1',
      '/exams/sessions/:id/review/:blockId',
    )
  }
  const doneSession = () =>
    session({
      blocks: [
        block({ status: 'ready', readyBy: 'contributor', count: 30 }),
        ...blocks3().slice(1),
      ],
    })

  it('barcha savollar to`liq ko`rinadi: matn, variantlar, to`g`ri javob belgilangan (single va multi)', async () => {
    const { w } = await mountReview(doneSession())
    expect(w.get('[data-testid="review-title"]').text()).toBe(
      "Matematika: savollarni ko'rib chiqish",
    )
    expect(w.get('[data-testid="review-state"]').text()).toBe("O'qituvchi tugatdi")
    expect(w.findAll('[data-testid^="review-q-"]')).toHaveLength(2)
    expect(w.get('[data-testid="review-q-0"]').text()).toContain('Savol q1')
    expect(w.get('[data-testid="review-opt-0-a"]').attributes('data-correct')).toBe('false')
    expect(w.get('[data-testid="review-opt-0-b"]').attributes('data-correct')).toBe('true')
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()
    expect(w.get('[data-testid="review-opt-0-b"]').html()).toContain('katex')
    expect(w.get('[data-testid="review-opt-1-a"]').attributes('data-correct')).toBe('true')
    expect(w.get('[data-testid="review-opt-1-b"]').attributes('data-correct')).toBe('true')
  })

  it('tasdiqlash: maqsadga yetgan fan darhol tasdiqlanadi; keyin "Tasdiqni bekor qilish" va qulf xabari', async () => {
    const { w } = await mountReview(doneSession())
    api.setBlockReady.mockResolvedValue({ blockId: 'b1', status: 'ready' })
    api.getSession.mockResolvedValue(
      session({
        blocks: [block({ status: 'ready', readyBy: 'composer', count: 30 }), ...blocks3().slice(1)],
      }),
    )
    await w.get('[data-testid="review-approve"]').trigger('click')
    await flushPromises()
    expect(api.setBlockReady).toHaveBeenCalledWith('e1', 'b1', true)
    expect(w.get('[data-testid="review-state"]').text()).toBe('Tasdiqlangan')
    expect(w.find('[data-testid="review-approve"]').exists()).toBe(false)
    expect(w.find('[data-testid="review-locked-note"]').exists()).toBe(true)
    api.setBlockReady.mockResolvedValue({ blockId: 'b1', status: 'open' })
    api.getSession.mockResolvedValue(doneSession())
    await w.get('[data-testid="review-unapprove"]').trigger('click')
    await flushPromises()
    expect(api.setBlockReady).toHaveBeenLastCalledWith('e1', 'b1', false)
    expect(w.find('[data-testid="review-approve"]').exists()).toBe(true)
  })

  it('maqsaddan kam bo`lsa tasdiqlashdan oldin so`raladi; rad etilsa yuborilmaydi', async () => {
    const { w } = await mountReview(
      session({
        blocks: [block({ status: 'ready', readyBy: 'contributor' }), ...blocks3().slice(1)],
      }),
    )
    expect(w.get('[data-testid="review-short"]').text()).toContain('12/30')
    await w.get('[data-testid="review-approve"]').trigger('click')
    await flushPromises()
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    expect(c.state.options.message).toContain('12/30')
    c.settle(false)
    await flushPromises()
    expect(api.setBlockReady).not.toHaveBeenCalled()
    api.setBlockReady.mockResolvedValue({ blockId: 'b1', status: 'ready' })
    await w.get('[data-testid="review-approve"]').trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(api.setBlockReady).toHaveBeenCalledWith('e1', 'b1', true)
  })

  it('tahrirlash, olib tashlash (tasdiq bilan) va qo`shish; qoralama bo`lmasa faqat ko`rish', async () => {
    const { w, router } = await mountReview(doneSession())
    api.composerRemoveBlockQuestion.mockResolvedValue({ removed: true, count: 29, target: 30 })
    await w.get('[data-testid="review-remove-0"]').trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(api.composerRemoveBlockQuestion).toHaveBeenCalledWith('e1', 'b1', 'q1')
    await w.get('[data-testid="review-edit-1"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-question-edit')
    expect(router.currentRoute.value.params.id).toBe('q2')
    await router.push('/exams/sessions/e1/review/b1')
    await flushPromises()
    await w.get('[data-testid="review-add"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-my-block')
    document.body.innerHTML = ''
    const { w: w2 } = await mountReview(session({ status: 'scheduled' }))
    expect(w2.find('[data-testid="review-approve"]').exists()).toBe(false)
    expect(w2.find('[data-testid="review-unapprove"]').exists()).toBe(false)
    expect(w2.find('[data-testid="review-remove-0"]').exists()).toBe(false)
    expect(w2.findAll('[data-testid^="review-q-"]')).toHaveLength(2)
  })
})

describe('Imtihonlar ro`yxati: bosqich guruhlari va holat belgisi', () => {
  const item = (over: Partial<ExamSessionItem> = {}): ExamSessionItem =>
    ({
      ...(session() as unknown as ExamSessionItem),
      ...over,
    }) as ExamSessionItem
  const list = (items: ExamSessionItem[]) => ({
    items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  })

  it('guruhlar: Tayyorlanmoqda / Rejalashtirilgan (yopilganlar natijalar bo`limida); blokli imtihon belgisi fanlar jamlamasidan', async () => {
    api.listSessions.mockResolvedValue(
      list([
        item({
          id: 'a',
          title: 'Yopilgan',
          status: 'closed',
          blocksProgress: { total: 2, done: 2, approved: 2 },
        }),
        item({
          id: 'b',
          title: 'Rejada',
          status: 'scheduled',
          blocksProgress: { total: 2, done: 2, approved: 2 },
        }),
        item({
          id: 'c',
          title: 'Yig`ilmoqda',
          status: 'draft',
          blocksProgress: { total: 3, done: 1, approved: 0 },
        }),
        item({
          id: 'd',
          title: 'Tasdiq kutadi',
          status: 'draft',
          blocksProgress: { total: 3, done: 3, approved: 1 },
        }),
      ]),
    )
    const { w } = await mountAt(SessionsView, '/exams/sessions', '/exams/sessions')
    const groups = w
      .findAll('[data-testid^="sessions-group-"]')
      .map((g) => g.attributes('data-testid'))
    // yopilganlar "O'tgan / Natijalar" bo'limida; bu yerda faqat joriylar
    expect(groups).toEqual(['sessions-group-preparing', 'sessions-group-scheduled'])
    const pills = w.findAll('[data-testid="session-status"]').map((x) => x.text())
    expect(pills).toEqual(["Savollar yig'ilmoqda", 'Tasdiq kutilmoqda', 'Rejalashtirilgan'])
  })

  it('bosqich filtri: tanlangan bosqich guruhi qoladi; boshqa filtrlar (holat, tur) serverga ketadi', async () => {
    api.listSessions.mockResolvedValue(
      list([
        item({ id: 'b', status: 'scheduled' }),
        item({ id: 'c', status: 'draft', blocksProgress: { total: 3, done: 1, approved: 0 } }),
      ]),
    )
    const { w } = await mountAt(SessionsView, '/exams/sessions', '/exams/sessions')
    await w.get('[data-testid="filter-stage"]').setValue('scheduled')
    expect(w.findAll('[data-testid="session-row"]')).toHaveLength(1)
    expect(w.find('[data-testid="sessions-group-preparing"]').exists()).toBe(false)
    await w.get('[data-testid="filter-status"]').setValue('draft')
    await flushPromises()
    expect(api.listSessions).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'draft' }))
  })
})

describe('Ishtirokchilar: shaxsiy kirish kodi', () => {
  const withParticipants = () =>
    session({
      status: 'scheduled',
      participantsCount: 2,
      participants: [
        {
          key: 'k1',
          kind: 'student',
          fullName: 'Aliyev Vali',
          className: '11-A',
          grade: 11,
          origin: null,
          hasPin: true,
          hasCode: true,
          fullTimeGranted: false,
          extraMinutes: 0,
        },
        {
          key: 'k2',
          kind: 'student',
          fullName: 'Eski Oquvchi',
          className: '11-A',
          grade: 11,
          origin: null,
          hasPin: true,
          hasCode: false,
          fullTimeGranted: false,
          extraMinutes: 0,
        },
      ],
    } as Partial<ExamSession>)
  const mountDetail = () => {
    api.getSession.mockResolvedValue(withParticipants())
    return mountAt(SessionDetailView, '/exams/sessions/e1', '/exams/sessions/:id')
  }

  it('kod ro`yxatda maskalangan; "Ko`rsatish" alohida so`rov bilan ochadi, qayta bosilsa yashiradi; eski ishtirokchida "kod yo`q"', async () => {
    api.participantCode.mockResolvedValue({ code: '7K4-92M-QXA' })
    const { w } = await mountDetail()
    const rows = w.findAll('[data-testid="participant-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('[data-testid="code-text"]').text()).toBe('•••-•••-•••')
    expect(api.participantCode).not.toHaveBeenCalled()
    expect(w.text()).not.toContain('7K4-92M-QXA')
    await rows[0]!.get('[data-testid="code-toggle"]').trigger('click')
    await flushPromises()
    expect(api.participantCode).toHaveBeenCalledWith('e1', 'k1')
    expect(rows[0]!.get('[data-testid="code-text"]').text()).toBe('7K4-92M-QXA')
    expect(rows[0]!.get('[data-testid="code-toggle"]').text()).toBe('Yashirish')
    await rows[0]!.get('[data-testid="code-toggle"]').trigger('click')
    expect(rows[0]!.get('[data-testid="code-text"]').text()).toBe('•••-•••-•••')
    expect(rows[1]!.find('[data-testid="code-text"]').exists()).toBe(false)
    expect(rows[1]!.get('[data-testid="code-missing"]').text()).toContain("yo'q")
  })

  it('"Kod va PIN ni yangilash": tasdiqdan keyin yangilanadi va ochilgan kod yashirinadi', async () => {
    api.participantCode.mockResolvedValue({ code: '7K4-92M-QXA' })
    api.regeneratePin.mockResolvedValue({ regenerated: true })
    const { w } = await mountDetail()
    const row = w.findAll('[data-testid="participant-row"]')[0]!
    await row.get('[data-testid="code-toggle"]').trigger('click')
    await flushPromises()
    expect(row.get('[data-testid="code-text"]').text()).toBe('7K4-92M-QXA')
    await row.get('[data-testid="regen-pin"]').trigger('click')
    await flushPromises()
    const c = useConfirm()
    expect(c.state.options.message).toContain('shaxsiy kod')
    c.settle(true)
    await flushPromises()
    expect(api.regeneratePin).toHaveBeenCalledWith('e1', 'k1')
    expect(
      w.findAll('[data-testid="participant-row"]')[0]!.get('[data-testid="code-text"]').text(),
    ).toBe('•••-•••-•••')
  })
})

describe('"Imtihonlar" sahifasi: "O`tgan / Natijalar" bo`limi', () => {
  const resultItem = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    title: 'Yakunlangan DTM',
    heldAt: '2026-11-01T05:00:00.000Z',
    endsAt: '2026-11-01T08:00:00.000Z',
    closedAt: '2026-11-01T08:00:00.000Z',
    subjects: [{ id: 'math', name: 'Matematika' }],
    classes: [{ id: 'c1', name: '11-A' }],
    blocksCount: 2,
    participants: 10,
    submitted: 9,
    examDeleted: false,
    ...over,
  })
  const resultsPage = (items: unknown[]) => ({
    items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  })
  beforeEach(() => {
    api.listSessions.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    })
    api.listResults.mockResolvedValue(
      resultsPage([
        resultItem(),
        resultItem({ id: 'r2', title: 'O`chirilgan', examDeleted: true }),
      ]),
    )
    api.subjects.mockResolvedValue({ scope: 'all', subjects: [{ id: 'math', name: 'Matematika' }] })
    api.classOptions.mockResolvedValue([{ id: 'c1', name: '11-A', studentsCount: 5 }])
  })

  it('ikki bo`lim: Joriy imtihonlar (standart) va O`tgan / Natijalar; natijalar bo`limida filtrlar va ro`yxat, o`chirilgan belgisi', async () => {
    const { w, router } = await mountAt(SessionsView, '/exams/sessions', '/exams/sessions')
    expect(w.findAll('[data-testid="sessions-tabs"] [role="tab"]').map((x) => x.text())).toEqual([
      'Joriy imtihonlar',
      "O'tgan / Natijalar",
    ])
    expect(w.get('[data-testid="tab-sessions"]').attributes('aria-selected')).toBe('true')
    expect(w.find('[data-testid="results-filters"]').exists()).toBe(false)
    await w.get('[data-testid="tab-results"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('results')
    expect(w.find('[data-testid="results-filters"]').exists()).toBe(true)
    expect(w.find('[data-testid="filter-stage"]').exists()).toBe(false)
    expect(w.findAll('[data-testid^="rl-row-"]')).toHaveLength(2)
    expect(w.get('[data-testid="rl-row-0"]').text()).toContain('Yakunlangan DTM')
    expect(w.get('[data-testid="rl-deleted"]').text()).toContain('natijalar saqlangan')
    // sarlavha takrorlanmaydi (bitta "Imtihonlar" sarlavhasi)
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.get('h1').text()).toBe('Imtihonlar')
    // filtrlar saqlangan: qidiruv serverga ketadi
    await w.get('[data-testid="rl-search"]').setValue('dtm')
    await new Promise((r) => setTimeout(r, 400))
    await flushPromises()
    expect(api.listResults).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'dtm' }))
    // natija qatori batafsil sahifaga olib boradi
    await w.get('[data-testid="rl-row-0"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-session-results')
  })

  it('?tab=results to`g`ridan-to`g`ri natijalar bo`limini ochadi (eski /exams/results havolasi shunga yo`naltiriladi)', async () => {
    const { w } = await mountAt(SessionsView, '/exams/sessions?tab=results', '/exams/sessions')
    expect(w.get('[data-testid="tab-results"]').attributes('aria-selected')).toBe('true')
    expect(w.findAll('[data-testid^="rl-row-"]')).toHaveLength(2)
    await w.get('[data-testid="tab-sessions"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="results-filters"]').exists()).toBe(false)
    expect(w.find('[data-testid="sessions-empty"]').exists()).toBe(true)
  })

  it('nomzodlar ishtirokchilar panelida: kirish imtihonida shu yerda yaratib qo`shiladi, ro`yxatni boshqarish havolasi bor', async () => {
    api.classOptions.mockResolvedValue([])
    api.listCandidates.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
    })
    api.createCandidate.mockResolvedValue({
      id: 'n9',
      fullName: 'Yangi Nomzod',
      targetGrade: null,
      birthDate: null,
      hasBirthDate: false,
      parentPhone: null,
      notes: 'Namangan',
      piiPurged: false,
      createdAt: '',
    })
    api.addParticipants.mockResolvedValue({ added: 1, skipped: 0, total: 1 })
    const { default: Panel } = await import('./ParticipantsPanel.vue')
    const pinia = createPinia()
    setActivePinia(pinia)
    const meta: ExamSessionMeta = {
      pinSecretConfigured: true,
      isAdministration: true,
      teachersCanCreateQuizzes: true,
      teacherQuizNeedsApproval: false,
      allowedTypes: ['admission'],
      supervisors: [],
      contributors: [],
    }
    const panel = mount(Panel, {
      props: { session: session({ type: 'admission' } as Partial<ExamSession>), meta },
      global: {
        plugins: [pinia, i18n],
        stubs: { RouterLink: { template: '<a data-testid="manage-candidates"><slot /></a>' } },
      },
      attachTo: document.body,
    })
    mounted.push(panel)
    await flushPromises()
    expect(panel.find('[data-testid="manage-candidates"]').exists()).toBe(true)
    await panel.get('form[data-testid="candidate-quick"]').trigger('submit')
    expect(panel.find('[data-testid="cand-quick-error"]').exists()).toBe(true)
    expect(api.createCandidate).not.toHaveBeenCalled()
    await panel.get('[data-testid="cand-quick-name"]').setValue('Yangi Nomzod')
    await panel.get('[data-testid="cand-quick-note"]').setValue('Namangan')
    await panel.get('form[data-testid="candidate-quick"]').trigger('submit')
    await flushPromises()
    expect(api.createCandidate).toHaveBeenCalledWith({
      fullName: 'Yangi Nomzod',
      birthDate: null,
      targetGrade: null,
      parentPhone: null,
      notes: 'Namangan',
    })
    expect(api.addParticipants).toHaveBeenCalledWith('e1', { candidateIds: ['n9'] })
    // yangi nomzod ro'yxatga tushdi
    expect(panel.find('[data-testid="cand-n9"]').exists()).toBe(true)
    // oddiy (kirish bo'lmagan) imtihonda nomzod bo'limi yo'q
    const plain = mount(Panel, {
      props: { session: session(), meta },
      global: { plugins: [pinia, i18n] },
    })
    await flushPromises()
    expect(plain.find('[data-testid="candidate-quick"]').exists()).toBe(false)
    plain.unmount()
  })
})
