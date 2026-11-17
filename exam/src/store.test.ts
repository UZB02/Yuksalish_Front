import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiError, type ExamApi } from './lib/api'
import type { KeyValueStore } from './lib/queue'
import type { ClientQuestion, JoinResponse, ResultResponse, StartResponse } from './lib/types'
import { STORE_KEY } from './inject'
import { createStore } from './store'
import ConfirmScreen from './components/ConfirmScreen.vue'
import ExamScreen from './components/ExamScreen.vue'
import JoinScreen from './components/JoinScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import ToastHost from './components/ToastHost.vue'

class MemStore implements KeyValueStore {
  data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const T0 = new Date('2026-12-01T10:00:00.000Z').getTime()
const DEADLINE = '2026-12-01T10:40:00.000Z'

const questions: ClientQuestion[] = [
  {
    id: 'q1',
    type: 'single',
    points: 2,
    content: [{ type: 'text', text: 'Birinchi' }],
    options: [
      { id: 'a', content: [{ type: 'text', text: 'Variant A' }] },
      { id: 'b', content: [{ type: 'text', text: 'Variant B' }] },
    ],
  },
  { id: 'q2', type: 'short', points: 1, content: [{ type: 'math', tex: 'x^2' }], options: [] },
  { id: 'q3', type: 'essay', points: 5, content: [{ type: 'text', text: 'Esse' }], options: [] },
]

const joinResp = (over: Partial<JoinResponse> = {}): JoinResponse => ({
  token: 'tok-1',
  serverNow: new Date(T0).toISOString(),
  attemptStatus: 'joined',
  participant: { fullName: 'Aliyev Bobur', className: '7-A' },
  exam: {
    title: 'Nazorat',
    type: 'quiz',
    durationMin: 40,
    questionCount: 3,
    resultsMode: 'score',
    startsAt: new Date(T0).toISOString(),
    endsAt: DEADLINE,
    deadlinePreview: DEADLINE,
    freeNavigation: true,
  },
  ...over,
})
const startResp = (over: Partial<StartResponse> = {}): StartResponse => ({
  serverNow: new Date(T0).toISOString(),
  status: 'in_progress',
  startedAt: new Date(T0).toISOString(),
  deadline: DEADLINE,
  questions,
  saved: [],
  clientSeq: 0,
  ...over,
})
const resultResp = (over: Partial<ResultResponse> = {}): ResultResponse => ({
  status: 'submitted',
  mode: 'score',
  available: true,
  submittedAt: new Date(T0).toISOString(),
  answeredCount: 2,
  total: 3,
  score: { earned: 3, max: 8, autoMax: 3, essayPending: 1 },
  ...over,
})

type MockApi = ExamApi & { [K in keyof ExamApi]: ReturnType<typeof vi.fn> & ExamApi[K] }
function mkApi(over: Record<string, unknown> = {}): MockApi {
  return {
    join: vi.fn().mockResolvedValue(joinResp()),
    start: vi.fn().mockResolvedValue(startResp()),
    state: vi.fn().mockResolvedValue({
      serverNow: new Date(T0).toISOString(),
      status: 'joined',
      startedAt: null,
      deadline: null,
      answeredCount: 0,
      total: 3,
      clientSeq: 0,
    }),
    saveAnswers: vi.fn().mockImplementation(async (b: { clientSeq: number }) => ({
      savedSeq: b.clientSeq,
      answeredCount: 1,
      serverNow: new Date(Date.now()).toISOString(),
    })),
    event: vi.fn().mockResolvedValue({}),
    heartbeat: vi.fn().mockResolvedValue({}),
    submit: vi.fn().mockResolvedValue(resultResp()),
    finishBlock: vi.fn().mockResolvedValue({ finished: true, ...resultResp() }),
    result: vi.fn().mockResolvedValue(resultResp()),
    asset: vi.fn().mockResolvedValue(new Blob(['x'])),
    ...over,
  } as never
}

let storage: MemStore
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  storage = new MemStore()
})
afterEach(() => {
  vi.useRealTimers()
})

const mk = (api: ExamApi) => createStore({ api, storage, now: () => Date.now() })

describe('kirish va tasdiq', () => {
  it('join: token va ma`lumot saqlanadi, tasdiq ekrani; xato xabari', async () => {
    const api = mkApi()
    const s = mk(api)
    await s.init()
    expect(s.state.screen).toBe('join')
    await s.join('123456', 'abc123')
    expect(s.state.screen).toBe('confirm')
    expect(storage.getItem('exam.token')).toBe('tok-1')
    expect(JSON.stringify([...storage.data])).not.toContain('"pin"')
    expect(api.join).toHaveBeenCalledWith({
      code: '123456',
      pin: 'abc123',
      deviceId: expect.stringMatching(/^[a-f0-9]{32}$/),
    })
    // qurilma id qayta ishlatiladi
    const id = storage.getItem('exam.deviceId')
    await mk(api).join('123456', 'abc123')
    expect(storage.getItem('exam.deviceId')).toBe(id)
  })

  it('noto`g`ri kod/PIN: xabar, ekran o`zgarmaydi', async () => {
    const api = mkApi({
      join: vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', "Kod yoki PIN noto'g'ri")),
    })
    const s = mk(api)
    await s.init()
    await s.join('123456', 'xxxx')
    expect(s.state.screen).toBe('join')
    expect(s.state.error).toBe("Kod yoki PIN noto'g'ri")
    expect(storage.getItem('exam.token')).toBeNull()
  })

  it('oyna tugagan: server xabari (tugash vaqti bilan) o`quvchiga ko`rinadi, ekran kirishda qoladi', async () => {
    const msg = 'Imtihon 10:40 da tugagan. Nazoratchiga murojaat qiling.'
    const s = mk(mkApi({ join: vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', msg)) }))
    await s.init()
    await s.join('123456', 'abcd')
    expect(s.state.screen).toBe('join')
    expect(s.state.error).toBe(msg)
    expect(storage.getItem('exam.token')).toBeNull()
  })

  it('internet yo`q: tushunarli xabar', async () => {
    const s = mk(mkApi({ join: vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x')) }))
    await s.init()
    await s.join('123456', 'abcd')
    expect(s.state.error).toMatch(/Internet yo'q/)
  })

  it('allaqachon topshirilgan urinish: darhol natija ekrani', async () => {
    const api = mkApi({ join: vi.fn().mockResolvedValue(joinResp({ attemptStatus: 'submitted' })) })
    const s = mk(api)
    await s.init()
    await s.join('123456', 'abcd')
    expect(s.state.screen).toBe('result')
    expect(api.result).toHaveBeenCalled()
  })
})

describe('imtihon', () => {
  async function started(api = mkApi()) {
    const s = mk(api)
    await s.init()
    await s.join('123456', 'abcd')
    await s.start()
    return { s, api }
  }

  it('boshlash: savollar, deadline va qolgan vaqt server soati bilan (klient soati noto`g`ri bo`lsa ham)', async () => {
    // server soati klientdan 1 soat orqada
    const api = mkApi({
      start: vi.fn().mockResolvedValue(
        startResp({
          serverNow: new Date(T0 - 3_600_000).toISOString(),
          deadline: new Date(T0 - 3_600_000 + 40 * 60_000).toISOString(),
        }),
      ),
    })
    const { s } = await started(api)
    expect(s.state.screen).toBe('exam')
    expect(s.state.questions).toHaveLength(3)
    expect(s.state.remaining).toBe(40 * 60_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(s.state.remaining).toBe(40 * 60_000 - 5_000)
  })

  it('javob: debounce bilan saqlanadi, status Saqlanmoqda -> Saqlandi; resume uchun saved tiklanadi', async () => {
    const { s, api } = await started()
    s.pickOption(questions[0]!, 'b')
    s.setAnswer('q2', '12')
    expect(s.state.saveStatus).toBe('saving')
    await vi.advanceTimersByTimeAsync(1600)
    expect(api.saveAnswers).toHaveBeenCalledTimes(1)
    expect(api.saveAnswers.mock.calls[0]![0]).toMatchObject({ clientSeq: 1 })
    expect(s.state.saveStatus).toBe('saved')
    // yangi store (sahifa qayta ochildi): server saved qaytaradi
    const api2 = mkApi({
      start: vi
        .fn()
        .mockResolvedValue(
          startResp({ saved: [{ id: 'q1', value: 'b', flagged: true }], clientSeq: 5 }),
        ),
    })
    const { s: s2 } = await started(api2)
    expect(s2.state.answers.q1).toEqual({ value: 'b', flagged: true })
  })

  it('"Keyinroq qaytaman" belgisi saqlanadi; erkin yurish', async () => {
    const { s, api } = await started()
    s.goto(2)
    expect(s.state.index).toBe(2)
    s.goto(99)
    expect(s.state.index).toBe(2)
    s.toggleFlag('q3')
    expect(s.state.answers.q3).toEqual({ value: null, flagged: true })
    await vi.advanceTimersByTimeAsync(1600)
    expect(api.saveAnswers.mock.calls[0]![0].answers).toEqual([
      { qid: 'q3', value: null, flagged: true },
    ])
  })

  it('topshirish: oldin navbat yuboriladi, keyin submit; natija ekrani; mahalliy navbat tozalanadi', async () => {
    const { s, api } = await started()
    s.setAnswer('q2', '12')
    const ok = await s.submit(false)
    expect(ok).toBe(true)
    const order = [
      api.saveAnswers.mock.invocationCallOrder[0]!,
      api.submit.mock.invocationCallOrder[0]!,
    ]
    expect(order[0]).toBeLessThan(order[1]!)
    expect(s.state.screen).toBe('result')
    expect(s.state.result?.score?.earned).toBe(3)
    expect([...storage.data.keys()].some((k) => k.startsWith('exam.q.'))).toBe(false)
  })

  it('topshirish tarmoq xatosi: imtihonda qoladi, xabar; keyin qayta urinish muvaffaqiyatli', async () => {
    const api = mkApi({
      submit: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
        .mockResolvedValue(resultResp()),
    })
    const { s } = await started(api)
    expect(await s.submit(false)).toBe(false)
    expect(s.state.screen).toBe('exam')
    expect(s.state.toasts.at(-1)?.kind).toBe('error')
    expect(await s.submit(false)).toBe(true)
    expect(s.state.screen).toBe('result')
  })

  it('submit 409 (sweeper allaqachon topshirgan): natija olinadi', async () => {
    const api = mkApi({
      submit: vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'Imtihon topshirilgan')),
    })
    const { s } = await started(api)
    expect(await s.submit(false)).toBe(true)
    expect(api.result).toHaveBeenCalled()
    expect(s.state.screen).toBe('result')
  })

  it('vaqt tugaganda avtomatik topshiriladi (server deadline)', async () => {
    const { s, api } = await started()
    s.setAnswer('q2', '7')
    await vi.advanceTimersByTimeAsync(40 * 60_000 + 2_000)
    expect(api.submit).toHaveBeenCalledTimes(1)
    expect(s.state.screen).toBe('result')
  })

  it('oynadan chiqish: hodisa serverga yuboriladi va ogohlantirish ko`rinadi; test davom etadi', async () => {
    const { s, api } = await started()
    window.dispatchEvent(new Event('blur'))
    await vi.advanceTimersByTimeAsync(10)
    expect(api.event).toHaveBeenCalledWith('blur', expect.any(String))
    expect(s.state.toasts.some((t) => t.kind === 'warn' && /Oynadan chiqish/.test(t.message))).toBe(
      true,
    )
    expect(s.state.screen).toBe('exam')
  })

  it('ulanish tiklanganda: reconnect hodisasi va navbat to`liq holat bilan qayta yuboriladi', async () => {
    const api = mkApi({
      saveAnswers: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
        .mockImplementation(async (b: { clientSeq: number }) => ({
          savedSeq: b.clientSeq,
          answeredCount: 1,
          serverNow: new Date().toISOString(),
        })),
    })
    const { s } = await started(api)
    s.setAnswer('q2', '5')
    await vi.advanceTimersByTimeAsync(1600)
    expect(s.state.saveStatus).toBe('offline')
    window.dispatchEvent(new Event('offline'))
    expect(s.state.online).toBe(false)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10)
    expect(s.state.online).toBe(true)
    expect(s.state.saveStatus).toBe('saved')
    expect(api.event).toHaveBeenCalledWith('reconnect', expect.any(String))
  })

  it('beforeunload: yuborilmagan javob bo`lsa ogohlantiradi', async () => {
    const { s } = await started(
      mkApi({ saveAnswers: vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x')) }),
    )
    s.setAnswer('q2', '5')
    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})

describe('qayta ochish (resume)', () => {
  it('token bor, urinish in_progress: state -> start, savollar va javoblar tiklanadi', async () => {
    storage.setItem('exam.token', 'tok-1')
    storage.setItem('exam.info', JSON.stringify({ ...joinResp(), token: undefined }))
    const api = mkApi({
      state: vi.fn().mockResolvedValue({
        serverNow: new Date(T0).toISOString(),
        status: 'in_progress',
        startedAt: null,
        deadline: DEADLINE,
        answeredCount: 1,
        total: 3,
        clientSeq: 2,
      }),
      start: vi
        .fn()
        .mockResolvedValue(
          startResp({ saved: [{ id: 'q2', value: '12', flagged: false }], clientSeq: 2 }),
        ),
    })
    const s = mk(api)
    await s.init()
    expect(s.state.screen).toBe('exam')
    expect(s.state.answers.q2?.value).toBe('12')
  })

  it('token eskirgan (401): kirish ekrani, token o`chiriladi; tarmoq xatosi: qayta urinish ekrani', async () => {
    storage.setItem('exam.token', 'old')
    storage.setItem('exam.info', JSON.stringify({ ...joinResp(), token: undefined }))
    const s = mk(
      mkApi({ state: vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x')) }),
    )
    await s.init()
    expect(s.state.screen).toBe('join')
    expect(storage.getItem('exam.token')).toBeNull()
    storage.setItem('exam.token', 'tok')
    storage.setItem('exam.info', JSON.stringify({ ...joinResp(), token: undefined }))
    const s2 = mk(mkApi({ state: vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x')) }))
    await s2.init()
    expect(s2.state.screen).toBe('loading')
    expect(s2.state.error).toMatch(/Internet yo'q/)
  })

  it('topshirilgan urinish: natija', async () => {
    storage.setItem('exam.token', 'tok-1')
    storage.setItem('exam.info', JSON.stringify({ ...joinResp(), token: undefined }))
    const s = mk(
      mkApi({
        state: vi.fn().mockResolvedValue({
          serverNow: new Date(T0).toISOString(),
          status: 'auto_submitted',
          startedAt: null,
          deadline: null,
          answeredCount: 0,
          total: 3,
          clientSeq: 0,
        }),
      }),
    )
    await s.init()
    expect(s.state.screen).toBe('result')
  })
})

describe('komponentlar', () => {
  const mountWith = (store: ReturnType<typeof createStore>, comp: object) =>
    mount(
      { components: { C: comp, ToastHost }, template: '<C /><ToastHost />' },
      { global: { provide: { [STORE_KEY as symbol]: store } } },
    )

  it('JoinScreen: kod/PIN tekshiruvi', async () => {
    const api = mkApi()
    const store = mk(api)
    const w = mountWith(store, JoinScreen)
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid="join-error"]').text()).toMatch(/6 ta raqam/)
    await w.get('[data-testid="join-code"]').setValue('123456')
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid="join-error"]').text()).toMatch(/PIN/)
    expect(api.join).not.toHaveBeenCalled()
    await w.get('[data-testid="join-pin"]').setValue('abc123')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.join).toHaveBeenCalledWith(
      expect.objectContaining({ code: '123456', pin: 'ABC123' }),
    )
  })

  it('ConfirmScreen: ism, sinf, qoidalar; "Bu men emasman" kirishga qaytaradi', async () => {
    const store = mk(mkApi())
    await store.init()
    await store.join('123456', 'abcd')
    const w = mountWith(store, ConfirmScreen)
    expect(w.get('[data-testid="confirm-who"]').text()).toBe('Aliyev Bobur, 7-A')
    expect(w.text()).toContain('40 daqiqa')
    expect(w.text()).toContain('qayd qilinadi')
    await w.get('[data-testid="not-me"]').trigger('click')
    expect(store.state.screen).toBe('join')
    expect(storage.getItem('exam.token')).toBeNull()
  })

  it('ExamScreen: grid holatlari, savol almashtirish, topshirish oynasi javobsizlar sonini ko`rsatadi', async () => {
    const store = mk(mkApi())
    await store.init()
    await store.join('123456', 'abcd')
    await store.start()
    const w = mountWith(store, ExamScreen)
    expect(w.findAll('[data-testid="grid"] button')).toHaveLength(3)
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 1 / 3')
    await w.get('[data-testid="option-a"]').trigger('click')
    await w.get('[data-testid="cell-2"]').trigger('click')
    await w.get('[data-testid="flag"]').trigger('click')
    expect(w.get('[data-testid="cell-0"]').attributes('data-state')).toBe('answered')
    expect(w.get('[data-testid="cell-1"]').attributes('data-state')).toBe('empty')
    expect(w.get('[data-testid="cell-2"]').attributes('data-state')).toBe('flagged')
    await w.get('[data-testid="next"]').trigger('click') // oxirgi savolda o'chirilgan
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 3 / 3')
    expect(w.get('[data-testid="timer"]').text()).toBe('40:00')
    await w.get('[data-testid="submit"]').trigger('click')
    expect(w.get('[data-testid="submit-summary"]').text()).toContain('Javobsiz savollar: 2')
    expect(w.get('[data-testid="submit-summary"]').text()).toContain('belgilanganlar: 1')
    await w.get('[data-testid="submit-cancel"]').trigger('click')
    expect(w.find('[data-testid="submit-dialog"]').exists()).toBe(false)
    // matn javob
    await w.get('[data-testid="cell-1"]').trigger('click')
    await w.get('[data-testid="answer-text"]').setValue('12')
    expect(w.get('[data-testid="cell-1"]').attributes('data-state')).toBe('answered')
    // HTML matn sifatida (v-html yo'q): savol matnida teg ko'rinmaydi, ishga tushmaydi
    expect(w.html()).not.toContain('<script')
  })

  it('ExamScreen: oflayn belgi va saqlash holati matnlari', async () => {
    const store = mk(
      mkApi({ saveAnswers: vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x')) }),
    )
    await store.init()
    await store.join('123456', 'abcd')
    await store.start()
    const w = mountWith(store, ExamScreen)
    expect(w.get('[data-testid="save-status"]').text()).toBe('Saqlandi')
    store.setAnswer('q2', '1')
    await vi.advanceTimersByTimeAsync(1600)
    await flushPromises()
    expect(w.get('[data-testid="save-status"]').text()).toMatch(/Saqlanmadi: internet yo‘q/)
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(w.find('[data-testid="offline-bar"]').exists()).toBe(true)
  })

  it('ResultScreen: rejimlar bo`yicha', async () => {
    const store = mk(mkApi())
    await store.init()
    store.state.result = resultResp()
    const w = mountWith(store, ResultScreen)
    expect(w.get('[data-testid="result-score"]').text()).toContain('3')
    expect(w.find('[data-testid="essay-note"]').exists()).toBe(true)
    expect(w.find('[data-testid="review"]').exists()).toBe(false)
    store.state.result = resultResp({ available: false, mode: 'after_publish', score: undefined })
    await flushPromises()
    expect(w.get('[data-testid="result-note"]').text()).toMatch(/e’lon qilgandan keyin/)
    expect(w.find('[data-testid="result-score"]').exists()).toBe(false)
    store.state.result = resultResp({
      available: false,
      mode: 'never',
      score: undefined,
      status: 'auto_submitted',
    })
    await flushPromises()
    expect(w.get('[data-testid="result-title"]').text()).toMatch(/Vaqt tugadi/)
    expect(w.get('[data-testid="result-note"]').text()).toMatch(/ko‘rsatilmaydi/)
  })
})
