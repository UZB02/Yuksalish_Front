import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { ExamSession, ExamSessionMeta, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'

const api = {
  sessionMeta: vi.fn(),
  subjects: vi.fn(),
  listTopics: vi.fn(),
  listTemplates: vi.fn(),
  classOptions: vi.fn(),
  classStudents: vi.fn(),
  previewSections: vi.fn(),
  listQuestions: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSession: vi.fn(),
  addParticipants: vi.fn(),
  sessionAction: vi.fn(),
  rejectSession: vi.fn(),
  cancelSession: vi.fn(),
  removeSession: vi.fn(),
  downloadPinSheet: vi.fn(),
  grantTime: vi.fn(),
  regeneratePin: vi.fn(),
  removeParticipant: vi.fn(),
  listSessions: vi.fn(),
  listCandidates: vi.fn(),
  getCandidate: vi.fn(),
  createCandidate: vi.fn(),
  updateCandidate: vi.fn(),
  removeCandidate: vi.fn(),
  createTemplate: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import CandidatesView from './CandidatesView.vue'
import SessionDetailView from './SessionDetailView.vue'
import SessionWizardView from './SessionWizardView.vue'
import SessionsView from './SessionsView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const setIn = async (id: string, v: string) => {
  const el = $(id) as HTMLInputElement
  el.value = v
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
const click = async (el: Element | null) => {
  ;(el as HTMLElement).click()
  await flushPromises()
}

const meta = (over: Partial<ExamSessionMeta> = {}): ExamSessionMeta => ({
  pinSecretConfigured: true,
  isAdministration: false,
  teachersCanCreateQuizzes: true,
  teacherQuizNeedsApproval: false,
  allowedTypes: ['quiz'],
  supervisors: [{ id: 'u2', fullName: 'Nazoratchi Bir', role: 'teacher' }],
  ...over,
})

const session = (over: Partial<ExamSession> = {}): ExamSession => ({
  id: 'e1',
  title: 'Nazorat 1',
  type: 'quiz',
  status: 'scheduled',
  phase: 'upcoming',
  subjectId: 'math',
  subjectName: 'Matematika',
  classes: [{ id: 'c1', name: '7-A' }],
  scheduledStart: '2026-12-01T05:00:00.000Z',
  durationMin: 40,
  endsAt: '2026-12-01T05:40:00.000Z',
  code: '123456',
  resultsMode: 'score',
  shuffleQuestions: true,
  shuffleOptions: true,
  participantsCount: 1,
  supervisors: [],
  approval: { status: 'none', reason: '', at: null },
  pool: { frozen: true, frozenAt: null },
  createdBy: 'u1',
  createdByName: 'Ali',
  isMine: true,
  cancelReason: '',
  createdAt: '2026-11-01T00:00:00.000Z',
  canEdit: false,
  canSubmit: false,
  canApprove: false,
  canManageParticipants: true,
  canGrant: false,
  canOpen: true,
  canClose: true,
  canCancel: true,
  canPrint: true,
  canDelete: false,
  templateId: null,
  sections: [],
  participants: [
    {
      key: 'k1',
      kind: 'student',
      fullName: 'Aliyev Vali',
      className: '7-A',
      grade: 7,
      origin: null,
      hasPin: true,
      fullTimeGranted: false,
      extraMinutes: 0,
    },
  ],
  ...over,
})

async function mountView(
  comp: unknown,
  path: string,
  role: 'teacher' | 'school_admin' = 'teacher',
  routePath = path.split('?')[0]!,
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
      { path: '/exams/topics/:topicId', name: 'exam-topic', component: empty },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    { global: { plugins: [pinia, i18n, router] }, attachTo: document.body },
  )
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  api.sessionMeta.mockResolvedValue(meta())
  api.subjects.mockResolvedValue({ scope: 'own', subjects: [{ id: 'math', name: 'Matematika' }] })
  api.listTopics.mockResolvedValue({
    subject: { id: 'math', name: 'Matematika', isActive: true },
    topics: [{ id: 'tp1', name: 'Kasrlar', questionsCount: 5 }],
  })
  api.listTemplates.mockResolvedValue([])
  api.classOptions.mockResolvedValue([{ id: 'c1', name: '7-A', grade: 7, studentsCount: 25 }])
  api.classStudents.mockResolvedValue([{ id: 's1', fullName: 'Aliyev Vali' }])
  api.previewSections.mockResolvedValue({
    sections: [{ title: 'B', items: [{ kind: 'rule', available: 3, requested: 5, ok: false }] }],
    errors: ['yetarli emas'],
    poolSize: 3,
    questionsPerParticipant: 5,
    ok: false,
  })
  api.listQuestions.mockResolvedValue({
    items: [
      { id: 'q1', preview: 'Birinchi savol', difficulty: 1, type: 'single', points: 1 },
      { id: 'q2', preview: 'Ikkinchi savol', difficulty: 2, type: 'short', points: 1 },
    ],
    meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
  })
  api.getSession.mockResolvedValue(session())
})

describe('SessionWizardView (imtihon yaratish ustasi)', () => {
  const next = (w: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) =>
    w.get('[data-testid="wz-next"]').trigger('click')

  it('1-qadam: nom va (o`qituvchi uchun) sinf majburiy', async () => {
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    await next(w)
    expect(w.text()).toContain(uz.examSessions.errors.titleRequired)
    expect(w.find('[data-testid="err-classes"]').text()).toBe(
      uz.examSessions.errors.classesRequired,
    )
    expect(w.find('[data-testid="step-basic"]').exists()).toBe(true)
    // faqat 'quiz' turi beriladi
    expect(w.find('[data-testid="wz-type"]').text()).toContain(uz.examSessions.type.quiz)
    expect(w.find('[data-testid="wz-type"]').text()).not.toContain(uz.examSessions.type.quarter)
  })

  it('2-qadam: qoida mavjud savollar sonini ko`rsatadi; yetmasa keyingi qadam bloklanadi', async () => {
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    await w.get('[data-testid="wz-title"]').setValue('Nazorat')
    await w.get('[data-testid="wz-class-c1"] input').setValue(true)
    await next(w)
    expect(w.find('[data-testid="step-questions"]').exists()).toBe(true)
    // bo'limsiz
    await next(w)
    expect(w.find('[data-testid="err-sections"]').text()).toBe(
      uz.examSessions.errors.sectionsIncomplete,
    )
    await w.get('[data-testid="add-section"]').trigger('click')
    await w.get('[data-testid="add-rule-0"]').trigger('click')
    await w.get('[data-testid="rule-count-0-0"]').setValue('5')
    await sleep(450)
    await flushPromises()
    expect(api.previewSections).toHaveBeenCalled()
    const info = w.get('[data-testid="item-info-0-0"]')
    expect(info.text()).toBe('Mavjud: 3, kerak: 5')
    expect(w.get('[data-testid="preview-errors"]').text()).toContain('yetarli emas')
    await next(w)
    expect(w.find('[data-testid="err-sections"]').text()).toBe(
      uz.examSessions.errors.sectionsInvalid,
    )
    expect(api.createSession).not.toHaveBeenCalled()
  })

  it('faol yetmasa qoralama soni va mavzuni ochib faollashtirish havolasi ko`rinadi', async () => {
    api.previewSections.mockResolvedValue({
      sections: [
        {
          title: 'B',
          items: [
            { kind: 'rule', available: 0, requested: 5, ok: false, draft: 20, topicId: 'tp1' },
          ],
        },
      ],
      errors: ['Qoralamada 20 ta savol bor: mavzuni ochib faollashtiring'],
      poolSize: 0,
      questionsPerParticipant: 5,
      ok: false,
    })
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    await w.get('[data-testid="wz-title"]').setValue('Nazorat')
    await w.get('[data-testid="wz-class-c1"] input').setValue(true)
    await next(w)
    await w.get('[data-testid="add-section"]').trigger('click')
    await w.get('[data-testid="add-rule-0"]').trigger('click')
    await sleep(450)
    await flushPromises()
    expect(w.get('[data-testid="item-info-0-0"]').text()).toBe(
      'Faol: 0 ta (20 ta qoralamada), kerak: 5',
    )
    const link = w.get('[data-testid="activate-link-0-0"]')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('href')).toContain('/topics/tp1')
    expect(link.text()).toBe(uz.examSessions.rule.activateLink)
    expect(w.get('[data-testid="preview-errors"]').text()).toContain('Qoralamada 20 ta')
  })

  it('qo`lda tanlash: savollar tanlanadi va soni ko`rinadi', async () => {
    api.previewSections.mockResolvedValue({
      sections: [{ title: 'B', items: [{ kind: 'manual', available: 2, requested: 2, ok: true }] }],
      errors: [],
      poolSize: 2,
      questionsPerParticipant: 2,
      ok: true,
    })
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    await w.get('[data-testid="wz-title"]').setValue('Nazorat')
    await w.get('[data-testid="wz-class-c1"] input').setValue(true)
    await next(w)
    await w.get('[data-testid="add-section"]').trigger('click')
    await w.get('[data-testid="add-manual-0"]').trigger('click')
    await w.get('[data-testid="manual-pick-0-0"]').trigger('click')
    await flushPromises()
    expect(api.listQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: 'tp1', status: 'active' }),
    )
    await click($('pick-q1').querySelector('input'))
    await click($('pick-q2').querySelector('input'))
    expect($('picker-count').textContent?.trim()).toBe('Tanlangan: 2')
    await click($('picker-confirm'))
    await sleep(450)
    await flushPromises()
    expect(w.get('[data-testid="manual-count-0-0"]').text()).toBe('2 ta tanlangan')
    expect(w.get('[data-testid="item-info-0-0"]').text()).toContain('2 / 2')
    await next(w)
    expect(w.find('[data-testid="step-time"]').exists()).toBe(true)
  })

  it('3-qadam: o`tmishdagi vaqt va noto`g`ri davomiylik rad etiladi; to`g`risida qoralama saqlanadi', async () => {
    api.previewSections.mockResolvedValue({
      sections: [{ title: 'B', items: [{ kind: 'manual', available: 1, requested: 1, ok: true }] }],
      errors: [],
      poolSize: 1,
      questionsPerParticipant: 1,
      ok: true,
    })
    api.createSession.mockResolvedValue(session({ status: 'draft', participants: [], code: null }))
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    await w.get('[data-testid="wz-title"]').setValue('Nazorat')
    await w.get('[data-testid="wz-class-c1"] input').setValue(true)
    await next(w)
    await w.get('[data-testid="add-section"]').trigger('click')
    await w.get('[data-testid="add-manual-0"]').trigger('click')
    await w.get('[data-testid="manual-pick-0-0"]').trigger('click')
    await flushPromises()
    await click($('pick-q1').querySelector('input'))
    await click($('picker-confirm'))
    await sleep(450)
    await flushPromises()
    await next(w)
    await w.get('[data-testid="wz-start"]').setValue('2020-01-01T10:00')
    await w.get('[data-testid="wz-duration"]').setValue('2')
    await next(w)
    expect(w.text()).toContain(uz.examSessions.errors.startPast)
    expect(w.text()).toContain(uz.examSessions.errors.durationRange)
    expect(api.createSession).not.toHaveBeenCalled()
    await w.get('[data-testid="wz-start"]').setValue('2099-01-01T10:00')
    await w.get('[data-testid="wz-duration"]').setValue('45')
    await next(w)
    await flushPromises()
    expect(api.createSession).toHaveBeenCalledTimes(1)
    const body = api.createSession.mock.calls[0]![0]
    expect(body).toMatchObject({
      title: 'Nazorat',
      type: 'quiz',
      classIds: ['c1'],
      durationMin: 45,
      scheduledStart: '2099-01-01T10:00:00+05:00',
    })
    // 4-qadam: ishtirokchi yo'q -> keyingi bloklanadi
    expect(w.find('[data-testid="step-participants"]').exists()).toBe(true)
    await next(w)
    expect(w.find('[data-testid="err-participants"]').text()).toBe(
      uz.examSessions.errors.participantsRequired,
    )
  })

  it('mavjud qoralama tahrirlash uchun yuklanadi', async () => {
    api.getSession.mockResolvedValue(session({ status: 'draft', participants: [], code: null }))
    api.addParticipants.mockResolvedValue({ added: 1, skipped: 0, total: 1 })
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new?id=e1')
    // qoralama id bilan ochiladi va maydonlar to'ldiriladi
    expect(api.getSession).toHaveBeenCalledWith('e1')
    expect((w.get('[data-testid="wz-title"]').element as HTMLInputElement).value).toBe('Nazorat 1')
  })

  it('imtihon turlari bo`sh bo`lsa (o`qituvchiga ruxsat yo`q) usta ochilmaydi', async () => {
    api.sessionMeta.mockResolvedValue(meta({ allowedTypes: [], teachersCanCreateQuizzes: false }))
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    expect(w.find('[data-testid="wizard-forbidden"]').exists()).toBe(true)
    expect(w.find('[data-testid="wz-next"]').exists()).toBe(false)
  })
})

describe('SessionsView (ro`yxat)', () => {
  const list = (items: unknown[]) => ({
    items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  })

  it('qatorlar holat belgisi bilan; "Yangi imtihon" tugmasi ruxsatga bog`liq', async () => {
    api.listSessions.mockResolvedValue(
      list([session(), session({ id: 'e2', status: 'pending_approval', title: 'Ikkinchi' })]),
    )
    const { w } = await mountView(SessionsView, '/exams/sessions', 'teacher')
    const rows = w.findAll('[data-testid="session-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]!.get('[data-testid="session-status"]').text()).toBe(
      uz.examSessions.status.pending_approval,
    )
    expect(w.find('[data-testid="session-create"]').exists()).toBe(true)
  })

  it('teachersCanCreateQuizzes o`chiq: yaratish tugmasi yo`q; PIN sozlanmagan ogohlantirish faqat ma`muriyatga', async () => {
    api.listSessions.mockResolvedValue(list([]))
    api.sessionMeta.mockResolvedValue(meta({ allowedTypes: [], pinSecretConfigured: false }))
    const a = await mountView(SessionsView, '/exams/sessions', 'teacher')
    expect(a.w.find('[data-testid="session-create"]').exists()).toBe(false)
    expect(a.w.find('[data-testid="pin-secret-warning"]').exists()).toBe(false)
    expect(a.w.find('[data-testid="sessions-empty"]').exists()).toBe(true)
    api.sessionMeta.mockResolvedValue(
      meta({
        isAdministration: true,
        allowedTypes: ['quiz', 'quarter'],
        pinSecretConfigured: false,
      }),
    )
    const b = await mountView(SessionsView, '/exams/sessions', 'school_admin')
    expect(b.w.find('[data-testid="pin-secret-warning"]').exists()).toBe(true)
  })

  it('holat filtri so`rovga uzatiladi', async () => {
    api.listSessions.mockResolvedValue(list([]))
    const { w } = await mountView(SessionsView, '/exams/sessions', 'teacher')
    await w.get('[data-testid="filter-status"]').setValue('open')
    await flushPromises()
    expect(api.listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'open', page: 1 }),
    )
  })
})

describe('SessionDetailView (imtihon sahifasi)', () => {
  const at = (role: 'teacher' | 'school_admin' = 'school_admin') =>
    mountView(SessionDetailView, '/exams/sessions/e1', role, '/exams/sessions/:id')

  it('PIN holati ko`rsatiladi, PIN o`zi hech qachon', async () => {
    const { w } = await at()
    expect(w.get('[data-testid="pin-status"]').text()).toBe(uz.examSessions.participants.pinReady)
    expect(w.text()).not.toMatch(/pinEnc|pinHash/)
    expect(w.get('[data-testid="detail-code"]').text()).toBe('123456')
  })

  it('PIN kartochkalarini chop etish API ni chaqiradi (hammasi va sinf bo`yicha)', async () => {
    api.downloadPinSheet.mockResolvedValue('pin.pdf')
    const { w } = await at()
    await w.get('[data-testid="print-pins"]').trigger('click')
    await flushPromises()
    expect(api.downloadPinSheet).toHaveBeenLastCalledWith('e1', undefined)
    await w.get('[data-testid="print-class"]').setValue('7-A')
    await w.get('[data-testid="print-pins"]').trigger('click')
    await flushPromises()
    expect(api.downloadPinSheet).toHaveBeenLastCalledWith('e1', '7-A')
  })

  it('chop etish bloki canPrint=false bo`lsa ko`rinmaydi (qoralama)', async () => {
    api.getSession.mockResolvedValue(session({ status: 'draft', canPrint: false, code: null }))
    const { w } = await at()
    expect(w.find('[data-testid="print-block"]').exists()).toBe(false)
  })

  it('tasdiq: faqat canApprove da tugmalar; rad etishda sabab majburiy', async () => {
    api.getSession.mockResolvedValue(
      session({
        status: 'pending_approval',
        canApprove: true,
        canOpen: false,
        canPrint: false,
        code: null,
        approval: { status: 'pending', reason: '', at: null },
      }),
    )
    api.rejectSession.mockResolvedValue(session({ status: 'draft' }))
    api.sessionAction.mockResolvedValue(session())
    const { w } = await at('school_admin')
    expect(w.find('[data-testid="pending-note"]').exists()).toBe(true)
    await w.get('[data-testid="act-reject"]').trigger('click')
    await flushPromises()
    await click($('reject-confirm'))
    expect(api.rejectSession).not.toHaveBeenCalled()
    await setIn('reject-reason', 'Savollar kam')
    await click($('reject-confirm'))
    expect(api.rejectSession).toHaveBeenCalledWith('e1', 'Savollar kam')
    await w.get('[data-testid="act-approve"]').trigger('click')
    await flushPromises()
    expect(api.sessionAction).toHaveBeenCalledWith('e1', 'approve')
  })

  it('o`qituvchi tasdiqlash tugmalarini ko`rmaydi', async () => {
    api.getSession.mockResolvedValue(session({ status: 'pending_approval', canApprove: false }))
    const { w } = await at('teacher')
    expect(w.find('[data-testid="act-approve"]').exists()).toBe(false)
    expect(w.find('[data-testid="act-reject"]').exists()).toBe(false)
  })

  it('rad etilgan qoralamada sabab ko`rinadi', async () => {
    api.getSession.mockResolvedValue(
      session({
        status: 'draft',
        canEdit: true,
        code: null,
        approval: { status: 'rejected', reason: 'Kam savol', at: null },
      }),
    )
    const { w } = await at('teacher')
    expect(w.get('[data-testid="rejected-note"]').text()).toContain('Kam savol')
  })

  it('individual vaqt: faqat canGrant da; saqlash API ga to`g`ri maydonlarni yuboradi', async () => {
    api.grantTime.mockResolvedValue({})
    const a = await at('teacher')
    expect(a.w.find('[data-testid="grant-open"]').exists()).toBe(false)
    api.getSession.mockResolvedValue(session({ canGrant: true }))
    const { w } = await at('school_admin')
    await w.get('[data-testid="grant-open"]').trigger('click')
    await flushPromises()
    await click($('grant-full').querySelector('button'))
    await setIn('grant-extra', '10')
    await click($('grant-confirm'))
    expect(api.grantTime).toHaveBeenCalledWith('e1', 'k1', { fullTime: true, extraMinutes: 10 })
  })

  it('PIN ni yangilash tasdiq bilan', async () => {
    api.regeneratePin.mockResolvedValue({ regenerated: true })
    const { w } = await at('school_admin')
    const c = useConfirm()
    await w.get('[data-testid="regen-pin"]').trigger('click')
    await flushPromises()
    expect(c.state.open).toBe(true)
    c.settle(true)
    await flushPromises()
    expect(api.regeneratePin).toHaveBeenCalledWith('e1', 'k1')
  })
})

describe('CandidatesView (nomzodlar)', () => {
  const cand = (over = {}) => ({
    id: 'n1',
    fullName: 'Nomzod Bir',
    targetGrade: 1,
    birthDate: null,
    hasBirthDate: true,
    parentPhone: '+99890*****67',
    notes: '',
    piiPurged: false,
    createdAt: '2026-11-01',
    ...over,
  })
  const page = (items: unknown[]) => ({
    items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  })

  it('ro`yxatda telefon maskalangan; tahrirlashda to`liq ma`lumot so`raladi', async () => {
    api.listCandidates.mockResolvedValue(page([cand()]))
    api.getCandidate.mockResolvedValue(
      cand({ parentPhone: '+998901234567', birthDate: '2014-05-06T00:00:00.000Z' }),
    )
    const { w } = await mountView(CandidatesView, '/exams/candidates', 'school_admin')
    expect(w.get('[data-testid="candidate-phone"]').text()).toBe('+99890*****67')
    await w.get('[data-testid="candidate-edit"]').trigger('click')
    await flushPromises()
    expect(api.getCandidate).toHaveBeenCalledWith('n1')
    expect(($('cand-phone') as HTMLInputElement).value).toBe('+998901234567')
    expect(($('cand-birth') as HTMLInputElement).value).toBe('2014-05-06')
  })

  it('yaratish validatsiyasi: ism, sinf, telefon', async () => {
    api.listCandidates.mockResolvedValue(page([]))
    api.createCandidate.mockResolvedValue(cand())
    const { w } = await mountView(CandidatesView, '/exams/candidates', 'school_admin')
    await w.get('[data-testid="candidate-add"]').trigger('click')
    await flushPromises()
    await setIn('cand-grade', '15')
    await setIn('cand-phone', 'abc')
    await click($('cand-save'))
    const txt = document.body.textContent
    expect(txt).toContain(uz.examCandidates.errors.name)
    expect(txt).toContain(uz.examCandidates.errors.grade)
    expect(txt).toContain(uz.examCandidates.errors.phone)
    expect(api.createCandidate).not.toHaveBeenCalled()
    await setIn('cand-name', 'Yangi Nomzod')
    await setIn('cand-grade', '1')
    await setIn('cand-phone', '+998901234567')
    await click($('cand-save'))
    expect(api.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Yangi Nomzod',
        targetGrade: 1,
        parentPhone: '+998901234567',
      }),
    )
  })
})
