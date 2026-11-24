import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { KeyValueStore } from './lib/queue'
import type {
  BlockMeta,
  ClientQuestion,
  FileBlockView,
  FinishBlockResponse,
  JoinResponse,
  StartResponse,
} from './lib/types'
import { STORE_KEY } from './inject'
import { createStore } from './store'
import ExamScreen from './components/ExamScreen.vue'

// pdfjs (modul va ishchi skript) soxta: sahifa o'lchamlari va hujjat tozalanishi tekshiriladi
const pdf = vi.hoisted(() => ({
  destroy: vi.fn().mockResolvedValue(undefined),
  getDocument: vi.fn(),
}))
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (o: unknown) => {
    pdf.getDocument(o)
    return {
      promise: Promise.resolve({
        numPages: 3,
        destroy: pdf.destroy,
        getPage: async () => ({
          getViewport: () => ({ width: 600, height: 800 }),
          render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
        }),
      }),
    }
  },
}))
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: '/worker.js' }))

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
  { id: 'F1', title: 'Matematika', questionCount: 4, durationMin: 30 },
  { id: 'B2', title: 'Ona tili', questionCount: 1, durationMin: 20 },
]
const fq = (no: number, type: ClientQuestion['type'], opts = 4): ClientQuestion => ({
  id: `fk:F1:A:${no}`,
  blockId: 'F1',
  type,
  points: 1,
  no,
  variant: 'A',
  content: [],
  options:
    type === 'short'
      ? []
      : 'ABCDEF'
          .slice(0, opts)
          .split('')
          .map((id) => ({ id, content: [] })),
})
const fileQs = [fq(1, 'single'), fq(2, 'short'), fq(3, 'multi', 5), fq(4, 'single')]
const bankQ: ClientQuestion = {
  id: 'l1',
  blockId: 'B2',
  type: 'single',
  points: 1,
  content: [{ type: 'text', text: 'Lang 1' }],
  options: [
    { id: 'a', content: [{ type: 'text', text: 'A' }] },
    { id: 'b', content: [{ type: 'text', text: 'B' }] },
  ],
}
const pdfFile: FileBlockView = {
  blockId: 'F1',
  delivery: 'screen',
  variants: [],
  variant: 'A',
  kind: 'pdf',
  files: [{ id: 'f'.repeat(24) }],
}
const imgFile: FileBlockView = {
  blockId: 'F1',
  delivery: 'screen',
  variants: [],
  variant: 'A',
  kind: 'image',
  files: [{ id: '1'.repeat(24) }, { id: '2'.repeat(24) }],
}

const joinResp = (timing: 'common' | 'per_block'): JoinResponse => ({
  token: 'tok-1',
  serverNow: iso(T0),
  attemptStatus: 'joined',
  participant: { fullName: 'Aliyev Bobur', className: '7-A' },
  exam: {
    title: 'DTM fayl',
    type: 'quarter',
    durationMin: 50,
    questionCount: 5,
    resultsMode: 'score',
    startsAt: iso(T0),
    endsAt: iso(T0 + min(50)),
    deadlinePreview: iso(T0 + min(50)),
    freeNavigation: timing === 'common',
    timingMode: timing,
    blocks,
  },
})
const view = (over: Partial<StartResponse> = {}): StartResponse => ({
  serverNow: iso(T0),
  status: 'in_progress',
  startedAt: iso(T0),
  deadline: iso(T0 + min(50)),
  questions: fileQs,
  files: [pdfFile],
  saved: [],
  clientSeq: 0,
  timingMode: 'per_block',
  blocks,
  block: { index: 0, total: 2, id: 'F1', startedAt: iso(T0), deadline: iso(T0 + min(30)) },
  ...over,
})
const view2 = (): FinishBlockResponse => ({
  finished: false,
  serverNow: iso(T0 + min(10)),
  status: 'in_progress',
  startedAt: iso(T0),
  deadline: iso(T0 + min(30)),
  questions: [bankQ],
  files: [],
  saved: [],
  clientSeq: 0,
  timingMode: 'per_block',
  blocks,
  block: { index: 1, total: 2, id: 'B2', startedAt: iso(T0), deadline: iso(T0 + min(30)) },
})

function mkApi(startResp: StartResponse, over: Record<string, unknown> = {}) {
  return {
    join: vi.fn().mockResolvedValue(joinResp(startResp.timingMode ?? 'per_block')),
    joinCode: vi.fn(),
    joinConfirm: vi.fn(),
    start: vi.fn().mockResolvedValue(startResp),
    state: vi.fn().mockResolvedValue({
      serverNow: iso(T0),
      status: 'in_progress',
      startedAt: iso(T0),
      deadline: iso(T0 + min(50)),
      answeredCount: 0,
      total: 5,
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
    ackWarnings: vi.fn().mockResolvedValue({}),
    submit: vi.fn(),
    finishBlock: vi.fn().mockResolvedValue(view2()),
    result: vi.fn(),
    asset: vi.fn().mockResolvedValue(new Blob(['x'])),
    file: vi.fn().mockResolvedValue(new Blob(['%PDF-1.4'])),
    chooseVariant: vi.fn(),
    ...over,
  } as never as Record<string, ReturnType<typeof vi.fn>>
}

let storage: MemStore
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  storage = new MemStore()
  document.body.innerHTML = ''
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:img-${++n}`)
  URL.revokeObjectURL = vi.fn()
  Element.prototype.scrollTo = vi.fn() as never
  pdf.destroy.mockClear()
  pdf.getDocument.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

const mountWith = (store: ReturnType<typeof createStore>) =>
  mount(ExamScreen, { global: { provide: { [STORE_KEY as symbol]: store } } })

async function started(startResp: StartResponse, over: Record<string, unknown> = {}) {
  const api = mkApi(startResp, over)
  const s = createStore({ api: api as never, storage, now: () => Date.now() })
  await s.init()
  await s.join('123456', 'abcd')
  await s.start()
  return { s, api }
}

describe('fayl + kalit: ko`rsatkich va javob varaqasi', () => {
  it('PDF: token bilan olinadi, pdfjs hujjati ochiladi, sahifalar soni, navigatsiya va kattalashtirish', async () => {
    const { s, api } = await started(view())
    const w = mountWith(s)
    await flushPromises()
    expect(api.file).toHaveBeenCalledWith('f'.repeat(24))
    expect(pdf.getDocument).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="file-exam"]').exists()).toBe(true)
    expect(w.find('[data-testid="question"]').exists()).toBe(false) // oddiy savol kartasi yo'q
    expect(w.get('[data-testid="file-variant"]').text()).toBe('A varianti')
    expect(w.findAll('[data-testid="file-page"]')).toHaveLength(3)
    expect(w.get('[data-testid="file-page-info"]').text()).toBe('1 / 3-sahifa')
    expect(w.get('[data-testid="file-zoom"]').text()).toBe('100%')
    await w.get('[data-testid="file-zoom-in"]').trigger('click')
    expect(w.get('[data-testid="file-zoom"]').text()).toBe('125%')
    await w.get('[data-testid="file-zoom-out"]').trigger('click')
    await w.get('[data-testid="file-zoom-out"]').trigger('click')
    expect(w.get('[data-testid="file-zoom"]').text()).toBe('75%')
    await w.get('[data-testid="file-next"]').trigger('click')
    expect(w.get('[data-testid="file-page-info"]').text()).toBe('2 / 3-sahifa')
    expect((w.get('[data-testid="file-prev"]').element as HTMLButtonElement).disabled).toBe(false)
    // sahifa o'lchami zoom ga mos (kenglik)
    expect((w.get('[data-testid="file-page"]').element as HTMLElement).style.width).toMatch(/px$/)
    w.unmount()
    expect(pdf.destroy).toHaveBeenCalled() // xotira bo'shatiladi
  })

  it('rasmlar: tartib saqlanadi, har biri token bilan olinadi, blob URL tozalanadi; yuklanmasa "Qayta urinish"', async () => {
    const { s, api } = await started(view({ files: [imgFile] }))
    const w = mountWith(s)
    await flushPromises()
    expect(api.file.mock.calls.map((c) => c[0])).toEqual(['1'.repeat(24), '2'.repeat(24)])
    const imgs = w.findAll('img[data-testid="file-page"]')
    expect(imgs.map((i) => i.attributes('src'))).toEqual(['blob:img-1', 'blob:img-2'])
    expect(w.get('[data-testid="file-page-info"]').text()).toBe('1 / 2-rasm')
    w.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)

    const failing = await started(view({ files: [imgFile] }), {
      file: vi
        .fn()
        .mockRejectedValueOnce(new Error('Internet yo‘q'))
        .mockResolvedValue(new Blob(['x'])),
    })
    const w2 = mountWith(failing.s)
    await flushPromises()
    expect(w2.get('[data-testid="file-error"]').text()).toContain('Internet yo‘q')
    await w2.get('[data-testid="file-retry"]').trigger('click')
    await flushPromises()
    expect(w2.find('[data-testid="file-error"]').exists()).toBe(false)
    expect(w2.findAll('img[data-testid="file-page"]')).toHaveLength(2)
  })

  it('javob varaqasi: 1..N qatorlar, tanlash/ko`p tanlash/qisqa javob; javoblar navbat orqali serverga ketadi', async () => {
    const { s, api } = await started(view())
    const w = mountWith(s)
    await flushPromises()
    expect(w.findAll('[data-testid^="sheet-row-"]')).toHaveLength(4)
    expect(w.get('[data-testid="sheet-count"]').text()).toBe('0 / 4')
    // 3-savolda 5 ta variant (E gacha), 1-savolda 4 ta
    expect(w.find('[data-testid="sheet-opt-3-E"]').exists()).toBe(true)
    expect(w.find('[data-testid="sheet-opt-1-E"]').exists()).toBe(false)
    await w.get('[data-testid="sheet-opt-1-C"]').trigger('click')
    await w.get('[data-testid="sheet-opt-1-B"]').trigger('click') // single: almashadi
    await w.get('[data-testid="sheet-opt-3-B"]').trigger('click')
    await w.get('[data-testid="sheet-opt-3-D"]').trigger('click') // multi: qo'shiladi
    await w.get('[data-testid="sheet-text-2"]').setValue('25,5')
    expect(s.state.answers['fk:F1:A:1']!.value).toBe('B')
    expect(s.state.answers['fk:F1:A:3']!.value).toEqual(['B', 'D'])
    expect(s.state.answers['fk:F1:A:2']!.value).toBe('25,5')
    expect(w.get('[data-testid="sheet-opt-1-B"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-testid="sheet-opt-1-C"]').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-testid="sheet-count"]').text()).toBe('3 / 4')
    // mavjud navbat (offline-xavfsiz) yuboradi: yangi shakl qid = fk:...
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(api.saveAnswers).toHaveBeenCalled()
    const sent = api.saveAnswers.mock.calls.flatMap(
      (c) => (c[0] as { answers: { qid: string; value: unknown }[] }).answers,
    )
    const last = (qid: string) => [...sent].reverse().find((a) => a.qid === qid)?.value
    expect(last('fk:F1:A:1')).toBe('B')
    expect(last('fk:F1:A:3')).toEqual(['B', 'D'])
    expect(last('fk:F1:A:2')).toBe('25,5')
    // javob bekor qilish (qayta bosish)
    await w.get('[data-testid="sheet-opt-1-B"]').trigger('click')
    expect(s.state.answers['fk:F1:A:1']!.value).toBeNull()
  })

  it('internet yo`q: javoblar telefonda saqlanadi, qayta ochilganda varaqada tiklanadi', async () => {
    const down = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'ApiError' }))
    const { s } = await started(view(), { saveAnswers: down })
    const w = mountWith(s)
    await flushPromises()
    await w.get('[data-testid="sheet-opt-3-E"]').trigger('click')
    expect([...storage.data.keys()].some((k) => k.startsWith('exam.q.'))).toBe(true)
    // qayta kirish: server saqlanganlarni qaytaradi, mahalliy navbat ham hisobga olinadi
    const api2 = mkApi(view({ saved: [{ id: 'fk:F1:A:1', value: 'C', flagged: false }] }))
    const s2 = createStore({ api: api2 as never, storage, now: () => Date.now() })
    await s2.init()
    await s2.join('123456', 'abcd')
    await s2.start()
    const w2 = mountWith(s2)
    await flushPromises()
    expect(w2.get('[data-testid="sheet-opt-1-C"]').attributes('aria-pressed')).toBe('true')
  })

  it('blokma-blok: fayl bloki -> bank bloki: javob varaqasi yo`qoladi, oddiy savol kartasi chiqadi; fayl ko`rsatkichi tozalanadi', async () => {
    const { s, api } = await started(view())
    const w = mountWith(s)
    await flushPromises()
    expect(w.find('[data-testid="file-exam"]').exists()).toBe(true)
    expect(w.get('[data-testid="submit"]').text()).toBe('Blokni yakunlash')
    await w.get('[data-testid="submit"]').trigger('click')
    await w.get('[data-testid="submit-confirm"]').trigger('click')
    await flushPromises()
    expect(api.finishBlock).toHaveBeenCalledWith({ blockId: 'F1' })
    expect(s.state.files).toEqual([])
    expect(w.find('[data-testid="file-exam"]').exists()).toBe(false)
    expect(w.find('[data-testid="answer-sheet"]').exists()).toBe(false)
    expect(w.get('[data-testid="question"]').text()).toContain('Lang 1')
    expect(pdf.destroy).toHaveBeenCalled()
  })

  it('umumiy vaqt: bir nechta blok, fayl bloki savollari faqat o`z blokida; bank bloki oddiy ko`rinadi', async () => {
    const { s } = await started(
      view({
        timingMode: 'common',
        block: null,
        questions: [...fileQs, bankQ],
        files: [pdfFile],
      }),
    )
    const w = mountWith(s)
    await flushPromises()
    expect(w.findAll('[data-testid^="sheet-row-"]')).toHaveLength(4)
    s.goto(4) // bank bloki
    await flushPromises()
    expect(w.find('[data-testid="file-exam"]').exists()).toBe(false)
    expect(w.get('[data-testid="question"]').text()).toContain('Lang 1')
    s.goto(1) // yana fayl bloki
    await flushPromises()
    expect(w.find('[data-testid="file-exam"]').exists()).toBe(true)
  })

  it('eski imtihon (files yo`q): oddiy savol ko`rinishi o`zgarmagan', async () => {
    const { s } = await started(
      view({
        files: undefined,
        timingMode: 'common',
        block: null,
        questions: [bankQ],
      }),
    )
    const w = mountWith(s)
    await flushPromises()
    expect(w.find('[data-testid="file-exam"]').exists()).toBe(false)
    expect(w.find('[data-testid="question"]').exists()).toBe(true)
    expect(s.state.files).toEqual([])
  })
})

describe('natija ekrani: fayl savollari', () => {
  it('to`g`ri javob harfi ko`rsatiladi (variant mazmuni yo`q), savol raqami varaqadagi raqam', async () => {
    const { default: ResultScreen } = await import('./components/ResultScreen.vue')
    const { s } = await started(view())
    s.state.result = {
      status: 'submitted',
      mode: 'score_answers',
      available: true,
      submittedAt: iso(T0),
      answeredCount: 4,
      total: 4,
      score: { earned: 1, max: 4, autoMax: 4, essayPending: 0 },
      review: [
        {
          id: 'fk:F1:A:3',
          blockId: 'F1',
          type: 'multi',
          got: 0,
          max: 1,
          ok: false,
          given: ['A'],
          reveal: { optionIds: ['B', 'D'] },
        },
        {
          id: 'fk:F1:A:2',
          blockId: 'F1',
          type: 'short',
          got: 1,
          max: 1,
          ok: true,
          given: '25',
          reveal: { texts: ['25', '25,0'] },
        },
      ],
    }
    const w = mount(ResultScreen, { global: { provide: { [STORE_KEY as symbol]: s } } })
    const items = w.findAll('[data-testid="review-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Savol 3')
    expect(items[0]!.text()).toContain('Sizning javobingiz: A')
    expect(items[0]!.text().replace(/\s+/g, '')).toContain('To‘g‘rijavob:BD')
    expect(items[1]!.text()).toContain('Savol 2')
    expect(items[1]!.text()).toContain('25 / 25,0')
  })
})

describe('qog`oz yetkazish: variant tanlash', () => {
  const paperPending: FileBlockView = {
    blockId: 'F1',
    delivery: 'paper',
    variants: ['A', 'B'],
    variant: null,
    kind: 'pdf',
    files: [],
  }
  const paperChosen: FileBlockView = { ...paperPending, variant: 'B' }
  const chosenView = (): StartResponse =>
    view({
      questions: fileQs.map((q) => ({ ...q, id: q.id.replace(':A:', ':B:'), variant: 'B' })),
      files: [paperChosen],
    })

  it('tanlashdan oldin savollar yo`q: tanlash kartochkasi; tasdiq dialogi; tasdiqlagach server chaqiriladi, javob varaqasi (fayl ko`rsatkichisiz) chiqadi', async () => {
    const { s, api } = await started(
      view({ questions: [], files: [paperPending], timingMode: 'common', block: null }),
    )
    api.chooseVariant.mockResolvedValue(chosenView())
    const w = mountWith(s)
    await flushPromises()
    expect(w.find('[data-testid="variant-picker"]').exists()).toBe(true)
    expect(w.find('[data-testid="file-viewer"]').exists()).toBe(false)
    expect(w.find('[data-testid="answer-sheet"]').exists()).toBe(false)
    expect((w.get('[data-testid="variant-continue"]').element as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(w.findAll('[data-testid^="variant-"][role="radio"]').map((b) => b.text())).toEqual([
      'A',
      'B',
    ])
    await w.get('[data-testid="variant-B"]').trigger('click')
    await w.get('[data-testid="variant-continue"]').trigger('click')
    expect(w.get('[data-testid="variant-dialog"]').text()).toContain(
      '“B” variantini tasdiqlaysizmi?',
    )
    expect(w.get('[data-testid="variant-dialog"]').text()).toContain('o‘zgartirib bo‘lmaydi')
    await w.get('[data-testid="variant-back"]').trigger('click')
    expect(api.chooseVariant).not.toHaveBeenCalled()
    await w.get('[data-testid="variant-continue"]').trigger('click')
    await w.get('[data-testid="variant-confirm"]').trigger('click')
    await flushPromises()
    expect(api.chooseVariant).toHaveBeenCalledWith({ blockId: 'F1', variant: 'B' })
    expect(w.find('[data-testid="variant-picker"]').exists()).toBe(false)
    expect(w.find('[data-testid="file-viewer"]').exists()).toBe(false) // qog'oz: fayl yo'q
    expect(w.findAll('[data-testid^="sheet-row-"]')).toHaveLength(4)
    expect(api.file).not.toHaveBeenCalled()
    // javob varaqasi doim ochiq (qog'ozda), javoblar yangi savol id lari bilan
    await w.get('[data-testid="sheet-opt-1-C"]').trigger('click')
    expect(s.state.answers['fk:F1:B:1']!.value).toBe('C')
  })

  it('xato bo`lsa (boshqa qurilmada tanlangan): xabar va holat qayta yuklanadi; blokma-blok rejimda savollarsiz blok ko`rsatiladi', async () => {
    const { s, api } = await started(view({ questions: [], files: [paperPending] }))
    api.chooseVariant.mockRejectedValue(new Error('x'))
    api.start.mockResolvedValue(chosenView())
    const w = mountWith(s)
    await flushPromises()
    // per_block + savollar yo'q: butun ekran yo'qolmaydi, tanlash kartochkasi turadi
    expect(w.find('[data-testid="exam"]').exists()).toBe(true)
    expect(w.find('[data-testid="variant-picker"]').exists()).toBe(true)
    expect(w.find('[data-testid="question"]').exists()).toBe(false)
    await w.get('[data-testid="variant-A"]').trigger('click')
    await w.get('[data-testid="variant-continue"]').trigger('click')
    await w.get('[data-testid="variant-confirm"]').trigger('click')
    await flushPromises()
    expect(s.state.files[0]!.variant).toBe('B') // /start dan qayta yuklandi
    expect(w.find('[data-testid="variant-picker"]').exists()).toBe(false)
  })

  it('ekranli blok va qog`ozli blok aralash (umumiy vaqt): qog`oz bloki tanlanmaguncha boshqa blok ishlaydi', async () => {
    const { s } = await started(
      view({
        timingMode: 'common',
        block: null,
        questions: [bankQ],
        files: [paperPending],
      }),
    )
    const w = mountWith(s)
    await flushPromises()
    expect(w.find('[data-testid="variant-picker"]').exists()).toBe(true)
    expect(w.get('[data-testid="question"]').text()).toContain('Lang 1') // bank savoli ishlaydi
    expect(w.find('[data-testid="block-tabs"]').exists()).toBe(false) // savolsiz blok yorlig'i yo'q
  })

  it('fayl muddati tugagan (410): ko`rsatkichda aniq xabar', async () => {
    const { ApiError } = await import('./lib/api')
    const { s } = await started(view(), {
      file: vi.fn().mockRejectedValue(new ApiError(410, 'FILE_EXPIRED', 'Fayl muddati tugagan')),
    })
    const w = mountWith(s)
    await flushPromises()
    expect(w.get('[data-testid="file-error"]').text()).toContain('Fayl muddati tugagan')
    // javob varaqasi baribir ishlaydi
    await w.get('[data-testid="sheet-opt-1-C"]').trigger('click')
    expect(s.state.answers['fk:F1:A:1']!.value).toBe('C')
  })
})
