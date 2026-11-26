import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiError, type ExamApi } from './lib/api'
import type { KeyValueStore } from './lib/queue'
import type {
  BlockMeta,
  ClientQuestion,
  FinishBlockResponse,
  JoinResponse,
  ResultResponse,
  StartResponse,
} from './lib/types'
import { STORE_KEY } from './inject'
import { createStore } from './store'
import ConfirmScreen from './components/ConfirmScreen.vue'
import ExamScreen from './components/ExamScreen.vue'
import ResultScreen from './components/ResultScreen.vue'

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
const iso = (ms: number) => new Date(ms).toISOString()
const min = (n: number) => n * 60_000

const blocks: BlockMeta[] = [
  { id: 'B1', title: 'Matematika', questionCount: 2, durationMin: 30 },
  { id: 'B2', title: 'Ona tili', questionCount: 1, durationMin: 20 },
]
const q = (id: string, blockId: string, text: string): ClientQuestion => ({
  id,
  blockId,
  type: 'single',
  points: 1,
  content: [{ type: 'text', text }],
  options: [
    { id: 'a', content: [{ type: 'text', text: 'A' }] },
    { id: 'b', content: [{ type: 'text', text: 'B' }] },
  ],
})
const m1 = q('m1', 'B1', 'Math 1')
const m2 = q('m2', 'B1', 'Math 2')
const l1 = q('l1', 'B2', 'Lang 1')

const joinResp = (timing: 'common' | 'per_block'): JoinResponse => ({
  token: 'tok-1',
  serverNow: iso(T0),
  attemptStatus: 'joined',
  participant: { fullName: 'Aliyev Bobur', className: '7-A' },
  exam: {
    title: 'DTM sinov',
    type: 'quarter',
    durationMin: 50,
    questionCount: 3,
    resultsMode: 'score',
    startsAt: iso(T0),
    endsAt: iso(T0 + min(50)),
    deadlinePreview: iso(T0 + min(50)),
    freeNavigation: timing === 'common',
    timingMode: timing,
    blocks,
  },
})
/** 1-blok ko'rinishi (blokma-blok) */
const view1 = (over: Partial<StartResponse> = {}): StartResponse => ({
  serverNow: iso(T0),
  status: 'in_progress',
  startedAt: iso(T0),
  deadline: iso(T0 + min(50)),
  questions: [m1, m2],
  saved: [],
  clientSeq: 0,
  timingMode: 'per_block',
  blocks,
  block: { index: 0, total: 2, id: 'B1', startedAt: iso(T0), deadline: iso(T0 + min(30)) },
  ...over,
})
const view2 = (at: number): FinishBlockResponse => ({
  finished: false,
  serverNow: iso(at),
  status: 'in_progress',
  startedAt: iso(T0),
  deadline: iso(at + min(20)),
  questions: [l1],
  saved: [],
  clientSeq: 0,
  timingMode: 'per_block',
  blocks,
  block: { index: 1, total: 2, id: 'B2', startedAt: iso(at), deadline: iso(at + min(20)) },
})
const result = (over: Partial<ResultResponse> = {}): ResultResponse => ({
  status: 'submitted',
  mode: 'score',
  available: true,
  submittedAt: iso(T0),
  answeredCount: 3,
  total: 3,
  score: { earned: 6.75, max: 10.4, autoMax: 10.4, essayPending: 0 },
  blocks: [
    { id: 'B1', title: 'Matematika', earned: 4.65, max: 6.2 },
    { id: 'B2', title: 'Ona tili', earned: 2.1, max: 4.2 },
  ],
  review: [
    {
      id: 'm1',
      blockId: 'B1',
      type: 'single',
      got: 1,
      max: 1,
      ok: true,
      given: 'a',
      reveal: { optionIds: ['a'] },
    },
    {
      id: 'l1',
      blockId: 'B2',
      type: 'single',
      got: 0,
      max: 1,
      ok: false,
      given: 'b',
      reveal: { optionIds: ['a'] },
    },
  ],
  ...over,
})

type MockApi = ExamApi & { [K in keyof ExamApi]: ReturnType<typeof vi.fn> & ExamApi[K] }
function mkApi(timing: 'common' | 'per_block', over: Record<string, unknown> = {}): MockApi {
  return {
    join: vi.fn().mockResolvedValue(joinResp(timing)),
    start: vi
      .fn()
      .mockResolvedValue(
        timing === 'per_block'
          ? view1()
          : view1({ questions: [m1, m2, l1], block: null, timingMode: 'common' }),
      ),
    state: vi.fn().mockResolvedValue({
      serverNow: iso(T0),
      status: 'in_progress',
      startedAt: iso(T0),
      deadline: iso(T0 + min(50)),
      answeredCount: 0,
      total: 3,
      clientSeq: 0,
      block: null,
    }),
    saveAnswers: vi.fn().mockImplementation(async (b: { clientSeq: number }) => ({
      savedSeq: b.clientSeq,
      answeredCount: 1,
      serverNow: new Date(Date.now()).toISOString(),
    })),
    event: vi.fn().mockResolvedValue({}),
    heartbeat: vi.fn().mockResolvedValue({}),
    ackWarnings: vi.fn().mockResolvedValue({ acknowledged: true }),
    submit: vi.fn().mockResolvedValue(result()),
    finishBlock: vi.fn().mockResolvedValue(view2(T0 + min(10))),
    result: vi.fn().mockResolvedValue(result()),
    asset: vi.fn().mockResolvedValue(new Blob(['x'])),
    file: vi.fn().mockResolvedValue(new Blob(['x'])),
    ...over,
  } as never
}

let storage: MemStore
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  storage = new MemStore()
  document.body.innerHTML = ''
})
afterEach(() => {
  vi.useRealTimers()
})

const mk = (api: ExamApi) => createStore({ api, storage, now: () => Date.now() })
const mountWith = (store: ReturnType<typeof createStore>, comp: object) =>
  mount(comp, { global: { provide: { [STORE_KEY as symbol]: store } } })

async function started(timing: 'common' | 'per_block', over: Record<string, unknown> = {}) {
  const api = mkApi(timing, over)
  const s = mk(api)
  await s.init()
  await s.join('123456', 'abcd')
  await s.start()
  return { s, api }
}

describe('blokma-blok navigatsiya va taymer', () => {
  it('faqat joriy blok savollari; blok taymeri (umumiydan alohida); navbat kaliti blokka xos', async () => {
    const { s } = await started('per_block')
    expect(s.state.screen).toBe('exam')
    expect(s.state.questions.map((x) => x.id)).toEqual(['m1', 'm2'])
    expect(s.state.block).toMatchObject({ index: 0, total: 2, id: 'B1' })
    expect(s.state.blockRemaining).toBe(min(30))
    expect(s.state.remaining).toBe(min(50))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(s.state.blockRemaining).toBe(min(30) - 5_000)
    s.setAnswer('m1', 'a')
    expect(s.state.saveStatus).toBe('saving')
    expect([...storage.data.keys()].some((k) => k.endsWith('.B1'))).toBe(true)
  })

  it('ExamScreen: blok sarlavhasi, blok taymeri, "Blokni yakunlash" va orqaga qaytib bo`lmasligi haqida ogohlantirish', async () => {
    const { s, api } = await started('per_block')
    const w = mountWith(s as never, ExamScreen)
    expect(w.get('[data-testid="block-header"]').text()).toContain('1/2-blok: Matematika')
    expect(w.get('[data-testid="timer"]').text()).toBe('30:00')
    expect(w.get('[data-testid="total-time"]').text()).toBe('50:00')
    expect(w.get('[data-testid="submit"]').text()).toBe('Blokni yakunlash')
    expect(w.find('[data-testid="block-tab-B2"]').attributes('disabled')).toBeDefined() // keyingi fan qulflangan
    await w.get('[data-testid="option-a"]').trigger('click')
    await w.get('[data-testid="submit"]').trigger('click')
    expect(w.get('[data-testid="submit-title"]').text()).toBe('Blokni yakunlaysizmi?')
    expect(w.get('[data-testid="block-warning"]').text()).toMatch(/qaytib bo‘lmaydi/)
    expect(w.get('[data-testid="submit-summary"]').text()).toContain('Javobsiz savollar: 1')
    await w.get('[data-testid="submit-cancel"]').trigger('click')
    expect(api.finishBlock).not.toHaveBeenCalled()
    await w.get('[data-testid="submit"]').trigger('click')
    await w.get('[data-testid="submit-confirm"]').trigger('click')
    await flushPromises()
    // javoblar avval yuboriladi, keyin blok yakunlanadi
    expect(api.saveAnswers.mock.invocationCallOrder[0]!).toBeLessThan(
      api.finishBlock.mock.invocationCallOrder[0]!,
    )
    expect(api.finishBlock).toHaveBeenCalledWith({ blockId: 'B1' })
    // 2-blok: faqat uning savollari, indeks 0, "orqaga" yo'q (oldingi savollar holatda yo'q)
    expect(s.state.questions.map((x) => x.id)).toEqual(['l1'])
    expect(s.state.index).toBe(0)
    expect(w.get('[data-testid="block-header"]').text()).toContain('2/2-blok: Ona tili')
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 1 / 1')
    expect(w.get('[data-testid="timer"]').text()).toBe('20:00')
    expect(w.findAll('[data-testid="grid"] button')).toHaveLength(1)
    // oxirgi blok: tugma "Topshirish"
    expect(w.get('[data-testid="submit"]').text()).toBe('Topshirish')
    await w.get('[data-testid="submit"]').trigger('click')
    expect(w.get('[data-testid="submit-title"]').text()).toBe('Imtihonni topshirasizmi?')
    expect(w.find('[data-testid="block-warning"]').exists()).toBe(false)
    expect(api.submit).not.toHaveBeenCalled() // blokma-blokda topshirish blokni yakunlash orqali
  })

  it('oxirgi blokni yakunlash: imtihon topshiriladi, natija bloklar bilan (oldingi blok savollari ham tahlilda)', async () => {
    const { s, api } = await started('per_block')
    await s.finishBlock(false)
    expect(s.state.block?.id).toBe('B2')
    api.finishBlock.mockResolvedValueOnce({ finished: true, ...result() })
    await s.finishBlock(false)
    expect(api.finishBlock).toHaveBeenLastCalledWith({ blockId: 'B2' })
    expect(s.state.screen).toBe('result')
    expect(s.state.result?.blocks).toHaveLength(2)
    const w = mountWith(s as never, ResultScreen)
    const items = w.findAll('[data-testid="result-block"]').map((x) => x.text())
    expect(items).toHaveLength(2)
    expect(items[0]).toMatch(/^Matematika\s*4,65 \/ 6,2\s*75%$/)
    expect(items[1]).toMatch(/^Ona tili\s*2,1 \/ 4,2\s*50%$/)
    const review = w.findAll('[data-testid="review-item"]')
    expect(review).toHaveLength(2)
    expect(review[0]!.text()).toContain('Math 1') // oldingi blok savoli matni saqlangan
    expect(review[0]!.text()).toContain('Matematika')
    expect(review[1]!.text()).toContain('Ona tili')
  })

  it('blok vaqti tugaganda avtomatik keyingi blokka o`tadi (3 s dan oldin qayta chaqirilmaydi); oxirgida topshiriladi', async () => {
    // 1-blok T0+30min da tugaydi; server 2-blokni shu paytdan boshlaydi (qisqa, 5 s: testni tezlashtirish uchun)
    const v2 = view2(T0 + min(30)) as StartResponse & { finished: false }
    v2.block = { ...v2.block!, deadline: iso(T0 + min(30) + 5_000) }
    const { s, api } = await started('per_block', {
      finishBlock: vi.fn().mockResolvedValueOnce(v2),
    })
    await vi.advanceTimersByTimeAsync(min(30) + 2_000)
    await flushPromises()
    expect(api.finishBlock).toHaveBeenCalledTimes(1)
    expect(api.finishBlock).toHaveBeenCalledWith({ blockId: 'B1' })
    expect(s.state.block?.id).toBe('B2')
    expect(api.submit).not.toHaveBeenCalled()
    api.finishBlock.mockResolvedValueOnce({
      finished: true,
      ...result({ status: 'auto_submitted' }),
    })
    await vi.advanceTimersByTimeAsync(4_000) // 2-blok vaqti tugadi (oxirgi blok): server topshiradi
    await flushPromises()
    expect(api.finishBlock).toHaveBeenCalledTimes(2)
    expect(api.finishBlock).toHaveBeenLastCalledWith({ blockId: 'B2' })
    expect(s.state.screen).toBe('result')
  })

  it('avtomatik o`tishda tarmoq xatosi: imtihonda qoladi, 3 s dan keyin qayta uriniladi', async () => {
    const { s, api } = await started('per_block', {
      finishBlock: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
        .mockResolvedValue(view2(T0 + min(30))),
    })
    await vi.advanceTimersByTimeAsync(min(30) + 1_500)
    await flushPromises()
    expect(api.finishBlock).toHaveBeenCalledTimes(1)
    expect(s.state.block?.id).toBe('B1')
    expect(s.state.screen).toBe('exam')
    await vi.advanceTimersByTimeAsync(3_500)
    await flushPromises()
    expect(api.finishBlock).toHaveBeenCalledTimes(2)
    expect(s.state.block?.id).toBe('B2')
  })

  it('finishBlock 409 (allaqachon topshirilgan): natija olinadi', async () => {
    const { s, api } = await started('per_block', {
      finishBlock: vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'topshirilgan')),
    })
    await s.finishBlock(false)
    expect(api.result).toHaveBeenCalled()
    expect(s.state.screen).toBe('result')
  })

  it('server javobni rad etsa (yopilgan blok): ogohlantirish va holat qayta yuklanadi; blok almashgan bo`lsa yangi blok', async () => {
    const { s, api } = await started('per_block', {
      saveAnswers: vi.fn().mockImplementation(async (b: { clientSeq: number }) => ({
        savedSeq: b.clientSeq,
        answeredCount: 0,
        serverNow: new Date(Date.now()).toISOString(),
        rejected: ['m1'],
        blockId: 'B1',
      })),
      state: vi.fn().mockResolvedValue({
        serverNow: iso(T0),
        status: 'in_progress',
        startedAt: iso(T0),
        deadline: iso(T0 + min(50)),
        answeredCount: 0,
        total: 3,
        clientSeq: 1,
        block: { index: 1, total: 2, id: 'B2', startedAt: iso(T0), deadline: iso(T0 + min(20)) },
      }),
    })
    api.start.mockResolvedValueOnce(view1()).mockResolvedValueOnce(view2(T0))
    // start() (started() ichida) birinchi chaqiruv; ikkinchisi qayta yuklash
    s.setAnswer('m1', 'a')
    await vi.advanceTimersByTimeAsync(1600)
    await flushPromises()
    expect(s.state.toasts.some((t) => /saqlanmadi/.test(t.message))).toBe(true)
    expect(api.state).toHaveBeenCalled()
  })

  it('heartbeat: server bloklarni almashtirgan bo`lsa yangi blok yuklanadi', async () => {
    const { s, api } = await started('per_block', {
      heartbeat: vi.fn().mockResolvedValue({
        status: 'in_progress',
        block: { index: 1, total: 2, id: 'B2', startedAt: iso(T0), deadline: iso(T0 + min(20)) },
      }),
    })
    api.start.mockResolvedValueOnce(view2(T0 + min(1)) as unknown as StartResponse)
    await vi.advanceTimersByTimeAsync(31_000)
    await flushPromises()
    expect(s.state.block?.id).toBe('B2')
    expect(s.state.questions.map((x) => x.id)).toEqual(['l1'])
  })

  it('ConfirmScreen: bloklar, har birining davomiyligi va "orqaga qaytib bo`lmaydi" qoidasi', async () => {
    const api = mkApi('per_block')
    const s = mk(api)
    await s.init()
    await s.join('123456', 'abcd')
    const w = mountWith(s as never, ConfirmScreen)
    expect(w.get('[data-testid="confirm-blocks"]').text()).toContain('Matematika')
    expect(w.get('[data-testid="confirm-blocks"]').text()).toContain('30 daq.')
    expect(w.get('[data-testid="confirm-per-block"]').text()).toMatch(/orqaga qaytib bo‘lmaydi/)
    expect(w.text()).not.toContain('Savollar orasida erkin yurish')
  })
})

describe('umumiy vaqt, bir nechta blok: erkin navigatsiya va blok sarlavhalari', () => {
  it('blok tablari, savol bloki nomi, bitta umumiy taymer, "Topshirish" (blokni yakunlash yo`q)', async () => {
    const { s, api } = await started('common')
    expect(s.state.block).toBeNull()
    expect(s.state.questions).toHaveLength(3)
    const w = mountWith(s as never, ExamScreen)
    expect(w.find('[data-testid="block-header"]').exists()).toBe(false)
    const tabs = w.findAll('[data-testid^="block-tab-"]')
    expect(tabs.map((t) => t.text())).toEqual(['Matematika0/2', 'Ona tili0/1'])
    expect(w.get('[data-testid="question-block"]').text()).toBe('Matematika')
    // tab: 2-blok birinchi savoliga o'tadi (erkin: orqaga ham mumkin)
    await w.get('[data-testid="block-tab-B2"]').trigger('click')
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 3 / 3')
    expect(w.get('[data-testid="question-block"]').text()).toBe('Ona tili')
    await w.get('[data-testid="block-tab-B1"]').trigger('click')
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 1 / 3')
    expect(w.get('[data-testid="timer"]').text()).toBe('50:00')
    expect(w.get('[data-testid="submit"]').text()).toBe('Topshirish')
    await w.get('[data-testid="submit"]').trigger('click')
    await w.get('[data-testid="submit-confirm"]').trigger('click')
    await flushPromises()
    expect(api.submit).toHaveBeenCalledTimes(1)
    expect(api.finishBlock).not.toHaveBeenCalled()
  })

  it('eski (blokisiz) imtihon: blok tablari va sarlavhalari ko`rinmaydi', async () => {
    const api = mkApi('common', {
      join: vi.fn().mockResolvedValue({
        ...joinResp('common'),
        exam: { ...joinResp('common').exam, blocks: undefined, timingMode: undefined },
      }),
      start: vi.fn().mockResolvedValue(
        view1({
          questions: [
            { ...m1, blockId: undefined },
            { ...m2, blockId: undefined },
          ],
          block: null,
          blocks: undefined,
          timingMode: undefined,
        }),
      ),
    })
    const s = mk(api)
    await s.init()
    await s.join('123456', 'abcd')
    await s.start()
    const w = mountWith(s as never, ExamScreen)
    expect(w.find('[data-testid="block-tabs"]').exists()).toBe(false)
    expect(w.find('[data-testid="question-block"]').exists()).toBe(false)
    expect(w.find('[data-testid="block-header"]').exists()).toBe(false)
  })
})

describe('imtihon ekrani: B dizayni (fan yorliqlari, savollar xaritasi, telefon paneli)', () => {
  it('xarita fan bo`yicha guruhlanadi; holatlar va izoh sanoqlari; katak bosilsa savolga o`tadi', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    const aside = w.get('[data-testid="map-aside"]')
    const groups = aside.findAll('section')
    expect(groups.map((g) => g.get('h3').text())).toEqual(['Matematika', 'Ona tili'])
    expect(groups.map((g) => g.findAll('button').length)).toEqual([2, 1])
    await w.get('[data-testid="option-a"]').trigger('click') // 1-savol: javob
    await w.get('[data-testid="cell-1"]').trigger('click')
    await w.get('[data-testid="flag"]').trigger('click') // 2-savol: keyinroq qaytaman
    expect(w.get('[data-testid="cell-0"]').attributes('data-state')).toBe('answered')
    expect(w.get('[data-testid="cell-1"]').attributes('data-state')).toBe('flagged')
    expect(w.get('[data-testid="cell-2"]').attributes('data-state')).toBe('empty')
    expect(w.get('[data-testid="cell-1"]').attributes('aria-current')).toBe('step') // joriy ajralgan
    expect(w.get('[data-testid="cell-0"]').attributes('aria-current')).toBeUndefined()
    expect(w.get('[data-testid="cell-1"]').attributes('aria-label')).toBe(
      '2-savol, belgilangan, hozirgi',
    )
    const legend = aside.get('ul').text()
    expect(legend).toMatch(/Javob berilgan\s*1/)
    expect(legend).toMatch(/Belgilangan\s*1/)
    expect(legend).toMatch(/Javobsiz\s*1/)
    expect(aside.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('33')
    await w.get('[data-testid="cell-2"]').trigger('click')
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 3 / 3')
    expect(w.get('[data-testid="question-block"]').text()).toBe('Ona tili')
  })

  it('fan yorlig`i: javoblangan/jami sanog`i va joriy fan belgisi', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    const t1 = w.get('[data-testid="block-tab-B1"]')
    const t2 = w.get('[data-testid="block-tab-B2"]')
    expect(t1.text()).toBe('Matematika0/2')
    expect(t1.attributes('aria-current')).toBe('true')
    expect(t2.attributes('aria-current')).toBeUndefined()
    await w.get('[data-testid="option-a"]').trigger('click')
    expect(w.get('[data-testid="block-tab-B1"]').text()).toBe('Matematika1/2')
    expect(w.get('[data-testid="block-tab-B2"]').text()).toBe('Ona tili0/1')
  })

  it('taymer: 5 daqiqadan kam bo`lsa qizil, ko`p bo`lsa neytral; sarlavhada ism va sinf', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    expect(w.get('[data-testid="timer"]').classes()).toContain('bg-muted')
    expect(w.get('[data-testid="exam-student"]').text()).toBe('Aliyev Bobur · 7-A')
    s.state.remaining = min(5) + 1000
    await flushPromises()
    expect(w.get('[data-testid="timer"]').classes()).toContain('bg-muted')
    s.state.remaining = min(5)
    await flushPromises()
    expect(w.get('[data-testid="timer"]').classes()).toContain('bg-bad')
    expect(w.get('[data-testid="timer"]').attributes('role')).toBe('timer')
  })

  it('telefon: "Xarita" paneli ochiladi, katak savolga o`tkazib panelni yopadi; Topshirish tasdiqqa olib boradi', async () => {
    const { s, api } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    expect(w.find('[data-testid="map-panel"]').exists()).toBe(false)
    await w.get('[data-testid="map-open"]').trigger('click')
    const panel = w.get('[data-testid="map-panel"]')
    expect(panel.attributes('role')).toBe('dialog')
    expect(panel.findAll('[data-testid^="m-cell-"]')).toHaveLength(3)
    await w.get('[data-testid="m-cell-2"]').trigger('click')
    expect(w.find('[data-testid="map-panel"]').exists()).toBe(false)
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 3 / 3')
    // yopish tugmasi va Escape
    await w.get('[data-testid="map-open"]').trigger('click')
    await w.get('[data-testid="map-close"]').trigger('click')
    expect(w.find('[data-testid="map-panel"]').exists()).toBe(false)
    await w.get('[data-testid="map-open"]').trigger('click')
    await w.get('[data-testid="map-backdrop"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-testid="map-panel"]').exists()).toBe(false)
    // panel ichidan topshirish: panel yopiladi, tasdiq oynasi chiqadi, tasdiqlansa server chaqiriladi
    await w.get('[data-testid="map-open"]').trigger('click')
    await w.get('[data-testid="submit-panel"]').trigger('click')
    expect(w.find('[data-testid="map-panel"]').exists()).toBe(false)
    expect(w.get('[data-testid="submit-dialog"]').attributes('role')).toBe('dialog')
    expect(w.get('[data-testid="submit-summary"]').text()).toContain('Javobsiz savollar: 3')
    await w.get('[data-testid="submit-confirm"]').trigger('click')
    await flushPromises()
    expect(api.submit).toHaveBeenCalledTimes(1)
  })

  it('telefon: oxirgi savolda "Topshirish" tugmasi tasdiq oynasini ochadi (Keyingi o`chirilgan)', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    expect(w.find('[data-testid="submit-last"]').exists()).toBe(false)
    await w.get('[data-testid="cell-2"]').trigger('click')
    expect((w.get('[data-testid="next"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.get('[data-testid="submit-last"]').trigger('click')
    expect(w.find('[data-testid="submit-dialog"]').exists()).toBe(true)
    expect(w.get('[data-testid="submit-title"]').text()).toBe('Imtihonni topshirasizmi?')
  })

  it('blokma-blok: boshqa fanga o`tish cheklovi ko`rinadi (keyingi fan qulflangan, bosilmaydi); yakunlangach oldingisi yopiq', async () => {
    const { s } = await started('per_block')
    const w = mountWith(s as never, ExamScreen)
    const t1 = w.get('[data-testid="block-tab-B1"]')
    const t2 = w.get('[data-testid="block-tab-B2"]')
    expect(t1.attributes('data-state')).toBe('current')
    expect(t2.attributes('data-state')).toBe('locked')
    expect(t2.attributes('disabled')).toBeDefined()
    expect(t2.attributes('title')).toMatch(/yakunlagach ochiladi/)
    expect(t2.text()).toContain('Keyin')
    await t2.trigger('click')
    expect(s.state.block?.id).toBe('B1')
    expect(w.findAll('[data-testid="grid"] button')).toHaveLength(2) // faqat joriy blok xaritada
    await w.get('[data-testid="submit"]').trigger('click')
    await w.get('[data-testid="submit-confirm"]').trigger('click')
    await flushPromises()
    expect(s.state.block?.id).toBe('B2')
    expect(w.get('[data-testid="block-tab-B1"]').attributes('data-state')).toBe('done')
    expect(w.get('[data-testid="block-tab-B1"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="block-tab-B2"]').attributes('data-state')).toBe('current')
  })
})

describe('telefon tuzatishlari: pastki qator, yorliqlar, xarita paneli, o`nlik vergul', () => {
  it('pastki Oldingi/Belgilash/Keyingi qatori 3 teng ustunli grid (min-w-0), qisqa ekranda ikonka yashirin', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    const row = w.get('[data-testid="prev"]').element.parentElement!
    expect(row.className).toContain('grid-cols-3')
    for (const id of ['prev', 'flag', 'next']) {
      const b = w.get(`[data-testid="${id}"]`)
      expect(b.classes()).toContain('min-w-0')
      expect(b.find('svg').classes().join(' ')).toContain('max-[400px]:hidden')
    }
  })

  it('fan yorliqlari: 3 tagacha teng grid, ko`p bo`lsa gorizontal scroll va chetida soya', async () => {
    const { s } = await started('per_block')
    const w = mountWith(s as never, ExamScreen)
    const nav = w.get('[data-testid="block-tabs"]')
    expect(nav.classes()).toContain('grid')
    expect(nav.attributes('style')).toContain('repeat(2, minmax(0, 1fr))')
    expect(w.find('[data-testid="tabs-fade"]').exists()).toBe(false)
    s.state.blocks = [
      ...s.state.blocks,
      { id: 'B3', title: 'Fizika', questionCount: 1, durationMin: 10 },
      { id: 'B4', title: 'Kimyo', questionCount: 1, durationMin: 10 },
    ]
    await flushPromises()
    const nav2 = w.get('[data-testid="block-tabs"]')
    expect(nav2.classes()).toContain('overflow-x-auto')
    expect(w.find('[data-testid="tabs-fade"]').exists()).toBe(true)
    expect(w.get('[data-testid="block-tab-B3"]').classes()).toContain('shrink-0')
  })

  it('xarita panelida katak bosilsa panel yopiladi va fokus savol kartasiga qaytadi', async () => {
    const { s } = await started('common')
    const w = mount(ExamScreen, {
      attachTo: document.body,
      global: { provide: { [STORE_KEY as symbol]: s } },
    })
    await w.get('[data-testid="map-open"]').trigger('click')
    await w.get('[data-testid="m-cell-1"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="map-panel"]').exists()).toBe(false)
    expect(w.get('[data-testid="question-index"]').text()).toBe('Savol 2 / 3')
    expect(document.activeElement).toBe(w.get('[data-testid="question"]').element)
    w.unmount()
  })

  it('natija: ball va fanlar bo`yicha ballar o`zbekcha vergul bilan', async () => {
    const { s } = await started('common')
    s.state.result = result()
    const w = mountWith(s as never, ResultScreen)
    expect(w.get('[data-testid="result-score"]').text()).toContain('6,75')
    expect(w.get('[data-testid="result-score"]').text()).toContain('10,4')
    expect(w.get('[data-testid="result-score"]').text()).not.toContain('.')
    expect(w.text()).not.toMatch(/\d\.\d/)
  })
})

describe('kompyuter maketi: butun balandlik, kengaytirilgan konteyner, o`zgaruvchan katak, 2 ustunli variantlar', () => {
  it('lg+ da ekran balandligi to`ldiriladi; savol kartasi ichida Oldingi/Keyingi; xarita ustuni 360/400px', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    const root = w.get('[data-testid="exam"]').classes()
    expect(root).toEqual(expect.arrayContaining(['lg:h-dvh', 'lg:overflow-hidden', 'lg:flex-col']))
    const card = w.get('[data-testid="question"]')
    expect(card.classes()).toEqual(expect.arrayContaining(['lg:flex-1', 'lg:flex-col', '2xl:p-10']))
    expect(card.find('[data-testid="prev"]').exists()).toBe(true) // tugmalar kartaning ichida
    expect(card.find('[data-testid="next"]').exists()).toBe(true)
    expect(card.get('[data-testid="question-body"]').classes()).toContain('lg:overflow-y-auto')
    const grid = card.element.parentElement!.parentElement!
    expect(grid.className).toContain('2xl:max-w-[1600px]')
    expect(grid.className).toContain('xl:grid-cols-[minmax(0,1fr)_360px]')
    expect(grid.className).toContain('2xl:grid-cols-[minmax(0,1fr)_400px]')
    expect(w.get('[data-testid="map-aside"]').classes()).toContain('lg:h-full')
    // savol matni 2xl da text-3xl
    expect(card.html()).toContain('2xl:text-3xl')
  })

  it('xarita kataklari: auto-fill minmax(2.25rem,1fr), ixcham h-9, holat klasslari (telefon paneli o`zgarmagan)', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    const cells = w.get('[data-testid="map-aside"]').get('[data-testid="map-cells"]')
    expect(cells.attributes('style')).toContain('repeat(auto-fill, minmax(2.25rem, 1fr))')
    expect(w.get('[data-testid="cell-0"]').classes()).toEqual(
      expect.arrayContaining(['h-9', '2xl:h-10', 'bg-surface']),
    )
    expect(w.get('[data-testid="cell-0"]').classes()).not.toContain('aspect-square')
    await w.get('[data-testid="map-open"]').trigger('click')
    const pc = w.get('[data-testid="map-panel"]').get('[data-testid="map-cells"]')
    expect(pc.classes()).toContain('grid-cols-6')
    expect(w.get('[data-testid="m-cell-0"]').classes()).toContain('h-11')
  })

  it('xarita katagi: javob/belgi/ikkalasi/joriy klass va aria-label', async () => {
    const { mount } = await import('@vue/test-utils')
    const QuestionMap = (await import('./components/QuestionMap.vue')).default
    const mk = (index: number, state: 'answered' | 'flagged' | 'empty', answered: boolean) => ({
      index,
      id: 'q' + index,
      state,
      answered,
    })
    const w = mount(QuestionMap, {
      props: {
        fluid: true,
        current: 3,
        groups: [
          {
            key: 'g',
            title: 'Fan',
            cells: [
              mk(0, 'answered', true),
              mk(1, 'flagged', false),
              mk(2, 'flagged', true),
              mk(3, 'empty', false),
            ],
          },
        ],
      },
    })
    const c = (i: number) => w.get(`[data-testid="cell-${i}"]`)
    expect(c(0).classes()).toEqual(expect.arrayContaining(['bg-ok', 'text-white']))
    expect(c(1).classes()).toEqual(
      expect.arrayContaining(['bg-warn/15', 'border-warn', 'text-warn']),
    )
    expect(c(1).find('svg').exists()).toBe(true)
    expect(c(2).classes()).toContain('bg-ok')
    expect(c(2).find('svg').exists()).toBe(true)
    expect(c(3).classes()).toEqual(expect.arrayContaining(['bg-surface', 'ring-brand']))
    expect(c(0).find('svg').exists()).toBe(false)
    expect(c(0).attributes('aria-label')).toBe('1-savol, javob berilgan')
    expect(c(1).attributes('aria-label')).toBe('2-savol, belgilangan')
    expect(c(2).attributes('aria-label')).toBe('3-savol, javob berilgan, belgilangan')
    expect(c(3).attributes('aria-label')).toBe('4-savol, javobsiz, hozirgi')
    expect(c(3).attributes('aria-current')).toBe('step')
    const legend = w.get('ul').text()
    expect(legend).toMatch(/Javob berilgan\s*2/)
    expect(legend).toMatch(/Belgilangan\s*2/)
    expect(legend).toMatch(/Javobsiz\s*1/)
  })

  it('qisqa variantlar xl da 2 ustun, uzun bo`lsa bitta ustun', async () => {
    const { s } = await started('common')
    const w = mountWith(s as never, ExamScreen)
    const g = w.get('[role="radiogroup"]')
    expect(g.attributes('data-cols')).toBe('2') // 'A' / 'B'
    expect(g.classes()).toContain('xl:grid-cols-2')
    s.state.questions[0]!.options[0]!.content = [{ type: 'text', text: 'u'.repeat(60) }]
    await flushPromises()
    expect(w.get('[role="radiogroup"]').attributes('data-cols')).toBe('1')
    expect(w.get('[role="radiogroup"]').classes()).not.toContain('xl:grid-cols-2')
  })
})
