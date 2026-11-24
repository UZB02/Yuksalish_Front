import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { ExamSession, ExamSessionMeta, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

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
  submitSession: vi.fn(),
  myBlocks: vi.fn(),
  previewBlocks: vi.fn(),
  rejectSession: vi.fn(),
  cancelSession: vi.fn(),
  removeSession: vi.fn(),
  downloadPinSheet: vi.fn(),
  sessionAttempts: vi.fn(),
  sessionLive: vi.fn(),
  reopenSession: vi.fn(),
  extendSession: vi.fn(),
  allowReentry: vi.fn(),
  grantTime: vi.fn(),
  regeneratePin: vi.fn(),
  removeParticipant: vi.fn(),
  listSessions: vi.fn(),
  listCandidates: vi.fn(),
  getCandidate: vi.fn(),
  candidateResults: vi.fn(),
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
/** Sarlavhadagi ⋮ menyuni ochib, amal elementini qaytaradi (menyu yoki element bo'lmasa null) */
const menuItem = async (key: string) => {
  const trigger = $('menu-trigger')
  if (!trigger) return null
  if (!$('menu-panel')) await click(trigger)
  return $(`menu-item-${key}`)
}
/** O'quvchi katagini bosib o'ng panelni ochadi */
const openDrawer = async (w: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) => {
  await w.get('[data-testid="tile-open"]').trigger('click')
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
  canReopen: false,
  canExtend: false,
  canMonitor: false,
  canIntervene: false,
  canViewResults: false,
  timeUp: false,
  passPercent: null,
  resultsPublished: false,
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
      { path: '/exams/sessions/:id/results', name: 'exam-session-results', component: empty },
      { path: '/exams/sessions/:id/edit', name: 'exam-session-edit', component: empty },
      { path: '/exams/topics/:topicId', name: 'exam-topic', component: empty },
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

const mounted: { unmount: () => void }[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
})

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.clearAllMocks()
  api.sessionMeta.mockResolvedValue(meta())
  api.subjects.mockResolvedValue({ scope: 'own', subjects: [{ id: 'math', name: 'Matematika' }] })
  api.listTopics.mockResolvedValue({
    subject: { id: 'math', name: 'Matematika', isActive: true },
    topics: [{ id: 'tp1', name: 'Kasrlar', questionsCount: 5 }],
  })
  api.listTemplates.mockResolvedValue([])
  api.myBlocks.mockResolvedValue([])
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

  it('saqlash xatosi: server sababi ko`rsatiladi va tegishli qadamga qaytariladi', async () => {
    api.previewSections.mockResolvedValue({
      sections: [{ title: 'B', items: [{ kind: 'manual', available: 1, requested: 1, ok: true }] }],
      errors: [],
      poolSize: 1,
      questionsPerParticipant: 1,
      ok: true,
    })
    const { ApiError } = await import('@/api/errors')
    api.createSession
      .mockRejectedValueOnce(
        new ApiError('VALIDATION_ERROR', 'x', 400, [
          {
            path: 'supervisorIds',
            message: 'Faqat shu maktabning faol xodimlarini tanlash mumkin',
          },
        ]),
      )
      .mockRejectedValueOnce(
        new ApiError('VALIDATION_ERROR', 'x', 400, [
          { path: 'sections.0.items.0', message: 'Savol boshqa fanga tegishli' },
        ]),
      )
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
    await w.get('[data-testid="wz-start"]').setValue('2099-01-01T10:00')
    await w.get('[data-testid="wz-duration"]').setValue('45')
    await next(w)
    await flushPromises()
    // Vaqt qadamidagi maydon: shu qadamda qoladi, sabab toast'da
    expect(JSON.stringify(useToast().toasts)).toContain('faol xodimlarini tanlash mumkin')
    expect(w.find('[data-testid="step-time"]').exists()).toBe(true)
    await next(w)
    await flushPromises()
    // Savollar xatosi: savollar qadamiga qaytariladi
    expect(JSON.stringify(useToast().toasts)).toContain('Savol boshqa fanga tegishli')
    expect(w.find('[data-testid="step-questions"]').exists()).toBe(true)
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
    // sarlavha bor, savollar yo'q: birinchi to'ldirilmagan qadam (2)
    expect(w.find('[data-testid="step-questions"]').exists()).toBe(true)
    await w.get('[data-testid="wz-back"]').trigger('click')
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
    // Bosqich guruhlari: "Tayyorlanmoqda" (tasdiq kutayotgan) oldin, "Rejalashtirilgan" keyin
    expect(rows[0]!.get('[data-testid="session-status"]').text()).toBe(
      uz.examSessions.status.pending_approval,
    )
    expect(w.find('[data-testid="sessions-group-preparing"]').text()).toContain('Tayyorlanmoqda')
    expect(w.find('[data-testid="sessions-group-scheduled"]').text()).toContain('Rejalashtirilgan')
    expect(w.find('[data-testid="sessions-group-past"]').exists()).toBe(false)
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
  /** Oldingi o'rnatilgan nusxa (va uning oynalari) olib tashlanadi: `$` so'rovlari aniq bo'lsin */
  const at = async (role: 'teacher' | 'school_admin' = 'school_admin') => {
    while (mounted.length) mounted.pop()!.unmount()
    return mountView(SessionDetailView, '/exams/sessions/e1', role, '/exams/sessions/:id')
  }

  it('jonli kuzatuv: faqat canMonitor bo`lganda jonli so`rov yuboriladi va katak holati unga ko`ra', async () => {
    api.sessionLive.mockResolvedValue({
      serverNow: new Date().toISOString(),
      session: {
        id: 'e1',
        title: 'T',
        status: 'open',
        timingMode: 'common',
        scheduledStart: new Date().toISOString(),
        endsAt: new Date().toISOString(),
      },
      canIntervene: true,
      staleAfterSec: 60,
      counts: {
        total: 1,
        notStarted: 0,
        joined: 0,
        inProgress: 1,
        submitted: 0,
        terminated: 0,
        warned: 0,
        withLeaves: 0,
      },
      items: [
        {
          key: 'k1',
          fullName: 'Aliyev Vali',
          className: '7-A',
          kind: 'student',
          status: 'in_progress',
          answered: 2,
          total: 4,
          lastSeenAt: new Date().toISOString(),
          leaves: 0,
          leaveDetail: { blur: 0, fullscreen: 0, hidden: 0 },
          lastLeaveAt: null,
          deadline: null,
          block: null,
          warningsSent: 0,
          warningsPending: 0,
          terminated: null,
          allowReentry: false,
        },
      ],
      joinAlert: { failures: 0, lastAt: null, alertAt: null },
    })
    api.getSession.mockResolvedValue(session({ status: 'open', canMonitor: false }))
    const a = await at()
    expect(api.sessionLive).not.toHaveBeenCalled()
    expect(a.w.get('[data-testid="student-tile"]').attributes('data-phase')).toBe('not_started')
    api.getSession.mockResolvedValue(
      session({ status: 'open', canMonitor: true, canIntervene: true }),
    )
    const { w } = await at()
    await flushPromises()
    expect(api.sessionLive).toHaveBeenCalledWith('e1')
    expect(w.find('[data-testid="live-monitor"]').exists()).toBe(false)
    expect(w.get('[data-testid="student-tile"]').attributes('data-phase')).toBe('in_progress')
  })

  it('PIN holati ko`rsatiladi, PIN o`zi hech qachon', async () => {
    const { w } = await at()
    await openDrawer(w)
    expect($('pin-status').textContent?.trim()).toBe(
      'PIN: ' + uz.examSessions.participants.pinReady.toLowerCase(),
    )
    expect(document.body.textContent).not.toMatch(/pinEnc|pinHash/)
    // Imtihon kodi: sarlavhada (rejalashtirilgan) va "Ma'lumot" bo'limida
    expect(w.get('[data-testid="hero-code"]').text()).toContain('123456')
    await w.get('[data-testid="tab-info"]').trigger('click')
    expect(w.get('[data-testid="detail-code"]').text()).toBe('123456')
  })

  it('PIN kartochkalarini chop etish API ni chaqiradi (hammasi va sinf bo`yicha)', async () => {
    api.downloadPinSheet.mockResolvedValue('pin.pdf')
    const { w } = await at()
    // Rejalashtirilgan imtihonda "Kartochkalarni chop etish" asosiy tugma; oyna sinf tanlashni beradi
    await w.get('[data-testid="act-print"]').trigger('click')
    await flushPromises()
    await click($('print-pins'))
    expect(api.downloadPinSheet).toHaveBeenLastCalledWith('e1', undefined)
    await w.get('[data-testid="act-print"]').trigger('click')
    await flushPromises()
    const sel = $('print-class') as HTMLSelectElement
    sel.value = '7-A'
    sel.dispatchEvent(new Event('change'))
    await flushPromises()
    await click($('print-pins'))
    expect(api.downloadPinSheet).toHaveBeenLastCalledWith('e1', '7-A')
  })

  it('chop etish canPrint=false bo`lsa tugma ham, menyu elementi ham yo`q (qoralama)', async () => {
    api.getSession.mockResolvedValue(session({ status: 'draft', canPrint: false, code: null }))
    const { w } = await at()
    expect(w.find('[data-testid="act-print"]').exists()).toBe(false)
    expect(await menuItem('print')).toBeNull()
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
    await openDrawer(a.w)
    expect($('grant-open')).toBeNull()
    api.getSession.mockResolvedValue(session({ canGrant: true }))
    const { w } = await at('school_admin')
    await openDrawer(w)
    await click($('grant-open'))
    await click($('grant-full').querySelector('button'))
    await setIn('grant-extra', '10')
    await click($('grant-confirm'))
    expect(api.grantTime).toHaveBeenCalledWith('e1', 'k1', { fullTime: true, extraMinutes: 10 })
  })

  it('urinishlar: holat, javoblar soni, ogohlantirishlar va kirish urinishlari ogohlantirishi; qayta kirishga ruxsat', async () => {
    api.getSession.mockResolvedValue(session({ status: 'open', canClose: true }))
    api.sessionAttempts.mockResolvedValue({
      items: [
        {
          key: 'k1',
          status: 'in_progress',
          answered: 3,
          total: 6,
          startedAt: null,
          submittedAt: null,
          deadline: null,
          lastSeenAt: null,
          warnings: 4,
          reconnects: 1,
          allowReentry: false,
        },
      ],
      joinAlert: { failures: 210, lastAt: null, alertAt: '2026-12-01T05:00:00.000Z' },
    })
    api.allowReentry.mockResolvedValue({ allowReentry: true })
    const { w } = await at('school_admin')
    // canMonitor=false: jonli so'rov yo'q, urinishlar so'rovi ishlaydi
    expect(api.sessionLive).not.toHaveBeenCalled()
    expect(w.get('[data-testid="student-tile"]').attributes('data-phase')).toBe('in_progress')
    expect(w.get('[data-testid="join-alert"]').text()).toContain('210')
    await openDrawer(w)
    expect($('drawer-phase').textContent?.trim()).toBe(uz.examSessions.live.statuses.in_progress)
    expect($('drawer-answers').textContent?.trim()).toBe('3 / 6 javob')
    expect($('live-leaves-count').textContent).toContain('4')
    const c = useConfirm()
    await click($('allow-reentry'))
    expect(c.state.open).toBe(true)
    c.settle(true)
    await flushPromises()
    expect(api.allowReentry).toHaveBeenCalledWith('e1', 'k1')
  })

  it('urinishlar yuklanmasa katak holatsiz (kirmagan) ko`rinadi, sahifa buzilmaydi', async () => {
    api.getSession.mockResolvedValue(session({ status: 'open' }))
    api.sessionAttempts.mockRejectedValue(new Error('x'))
    const { w } = await at('school_admin')
    expect(w.get('[data-testid="student-tile"]').attributes('data-phase')).toBe('not_started')
    expect(w.find('[data-testid="join-alert"]').exists()).toBe(false)
  })

  it('Natijalar: yopilganda asosiy tugma (canViewResults ga bog`liq), boshqa holatda menyuda; natijalar sahifasiga o`tadi', async () => {
    api.getSession.mockResolvedValue(session({ canViewResults: false }))
    const a = await at('school_admin')
    expect(a.w.find('[data-testid="act-results"]').exists()).toBe(false)
    expect(await menuItem('results')).toBeNull()
    api.getSession.mockResolvedValue(session({ canViewResults: true }))
    const b = await at('school_admin')
    expect(b.w.find('[data-testid="act-results"]').exists()).toBe(false)
    expect(await menuItem('results')).not.toBeNull()
    api.getSession.mockResolvedValue(session({ status: 'closed', canViewResults: true }))
    const { w, router } = await at('school_admin')
    await router.isReady()
    await w.get('[data-testid="act-results"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-session-results')
  })

  it('"Vaqti tugagan" belgisi faqat timeUp bo`lganda', async () => {
    api.getSession.mockResolvedValue(session({ status: 'open', timeUp: false }))
    expect((await at('school_admin')).w.find('[data-testid="time-up"]').exists()).toBe(false)
    api.getSession.mockResolvedValue(session({ status: 'open', timeUp: true }))
    const { w } = await at('school_admin')
    expect(w.get('[data-testid="time-up"]').text()).toBe(uz.examSessions.detail.timeUp)
    expect(w.get('[data-testid="detail-status"]').text()).toBe(uz.examSessions.status.open)
  })

  it('Qayta ochish: faqat canReopen; sabab va kelajakdagi vaqt majburiy; yangi kod haqida xabar', async () => {
    api.getSession.mockResolvedValue(session({ status: 'closed', canReopen: false }))
    await at('school_admin')
    expect(await menuItem('reopen')).toBeNull()
    api.getSession.mockResolvedValue(session({ status: 'closed', canReopen: true }))
    api.reopenSession.mockResolvedValue({
      ...session({ status: 'open', code: '654321' }),
      codeChanged: true,
    })
    await at('school_admin')
    await click(await menuItem('reopen'))
    await click($('reopen-confirm'))
    expect(api.reopenSession).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(uz.examSessions.errors.reasonRequired)
    await setIn('reopen-reason', 'Internet uzilgan')
    await setIn('reopen-end', '2020-01-01T10:00')
    await click($('reopen-confirm'))
    expect(document.body.textContent).toContain(uz.examSessions.errors.newEndPast)
    expect(api.reopenSession).not.toHaveBeenCalled()
    await setIn('reopen-end', '2099-01-01T10:00')
    await click($('reopen-confirm'))
    expect(api.reopenSession).toHaveBeenCalledWith('e1', {
      reason: 'Internet uzilgan',
      newEnd: '2099-01-01T10:00:00+05:00',
    })
    expect(JSON.stringify(useToast().toasts)).toContain('654321')
  })

  it('Hammaga vaqt qo`shish: faqat canExtend; 1..180 tekshiriladi', async () => {
    api.getSession.mockResolvedValue(session({ status: 'open', canExtend: false }))
    expect((await at('school_admin')).w.find('[data-testid="act-extend"]').exists()).toBe(false)
    api.getSession.mockResolvedValue(session({ status: 'open', canExtend: true }))
    api.extendSession.mockResolvedValue(session({ status: 'open' }))
    const { w } = await at('school_admin')
    await w.get('[data-testid="act-extend"]').trigger('click')
    await flushPromises()
    await setIn('extend-minutes', '500')
    await click($('extend-confirm'))
    expect(api.extendSession).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(uz.examSessions.errors.minutesRange)
    await setIn('extend-minutes', '20')
    await setIn('extend-reason', 'Nosozlik')
    await click($('extend-confirm'))
    expect(api.extendSession).toHaveBeenCalledWith('e1', { minutes: 20, reason: 'Nosozlik' })
  })

  it('PIN ni yangilash tasdiq bilan', async () => {
    api.regeneratePin.mockResolvedValue({ regenerated: true })
    const { w } = await at('school_admin')
    const c = useConfirm()
    await openDrawer(w)
    await click($('regen-pin'))
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

  it('nomzod natijalari: "Imtihonlar" tugmasi oynada yakunlangan imtihonlarni ko`rsatadi', async () => {
    api.listCandidates.mockResolvedValue(page([cand()]))
    api.candidateResults.mockResolvedValue({
      items: [
        {
          sessionId: 'e1',
          title: 'Kirish imtihoni',
          heldAt: '2026-11-25T04:00:00.000Z',
          closedAt: null,
          subjects: ['Matematika'],
          scoringMode: 'points',
          passPercent: 50,
          earned: 18,
          max: 30,
          percent: 60,
          passed: true,
          essayPending: 0,
          blocks: [],
          examDeleted: false,
        },
      ],
      summary: { count: 1, averagePercent: 60, passedCount: 1 },
    })
    const { w } = await mountView(CandidatesView, '/exams/candidates', 'school_admin')
    await w.get('[data-testid="candidate-results"]').trigger('click')
    await flushPromises()
    expect(api.candidateResults).toHaveBeenCalledWith('n1')
    expect($('exam-title').textContent).toBe('Kirish imtihoni')
    expect($('exam-total').textContent?.trim()).toBe('18 / 30 · 60%')
    expect($('exam-passed').textContent?.trim()).toBe("O'tdi")
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

describe('Usta: avtosaqlash, tiklash va chiqishdan himoya', () => {
  const KEY = 'exam.wizard.v2:u1:s1:new'
  const validDraft = (over: Record<string, unknown> = {}) => ({
    v: 2,
    savedAt: new Date().toISOString(),
    step: 2,
    form: {
      type: 'quiz',
      title: 'Saqlangan nazorat',
      subjectId: 'math',
      classIds: ['c1'],
      templateId: '',
      mode: 'sections',
      sections: [{ title: 'B', items: [{ kind: 'manual', questionIds: ['q1'] }] }],
      blocks: [],
      scoringMode: 'points',
      timingMode: 'common',
      contribDeadline: '',
      start: '2099-01-01T10:00',
      durationMin: '45',
      shuffleQuestions: true,
      shuffleOptions: false,
      resultsMode: 'score',
      passPercent: '60',
      supervisorIds: [],
    },
    ...over,
  })
  const seed = (d: unknown, key = KEY) =>
    localStorage.setItem(key, typeof d === 'string' ? d : JSON.stringify(d))
  const stored = (key = KEY) =>
    localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)!) : null

  it('o`zgarishlar 500 ms debounce bilan qadam va maydonlar bilan saqlanadi', async () => {
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    expect(stored()).toBeNull() // o'zgarishsiz yozilmaydi
    await w.get('[data-testid="wz-title"]').setValue('Yangi nazorat')
    await w.get('[data-testid="wz-class-c1"] input').setValue(true)
    expect(stored()).toBeNull() // debounce
    await sleep(650)
    expect(stored()).toMatchObject({
      v: 2,
      step: 0,
      form: { title: 'Yangi nazorat', classIds: ['c1'] },
    })
    await w.get('[data-testid="wz-next"]').trigger('click')
    await sleep(650)
    expect(stored().step).toBe(1)
    // asl holatga qaytsa yozuv o'chadi
    await w.get('[data-testid="wz-back"]').trigger('click')
    await w.get('[data-testid="wz-title"]').setValue('')
    await w.get('[data-testid="wz-class-c1"] input').setValue(false)
    await sleep(650)
    expect(stored()).toBeNull()
  })

  it('saqlangan qoralama bor: banner; "Davom ettirish" qadam va maydonlarni tiklaydi', async () => {
    seed(validDraft())
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    expect(w.get('[data-testid="resume-banner"]').text()).toContain('Saqlangan nazorat')
    expect(w.find('[data-testid="wz-title"]').exists()).toBe(true)
    await w.get('[data-testid="resume-continue"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="resume-banner"]').exists()).toBe(false)
    expect(w.find('[data-testid="step-time"]').exists()).toBe(true) // 3-qadam (indeks 2)
    expect((w.get('[data-testid="wz-start"]').element as HTMLInputElement).value).toBe(
      '2099-01-01T10:00',
    )
    expect((w.get('[data-testid="wz-duration"]').element as HTMLInputElement).value).toBe('45')
    expect((w.get('[data-testid="wz-pass"]').element as HTMLInputElement).value).toBe('60')
    await w.get('[data-testid="wz-back"]').trigger('click')
    await w.get('[data-testid="wz-back"]').trigger('click')
    expect((w.get('[data-testid="wz-title"]').element as HTMLInputElement).value).toBe(
      'Saqlangan nazorat',
    )
  })

  it('"Yangidan boshlash" mahalliy qoralamani o`chiradi', async () => {
    seed(validDraft())
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    await w.get('[data-testid="resume-discard"]').trigger('click')
    expect(w.find('[data-testid="resume-banner"]').exists()).toBe(false)
    expect(stored()).toBeNull()
    expect((w.get('[data-testid="wz-title"]').element as HTMLInputElement).value).toBe('')
  })

  it('buzilgan, eski versiya, muddati o`tgan yoki noto`g`ri tuzilmali ma`lumot e`tiborsiz qoldiriladi va o`chiriladi', async () => {
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString()
    const cases: unknown[] = [
      '{not json',
      validDraft({ v: 0 }),
      validDraft({ v: 99 }),
      validDraft({ savedAt: old }),
      validDraft({ step: 9 }),
      { v: 1, savedAt: new Date().toISOString(), step: 1, form: { title: 5 } },
      // Eski (1) versiya: blok maydonlari yo'q, jimgina tashlanadi
      validDraft({ v: 1 }),
      validDraft({ form: { ...validDraft().form, mode: 'x' } }),
      validDraft({ form: { ...validDraft().form, blocks: [{ subjectId: 5 }] } }),
      validDraft({ form: { ...validDraft().form, sections: [{ title: 1, items: [] }] } }),
    ]
    for (const c of cases) {
      localStorage.clear()
      seed(c)
      const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
      expect(w.find('[data-testid="resume-banner"]').exists(), JSON.stringify(c).slice(0, 60)).toBe(
        false,
      )
      expect(localStorage.getItem(KEY)).toBeNull()
      w.unmount()
    }
  })

  it('boshqa foydalanuvchi/maktab kaliti ostidagi qoralama ko`rinmaydi', async () => {
    seed(validDraft(), 'exam.wizard.v2:other-user:s1:new')
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    expect(w.find('[data-testid="resume-banner"]').exists()).toBe(false)
  })

  it('chiqishdan himoya: o`zgarish bo`lsa tasdiq so`raladi (Qolish/Chiqish); o`zgarishsiz so`ralmaydi', async () => {
    const { w, router } = await mountView(SessionWizardView, '/exams/sessions/new')
    await router.push('/exams/sessions')
    await flushPromises()
    expect(useConfirm().state.open).toBe(false) // o'zgarish yo'q
    await router.push('/exams/sessions/new')
    await flushPromises()
    const w2 = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router, i18n] }, attachTo: document.body },
    )
    await flushPromises()
    void w
    await w2.get('[data-testid="wz-title"]').setValue('Yozilgan')
    const nav = router.push('/exams/sessions')
    await flushPromises()
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    expect(c.state.options.message).toContain('Imtihon hali saqlanmagan')
    c.settle(false) // Qolish
    await nav
    expect(router.currentRoute.value.path).toBe('/exams/sessions/new')
    const nav2 = router.push('/exams/sessions')
    await flushPromises()
    c.settle(true) // Chiqish
    await nav2
    expect(router.currentRoute.value.path).toBe('/exams/sessions')
    await sleep(100)
    expect(stored()).toMatchObject({ form: { title: 'Yozilgan' } }) // chiqishda mahalliy nusxa saqlanib qoladi
  })

  it('beforeunload: o`zgarish bo`lsa ogohlantiradi', async () => {
    const { w } = await mountView(SessionWizardView, '/exams/sessions/new')
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    await w.get('[data-testid="wz-title"]').setValue('X')
    const dirtyEv = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEv)
    expect(dirtyEv.defaultPrevented).toBe(true)
  })

  it('server qoralamasini tahrirlash: qadam (ishtirokchi yo`q -> 4-qadam, bor -> tekshirish), PATCH ishlatiladi, POST emas', async () => {
    api.getSession.mockResolvedValue(
      session({
        status: 'draft',
        sections: [{ title: 'B', items: [{ kind: 'manual', questionIds: ['q1'] }] }],
        participants: [],
        code: null,
        canEdit: true,
      }),
    )
    api.updateSession.mockResolvedValue(session({ status: 'draft', participants: [], code: null }))
    const { w } = await mountView(
      SessionWizardView,
      '/exams/sessions/e1/edit',
      'teacher',
      '/exams/sessions/:id/edit',
    )
    expect(api.getSession).toHaveBeenCalledWith('e1')
    expect(w.find('[data-testid="step-participants"]').exists()).toBe(true)
    expect(w.find('[data-testid="resume-banner"]').exists()).toBe(false)
    await w.get('[data-testid="wz-back"]').trigger('click') // vaqt
    await w.get('[data-testid="wz-duration"]').setValue('50')
    await w.get('[data-testid="wz-next"]').trigger('click')
    await flushPromises()
    expect(api.updateSession).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ durationMin: 50, title: 'Nazorat 1' }),
    )
    expect(api.createSession).not.toHaveBeenCalled()
    // ishtirokchi bor -> tekshirish qadami
    api.getSession.mockResolvedValue(
      session({
        status: 'draft',
        sections: [{ title: 'B', items: [{ kind: 'manual', questionIds: ['q1'] }] }],
        code: null,
      }),
    )
    const m = await mountView(
      SessionWizardView,
      '/exams/sessions/e1/edit',
      'teacher',
      '/exams/sessions/:id/edit',
    )
    expect(m.w.find('[data-testid="step-review"]').exists()).toBe(true)
  })

  it('tahrirlash: mahalliy (yangiroq) o`zgarishlar server ma`lumotlari ustidan tiklanadi; yuborilgach tozalanadi', async () => {
    api.getSession.mockResolvedValue(session({ status: 'draft', code: null }))
    api.submitSession.mockResolvedValue(session({ status: 'scheduled' }))
    seed(
      validDraft({ step: 4, form: { ...validDraft().form, title: 'Mahalliy sarlavha' } }),
      'exam.wizard.v2:u1:s1:e1',
    )
    const { w } = await mountView(
      SessionWizardView,
      '/exams/sessions/e1/edit',
      'teacher',
      '/exams/sessions/:id/edit',
    )
    expect(w.find('[data-testid="step-review"]').exists()).toBe(true)
    expect(w.get('[data-testid="step-review"]').text()).toContain('Mahalliy sarlavha')
    expect(JSON.stringify(useToast().toasts)).toContain('tiklandi')
    await w.get('[data-testid="wz-submit"]').trigger('click')
    await flushPromises()
    expect(api.submitSession).toHaveBeenCalledWith('e1')
    await sleep(700)
    expect(stored('exam.wizard.v2:u1:s1:e1')).toBeNull()
    expect(stored()).toBeNull()
  })

  it('qoralama emas sessiya tahrirlanmaydi: tafsilotga yo`naltiriladi', async () => {
    api.getSession.mockResolvedValue(session({ status: 'scheduled' }))
    const { router } = await mountView(
      SessionWizardView,
      '/exams/sessions/e1/edit',
      'teacher',
      '/exams/sessions/:id/edit',
    )
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-session')
  })

  it('ro`yxatda qoralama qatori "Davom ettirish": usta tahrirlash rejimida ochiladi', async () => {
    api.listSessions.mockResolvedValue({
      items: [
        session({ id: 'd1', status: 'draft', title: 'Qoralama imtihon', code: null }),
        session({ id: 'e2' }),
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
    const { w, router } = await mountView(SessionsView, '/exams/sessions')
    const rows = w.findAll('[data-testid="session-row"]')
    expect(rows[0]!.find('[data-testid="session-resume"]').text()).toBe('Davom ettirish')
    expect(rows[1]!.find('[data-testid="session-resume"]').exists()).toBe(false)
    await rows[0]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-session-edit')
    expect(router.currentRoute.value.params.id).toBe('d1')
  })
})
