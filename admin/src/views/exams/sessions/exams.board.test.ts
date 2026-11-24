import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type { ExamSession, ExamSessionParticipant, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const api = {
  getSession: vi.fn(),
  sessionMeta: vi.fn(),
  sessionAttempts: vi.fn(),
  sessionLive: vi.fn(),
  sessionResults: vi.fn(),
  warnParticipant: vi.fn(),
  terminateParticipant: vi.fn(),
  grantTime: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import SessionDetailView from './SessionDetailView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mounted: VueWrapper[] = []
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement

const part = (key: string, cls: string | null, over: Partial<ExamSessionParticipant> = {}) =>
  ({
    key,
    kind: 'student',
    fullName: `Ism ${key}`,
    className: cls,
    grade: 7,
    origin: null,
    hasPin: true,
    hasCode: true,
    fullTimeGranted: false,
    extraMinutes: 0,
    ...over,
  }) as ExamSessionParticipant

const session = (over: Partial<ExamSession> = {}): ExamSession =>
  ({
    id: 'e1',
    title: 'Sinov',
    type: 'quiz',
    status: 'open',
    phase: 'running',
    subjectId: 'math',
    subjectName: 'Matematika',
    classes: [{ id: 'c1', name: '7-A' }],
    scheduledStart: '2026-12-01T05:00:00.000Z',
    durationMin: 40,
    endsAt: '2099-12-01T05:40:00.000Z',
    code: '123456',
    resultsMode: 'score',
    supervisors: [],
    approval: { status: 'none', reason: '', at: null },
    createdByName: 'Ali',
    canEdit: false,
    canSubmit: false,
    canApprove: false,
    canManageParticipants: false,
    canGrant: true,
    canOpen: false,
    canClose: true,
    canCancel: false,
    canPrint: false,
    canDelete: false,
    canReopen: false,
    canExtend: true,
    canMonitor: true,
    canIntervene: true,
    canViewResults: false,
    canCopy: false,
    canReturnToDraft: false,
    hasAttempts: false,
    timeUp: false,
    participants: [part('k1', '7-A'), part('k2', '7-A'), part('k3', '7-B')],
    blocks: [],
    ...over,
  }) as unknown as ExamSession

const liveItem = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  fullName: `Ism ${key}`,
  className: '7-A',
  kind: 'student',
  status: 'in_progress',
  answered: 5,
  total: 20,
  block: null,
  deadline: new Date(Date.now() + 25 * 60_000).toISOString(),
  lastSeenAt: new Date().toISOString(),
  leaves: 0,
  leaveDetail: { blur: 0, fullscreen: 0, hidden: 0 },
  lastLeaveAt: null,
  warningsSent: 0,
  warningsPending: 0,
  terminated: null,
  allowReentry: false,
  ...over,
})
const liveResp = (items: unknown[], over: Record<string, unknown> = {}) => ({
  serverNow: new Date().toISOString(),
  session: { id: 'e1', status: 'open' },
  canIntervene: true,
  staleAfterSec: 60,
  items,
  joinAlert: { failures: 0, lastAt: null, alertAt: null },
  ...over,
})

async function mountView(role: 'school_admin' | 'teacher' = 'school_admin') {
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
      { path: '/exams/sessions/:id', name: 'cur', component: SessionDetailView },
      { path: '/exams/sessions', name: 'exam-sessions', component: empty },
      { path: '/exams/sessions/:id/edit', name: 'exam-session-edit', component: empty },
      { path: '/exams/sessions/:id/results', name: 'exam-session-results', component: empty },
    ],
  })
  await router.push('/exams/sessions/e1')
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    { global: { plugins: [pinia, i18n, router] }, attachTo: document.body },
  )
  mounted.push(w)
  await flushPromises()
  return { w, router }
}
const tiles = (w: VueWrapper) => w.findAll('[data-testid="student-tile"]')
const names = (w: VueWrapper) => w.findAll('[data-testid="tile-name"]').map((x) => x.text())
const clickIn = async (w: VueWrapper, id: string) => {
  await w.get(`[data-testid="${id}"]`).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  Object.values(api).forEach((f) => f.mockReset())
  api.sessionMeta.mockResolvedValue({ pinSecretConfigured: true, isAdministration: true })
  api.getSession.mockResolvedValue(session())
  api.sessionAttempts.mockResolvedValue({
    items: [],
    joinAlert: { failures: 0, lastAt: null, alertAt: null },
  })
  api.sessionLive.mockImplementation(async () =>
    liveResp([
      liveItem('k1'),
      liveItem('k2', { leaves: 2, leaveDetail: { blur: 2, fullscreen: 0, hidden: 0 } }),
      liveItem('k3', { className: '7-B', status: 'submitted' }),
    ]),
  )
  api.sessionResults.mockRejectedValue(new Error('yo`q'))
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Taxta: filtr raqamlari va tanlov', () => {
  it('Paytida: kataklar filtr (aria-pressed), yig`indilar mos; filtr tanlansa ro`yxat torayadi', async () => {
    const { w } = await mountView()
    const v = (k: string) => w.get(`[data-testid="stat-${k}"] [data-testid="stat-value"]`).text()
    expect(['all', 'problem', 'solving', 'submitted', 'notStarted'].map(v)).toEqual([
      '3',
      '1',
      '2',
      '1',
      '0',
    ])
    expect(w.find('[data-testid="stat-terminated"]').exists()).toBe(false)
    expect(Number(v('solving')) + Number(v('submitted')) + Number(v('notStarted'))).toBe(
      Number(v('all')),
    )
    expect(w.get('[data-testid="stat-all"]').attributes('aria-pressed')).toBe('true')
    // muammoli birinchi
    expect(names(w)[0]).toBe('Ism k2')
    await clickIn(w, 'stat-problem')
    expect(w.get('[data-testid="stat-problem"]').attributes('aria-pressed')).toBe('true')
    expect(names(w)).toEqual(['Ism k2'])
    await clickIn(w, 'stat-submitted')
    expect(names(w)).toEqual(['Ism k3'])
  })

  it('tanlov filtr/qidiruvdan keyin ko`rinmay qolganlarni tashlaydi; sinf belgisi faqat ko`rinadiganlarni tanlaydi', async () => {
    const { w } = await mountView()
    const checks = () => w.findAll('[data-testid="tile-check"]')
    expect(checks()).toHaveLength(3)
    await checks()[0]!.setValue(true)
    await checks()[1]!.setValue(true)
    expect(w.get('[data-testid="sel-count"]').text()).toBe('2 ta tanlandi')
    // "Muammoli" filtri "k1" ni yashiradi: tanlov 1 taga kamayadi
    await w.get('[data-testid="bulk-clear"]').trigger('click')
    await checks()[0]!.setValue(true)
    await checks()[1]!.setValue(true)
    await clickIn(w, 'stat-problem')
    expect(w.get('[data-testid="sel-count"]').text()).toBe('1 ta tanlandi')
    await w.get('[data-testid="bulk-clear"]').trigger('click')
    expect(w.find('[data-testid="sel-count"]').exists()).toBe(false)
    // faqat "k2" ko'rinadi: sinf belgisi faqat uni tanlaydi (7-A dagi "k1" emas)
    await w.get('[data-testid="section-check"]').setValue(true)
    expect(w.get('[data-testid="sel-count"]').text()).toBe('1 ta tanlandi')
    await clickIn(w, 'stat-all')
    expect(w.get('[data-testid="sel-count"]').text()).toBe('1 ta tanlandi')
    expect(
      w
        .findAll('[data-testid="tile-check"]')
        .filter((c) => (c.element as HTMLInputElement).checked),
    ).toHaveLength(1)
  })

  it('ommaviy ogohlantirish: faqat yechayotganlarga, ketma-ket; hisobot', async () => {
    api.warnParticipant.mockResolvedValue({})
    const { w } = await mountView()
    for (const c of w.findAll('[data-testid="tile-check"]')) await c.setValue(true)
    await clickIn(w, 'bulk-warn')
    expect($('warn-only-solving')).not.toBeNull() // k3 topshirgan
    ;($('warn-preset-p1') as HTMLElement).click()
    await flushPromises()
    ;($('warn-send') as HTMLElement).click()
    await flushPromises()
    expect(api.warnParticipant.mock.calls.map((c) => c[1]).sort()).toEqual(['k1', 'k2'])
    expect(w.find('[data-testid="sel-count"]').exists()).toBe(false)
  })

  it('ommaviy vaqt: sessiya qayta o`qiladi va har kimga mutlaq qiymat yuboriladi', async () => {
    api.grantTime.mockResolvedValue({})
    api.getSession.mockResolvedValue(
      session({
        participants: [
          part('k1', '7-A', { extraMinutes: 10 }),
          part('k2', '7-A'),
          part('k3', '7-B'),
        ],
      }),
    )
    const { w } = await mountView()
    const checks = w.findAll('[data-testid="tile-check"]')
    await checks[0]!.setValue(true)
    await checks[1]!.setValue(true)
    api.getSession.mockClear()
    await clickIn(w, 'bulk-grant')
    const inp = $('bulk-grant-minutes') as HTMLInputElement
    inp.value = '15'
    inp.dispatchEvent(new Event('input'))
    await flushPromises()
    ;($('bulk-grant-confirm') as HTMLElement).click()
    await flushPromises()
    expect(api.getSession).toHaveBeenCalled()
    const sent = Object.fromEntries(api.grantTime.mock.calls.map((c) => [c[1], c[2].extraMinutes]))
    expect(sent).toEqual({ k1: 25, k2: 15 })
  })

  it('ommaviy to`xtatish qisman xato: yiqilgan o`quvchi tanlovda qoladi', async () => {
    api.terminateParticipant
      .mockResolvedValueOnce({ score: { earned: 1, max: 2 } })
      .mockRejectedValueOnce(
        new ApiError('CONFLICT', 'x', 409, [{ path: '', message: 'topshirgan' }]),
      )
    const { w } = await mountView()
    const checks = w.findAll('[data-testid="tile-check"]')
    await checks[0]!.setValue(true)
    await checks[1]!.setValue(true)
    await clickIn(w, 'bulk-stop')
    const ta = $('stop-reason') as HTMLTextAreaElement
    ta.value = 'Sabab'
    ta.dispatchEvent(new Event('input'))
    await flushPromises()
    ;($('stop-confirm') as HTMLElement).click()
    await flushPromises()
    expect($('bulk-result')).not.toBeNull()
    expect(w.get('[data-testid="sel-count"]').text()).toBe('1 ta tanlandi')
  })

  it('ruxsat yo`q (canIntervene va canGrant yo`q): belgilar ham yo`q', async () => {
    api.getSession.mockResolvedValue(session({ canIntervene: false, canGrant: false }))
    const { w } = await mountView()
    expect(tiles(w)).toHaveLength(3)
    expect(w.find('[data-testid="tile-check"]').exists()).toBe(false)
    expect(w.find('[data-testid="section-check"]').exists()).toBe(false)
  })
})

describe('Taxta: o`quvchi paneli', () => {
  it('katak bosilsa panel ochiladi; ogohlantirish paneldan; Esc yopadi; 5 s yangilanish panelni yopmaydi', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    api.warnParticipant.mockResolvedValue({})
    const { w } = await mountView()
    await w.findAll('[data-testid="tile-open"]')[0]!.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect($('student-drawer').getAttribute('aria-modal')).toBe('true')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.sessionLive.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect($('student-drawer')).not.toBeNull()
    ;($('live-warn') as HTMLElement).click()
    await vi.advanceTimersByTimeAsync(0)
    ;($('warn-preset-p2') as HTMLElement).click()
    await vi.advanceTimersByTimeAsync(0)
    ;($('warn-send') as HTMLElement).click()
    await vi.advanceTimersByTimeAsync(0)
    expect(api.warnParticipant).toHaveBeenCalledTimes(1)
    expect(api.warnParticipant.mock.calls[0]![1]).toBe('k2')
    $('student-drawer').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await vi.advanceTimersByTimeAsync(0)
    expect($('student-drawer')).toBeNull()
  })
})

describe('Taxta: sinf bo`limlari', () => {
  const classed = (n: number) =>
    session({
      canIntervene: false,
      canGrant: false,
      canMonitor: false,
      participants: Array.from({ length: n * 2 }, (_, i) =>
        part(`p${i}`, `${7 + Math.floor(i / 2)}-A`),
      ),
    })

  it('1 sinf: to`liq kenglik; 2 va 3 sinf: lg da ikki ustun', async () => {
    api.getSession.mockResolvedValue(classed(1))
    const a = await mountView()
    expect(a.w.findAll('[data-testid="class-section"]')).toHaveLength(1)
    expect(a.w.get('[data-testid="class-grid"]').classes()).not.toContain('lg:grid-cols-2')
    expect(a.w.get('[data-testid="class-section"] > div.grid').classes()).toContain(
      'xl:grid-cols-4',
    )
    while (mounted.length) mounted.pop()!.unmount()
    for (const n of [2, 3]) {
      api.getSession.mockResolvedValue(classed(n))
      const b = await mountView()
      expect(b.w.findAll('[data-testid="class-section"]')).toHaveLength(n)
      expect(b.w.get('[data-testid="class-grid"]').classes()).toContain('lg:grid-cols-2')
      expect(b.w.get('[data-testid="class-section"] > div.grid').classes()).toContain('grid-cols-2')
      while (mounted.length) mounted.pop()!.unmount()
    }
  })

  it('sinfsiz nomzod va mehmon: alohida bo`limlarda, qayerdan kelgani bilan', async () => {
    api.getSession.mockResolvedValue(
      session({
        canMonitor: false,
        canIntervene: false,
        canGrant: false,
        participants: [
          part('k1', '7-A'),
          part('c1', null, { kind: 'candidate', origin: 'Kirish 2027', fullName: 'Nomzod Bir' }),
          part('g1', null, { kind: 'guest', origin: '5-maktab', fullName: 'Mehmon Bir' }),
        ],
      }),
    )
    const { w } = await mountView()
    // hujjat tartibida (ko'p ildizli komponentda findAll tartibi boshqacha bo'lishi mumkin)
    expect(w.exists()).toBe(true)
    const secs = [...document.body.querySelectorAll('[data-testid="class-section"]')]
    const q = (el: Element, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent
    expect(secs.map((s) => s.getAttribute('data-section'))).toEqual(['7-A', 'candidate', 'guest'])
    expect(q(secs[1]!, 'section-title')).toBe('Nomzodlar')
    expect(q(secs[2]!, 'section-title')).toBe('Mehmonlar')
    expect(q(secs[1]!, 'tile-origin')?.trim()).toBe('Kirish 2027')
    expect(q(secs[2]!, 'tile-origin')?.trim()).toBe('5-maktab')
  })

  it('ishtirokchi yo`q: bo`sh holat xabari', async () => {
    api.getSession.mockResolvedValue(session({ participants: [], canMonitor: false }))
    const { w } = await mountView()
    expect(w.find('[data-testid="participants-empty"]').exists()).toBe(true)
  })
})

describe('Ma`lumot oqimi: so`rovlar', () => {
  it('canMonitor: faqat sessionLive (5 s), sessionAttempts umuman chaqirilmaydi', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    await mountView()
    await vi.advanceTimersByTimeAsync(16_000)
    expect(api.sessionLive.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(api.sessionAttempts).not.toHaveBeenCalled()
  })

  it('canMonitor=false: sessionAttempts har 15 s, sessionLive yo`q', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    api.getSession.mockResolvedValue(session({ canMonitor: false }))
    await mountView()
    expect(api.sessionAttempts).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(api.sessionAttempts).toHaveBeenCalledTimes(2)
    expect(api.sessionLive).not.toHaveBeenCalled()
  })

  it('jonli so`rov xatosi sahifani buzmaydi: xabar chiqadi, kataklar qoladi', async () => {
    api.sessionLive.mockRejectedValue(new ApiError('INTERNAL', 'xato', 500))
    const { w } = await mountView()
    expect(w.find('[data-testid="live-error"]').exists()).toBe(true)
    expect(tiles(w)).toHaveLength(3)
  })

  it('jonli javobdagi holat o`zgarsa (yopilgan) sessiya qayta yuklanadi', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    await mountView()
    const before = api.getSession.mock.calls.length
    api.sessionLive.mockResolvedValue(liveResp([], { session: { id: 'e1', status: 'closed' } }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.getSession.mock.calls.length).toBeGreaterThan(before)
  })

  it('yopilgan: natijalar bir marta yuklanadi, polling yo`q; natija xatosi sahifani buzmaydi', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    api.getSession.mockResolvedValue(
      session({ status: 'closed', canMonitor: false, canViewResults: true, canIntervene: false }),
    )
    const { w } = await mountView()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.sessionResults).toHaveBeenCalledTimes(1)
    expect(api.sessionLive).not.toHaveBeenCalled()
    // natija xatosida urinishlar bir marta zaxira sifatida yuklanadi (polling yo'q)
    expect(api.sessionAttempts).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="results-error"]').exists()).toBe(true)
    expect(tiles(w)).toHaveLength(3)
  })
})

describe('Keyin bosqichi va varaqlar', () => {
  const resultsResp = () => ({
    session: { passPercent: 50, resultsMode: 'after_publish', resultsPublished: false },
    blocks: [{ id: 'b1', subjectName: 'Matematika', title: 'M' }],
    summary: { averagePercent: 60, maxPercent: 90, passPercent: 50, essayPending: 0 },
    rows: [
      ['k1', 90, true],
      ['k2', 30, false],
    ].map(([key, p, ok]) => ({
      key,
      status: 'submitted',
      earned: p,
      max: 100,
      percent: p,
      passed: ok,
      answered: 5,
      total: 5,
      essayPending: 0,
      blocks: [{ blockId: 'b1', earned: p, max: 100 }],
    })),
  })

  it('taqsimot (10 ustun) va fanlar kartochkasi o`quvchilar ustida; filtr katakchalari o`tdi/o`tmadi', async () => {
    api.sessionResults.mockResolvedValue(resultsResp())
    api.getSession.mockResolvedValue(
      session({ status: 'closed', canMonitor: false, canViewResults: true, canIntervene: false }),
    )
    const { w } = await mountView()
    expect(w.findAll('[data-testid="dist-bar"]')).toHaveLength(10)
    expect(w.get('[data-testid="subject-avg"]').text()).toContain('Matematika')
    const v = (k: string) => w.get(`[data-testid="stat-${k}"] [data-testid="stat-value"]`).text()
    expect([v('all'), v('passed'), v('failed'), v('notSubmitted')]).toEqual(['3', '1', '1', '1'])
    await clickIn(w, 'stat-failed')
    expect(names(w)).toEqual(['Ism k2'])
    // e'lon qilish: after_publish va e'lon qilinmagan
    expect(w.find('[data-testid="act-publish"]').exists()).toBe(true)
  })

  it('natijani ko`rish ruxsati yo`q: taqsimot yo`q', async () => {
    api.getSession.mockResolvedValue(
      session({ status: 'closed', canMonitor: false, canViewResults: false, canIntervene: false }),
    )
    const { w } = await mountView()
    expect(w.find('[data-testid="results-insights"]').exists()).toBe(false)
  })

  it('eski (blokisiz) imtihonda "Fanlar" varag`i yo`q; blokli oldin bosqichida birinchi varaq "Fanlar"', async () => {
    api.getSession.mockResolvedValue(session({ canMonitor: false }))
    const a = await mountView()
    expect(a.w.findAll('[role="tab"]').map((x) => x.attributes('data-testid'))).toEqual([
      'tab-students',
      'tab-info',
    ])
    while (mounted.length) mounted.pop()!.unmount()
    const block = {
      id: 'b1',
      legacy: false,
      subjectName: 'Fizika',
      title: 'Fizika',
      targetCount: 10,
      coefficient: 1,
      status: 'open',
      readyBy: null,
      count: 1,
      contributors: [],
    }
    api.getSession.mockResolvedValue(
      session({ status: 'scheduled', canMonitor: false, blocks: [block] as never }),
    )
    const b = await mountView()
    expect(b.w.findAll('[role="tab"]').map((x) => x.attributes('data-testid'))).toEqual([
      'tab-subjects',
      'tab-students',
      'tab-info',
    ])
    expect(b.w.find('[data-testid="subjects-panel"]').exists()).toBe(true)
    // "Boshqa varaq": tab bosilganda o'quvchilar chiqadi
    await clickIn(b.w, 'tab-students')
    expect(b.w.find('[data-testid="subjects-panel"]').exists()).toBe(false)
    expect(tiles(b.w)).toHaveLength(3)
  })
})

describe('Yopilgan imtihon: natijalar yo`q yoki yuklanmoqda', () => {
  const closed = (over: Partial<ExamSession> = {}) =>
    session({
      status: 'closed',
      canMonitor: false,
      canIntervene: false,
      canViewResults: false,
      ...over,
    })
  const val = (w: VueWrapper, k: string) =>
    w.get(`[data-testid="stat-${k}"] [data-testid="stat-value"]`).text()

  it('natija ko`rish ruxsati yo`q: Topshirdi/Topshirmagan urinishlar holatidan hisoblanadi', async () => {
    api.getSession.mockResolvedValue(closed())
    api.sessionAttempts.mockResolvedValue({
      items: [{ key: 'k1', status: 'submitted', answered: 3, total: 3, warnings: 0 }],
      joinAlert: { failures: 0, lastAt: null, alertAt: null },
    })
    const { w } = await mountView()
    expect(val(w, 'submitted')).toBe('1')
    expect(val(w, 'notSubmitted')).toBe('2')
    const sub = (key: string) => w.get(`[data-key="${key}"] [data-testid="tile-sub"]`).text()
    expect(sub('k1')).toBe(uz.examSessions.live.statuses.submitted)
    expect(sub('k2')).toBe(uz.examBoard.tile.notSubmitted)
  })

  it('natijalar yuklanguncha noto`g`ri son chiqmaydi ("—"), keyin haqiqiy qiymat', async () => {
    let release: (v: unknown) => void = () => undefined
    api.sessionResults.mockImplementation(() => new Promise((r) => (release = r)))
    api.getSession.mockResolvedValue(closed({ canViewResults: true }))
    const { w } = await mountView()
    expect(val(w, 'notSubmitted')).toBe('—')
    expect(val(w, 'submitted')).toBe('—')
    expect(w.get('[data-key="k1"] [data-testid="tile-sub"]').text()).toBe('—')
    release({
      session: { passPercent: null, resultsMode: 'score', resultsPublished: false },
      blocks: [],
      summary: { averagePercent: 64.5, maxPercent: 90 },
      rows: [],
    })
    await flushPromises()
    expect(val(w, 'notSubmitted')).toBe('3')
    expect(val(w, 'average')).toBe('64,5%')
  })

  it('natijalar xatosi: kichik xabar va "Qayta urinish" ishlaydi', async () => {
    api.sessionResults.mockRejectedValueOnce(new Error('x'))
    api.getSession.mockResolvedValue(closed({ canViewResults: true }))
    const { w } = await mountView()
    expect(w.get('[data-testid="results-error"]').text()).toContain(uz.examBoard.resultsError)
    api.sessionResults.mockResolvedValue({
      session: { passPercent: null, resultsMode: 'score', resultsPublished: false },
      blocks: [],
      summary: { averagePercent: 50, maxPercent: 80 },
      rows: [],
    })
    await clickIn(w, 'results-retry')
    expect(w.find('[data-testid="results-error"]').exists()).toBe(false)
    expect(api.sessionResults).toHaveBeenCalledTimes(2)
  })

  it('katak matni: "29,4 / 38 · O`tdi" (ball vergul bilan va natija)', async () => {
    api.sessionResults.mockResolvedValue({
      session: { passPercent: 50, resultsMode: 'score', resultsPublished: false },
      blocks: [],
      summary: { averagePercent: 64.5, maxPercent: 90, passPercent: 50 },
      rows: [
        {
          key: 'k1',
          status: 'submitted',
          earned: 29.4,
          max: 38,
          percent: 77.4,
          passed: true,
          answered: 1,
          total: 1,
          essayPending: 0,
          blocks: [],
        },
      ],
    })
    api.getSession.mockResolvedValue(closed({ canViewResults: true }))
    const { w } = await mountView()
    expect(w.get('[data-key="k1"] [data-testid="tile-sub"]').text()).toBe("29,4 / 38 · O'tdi")
    expect(val(w, 'average')).toBe('64,5%')
  })
})

describe('Bekor qilingan imtihon', () => {
  it('katakda faqat Fanlar, O`quvchilar, Holat; tayyorlik/boshlanishi/qadamlar/vaqt yo`q; kulrang sarlavha', async () => {
    const block = {
      id: 'b1',
      legacy: false,
      subjectName: 'Fizika',
      title: 'Fizika',
      targetCount: 10,
      coefficient: 1,
      status: 'ready',
      readyBy: 'composer',
      count: 10,
      contributors: [],
    }
    api.getSession.mockResolvedValue(
      session({ status: 'cancelled', canMonitor: false, blocks: [block] as never }),
    )
    const { w } = await mountView()
    const keys = w
      .findAll('[data-testid^="stat-"]')
      .map((x) => x.attributes('data-testid'))
      .filter((x) => x !== 'stat-value' && x !== 'stat-strip')
    expect(keys).toEqual(['stat-subjects', 'stat-students', 'stat-status'])
    expect(w.get('[data-testid="stat-status"]').text()).toContain(uz.examSessions.status.cancelled)
    expect(w.find('[data-testid="stat-readiness"]').exists()).toBe(false)
    expect(w.find('[data-testid="stat-startsIn"]').exists()).toBe(false)
    expect(w.get('[data-testid="exam-hero"]').attributes('style')).toContain('rgb(71, 85, 105)')
    expect(w.find('[data-testid="stage-bar"]').exists()).toBe(false)
    expect(w.find('[data-testid="time-card"]').exists()).toBe(false)
    expect(w.find('[data-testid="blocks-panel"]').exists()).toBe(true)
  })
})

describe('Sarlavha kodi va katak belgilari', () => {
  it('kod kesilmaydigan chip (meta dan tashqarida); bosilsa nusxalanadi va toast chiqadi', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { w } = await mountView()
    const chip = w.get('[data-testid="hero-code"]')
    expect(chip.text()).toContain('123456')
    expect(chip.classes()).toContain('whitespace-nowrap')
    expect(w.get('[data-testid="hero-meta"]').text()).not.toContain('123456')
    await chip.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('123456')
    const { useToast } = await import('@/composables/useToast')
    expect(JSON.stringify(useToast().toasts)).toContain(uz.examBoard.codeCopied)
  })

  it('katakda shaxsiy qolgan vaqt yo`q; faqat farqli vaqtda "+25 daq" / "To`liq vaqt" belgisi', async () => {
    api.getSession.mockResolvedValue(
      session({
        participants: [
          part('k1', '7-A', { extraMinutes: 25 }),
          part('k2', '7-A', { fullTimeGranted: true }),
          part('k3', '7-B'),
        ],
      }),
    )
    const { w } = await mountView()
    for (const t of w.findAll('[data-testid="tile-sub"]')) expect(t.text()).not.toMatch(/\d+:\d\d/)
    expect(w.get('[data-key="k1"] [data-testid="tile-extra"]').text()).toBe('+25 daq')
    expect(w.get('[data-key="k2"] [data-testid="tile-extra"]').text()).toBe(
      uz.examBoard.tile.fullTime,
    )
    expect(w.find('[data-key="k3"] [data-testid="tile-extra"]').exists()).toBe(false)
  })

  it('sarlavha taymeri har soniyada yangilanadi', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    api.getSession.mockResolvedValue(
      session({ canMonitor: false, endsAt: new Date(Date.now() + 3_600_000).toISOString() }),
    )
    const { w } = await mountView()
    const t1 = w.get('[data-testid="hero-timer"]').text()
    await vi.advanceTimersByTimeAsync(1000)
    expect(w.get('[data-testid="hero-timer"]').text()).not.toBe(t1)
  })
})

describe('Imtihon almashganda holat tozalanadi', () => {
  it('id o`zgarsa panel, tanlov, qidiruv, filtr va varaq tozalanadi', async () => {
    api.getSession.mockImplementation(async (id: string) =>
      session({ id, title: id === 'e2' ? 'Ikkinchi' : 'Sinov' }),
    )
    const { w, router } = await mountView()
    await w.get('[data-testid="board-search"]').setValue('Ism')
    await clickIn(w, 'stat-solving')
    await w.findAll('[data-testid="tile-check"]')[0]!.setValue(true)
    await w.findAll('[data-testid="tile-open"]')[0]!.trigger('click')
    await flushPromises()
    expect($('student-drawer')).not.toBeNull()
    await router.push('/exams/sessions/e2')
    await flushPromises()
    expect(w.get('[data-testid="hero-title"]').text()).toBe('Ikkinchi')
    expect($('student-drawer')).toBeNull()
    expect(w.find('[data-testid="sel-count"]').exists()).toBe(false)
    expect((w.get('[data-testid="board-search"]').element as HTMLInputElement).value).toBe('')
    expect(w.get('[data-testid="stat-all"]').attributes('aria-pressed')).toBe('true')
  })

  it('eski imtihonning kechikkan javobi yangisini bosib ketmaydi', async () => {
    let release: (v: unknown) => void = () => undefined
    api.getSession.mockImplementation((id: string) =>
      id === 'e1'
        ? new Promise((r) => (release = r))
        : Promise.resolve(session({ id: 'e2', title: 'Ikkinchi' })),
    )
    const { w, router } = await mountView()
    await router.push('/exams/sessions/e2')
    await flushPromises()
    expect(w.get('[data-testid="hero-title"]').text()).toBe('Ikkinchi')
    release(session({ id: 'e1', title: 'Birinchi' }))
    await flushPromises()
    expect(w.get('[data-testid="hero-title"]').text()).toBe('Ikkinchi')
  })
})
