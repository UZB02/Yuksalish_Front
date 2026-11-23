import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type {
  MyBlockDetail,
  MyBlockItem,
  PasteCommitResult,
  PasteQuestion,
  PastePreview,
  User,
} from '@/api/types'
import { NAV_ITEMS } from '@/constants/navigation'
import { canAccess } from '@/router/guards'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { deadlineLeft, taskStatus } from '@/utils/examTasks'

const api = {
  myBlocks: vi.fn(),
  myBlock: vi.fn(),
  listTopics: vi.fn(),
  markBlockReady: vi.fn(),
  blockPastePreview: vi.fn(),
  blockPasteCommit: vi.fn(),
  pastePreview: vi.fn(),
  pasteCommit: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import MyBlockView from './MyBlockView.vue'
import MyExamTasksView from './MyExamTasksView.vue'
import PasteQuestions from '@/components/exams/PasteQuestions.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})
beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  api.listTopics.mockResolvedValue([])
  for (const t of [...useToast().toasts]) useToast().dismiss(t.id)
})

async function mountRoute(comp: unknown, path: string, routePath: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('t', {
    id: 'u1',
    role: 'teacher',
    schoolId: 's1',
    permissions: [],
  } as unknown as User)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, name: 'cur', component: comp as never },
      { path: '/exams/tasks', name: 'exam-tasks', component: empty },
      { path: '/exams/sessions/:id', name: 'exam-session', component: empty },
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

const day = 86_400_000
const task = (over: Partial<MyBlockItem> = {}): MyBlockItem => ({
  sessionId: 'e1',
  blockId: 'b1',
  examTitle: 'DTM sinov — noyabr',
  examStatus: 'draft',
  subjectId: 'math',
  subjectName: 'Matematika',
  title: 'Matematika',
  targetCount: 30,
  count: 12,
  blockStatus: 'open',
  readyBy: null,
  contribDeadline: new Date(Date.now() + 4 * day + 3_600_000).toISOString(),
  locked: false,
  lockReason: null,
  ...over,
})

describe('utils/examTasks', () => {
  it('taskStatus: yig`ilmoqda / tugatdim / tasdiqlangan / faqat o`qish', () => {
    const b = { locked: false, lockReason: null, blockStatus: 'open' as const }
    expect(taskStatus(b)).toBe('collecting')
    expect(taskStatus({ ...b, blockStatus: 'ready' })).toBe('done')
    expect(taskStatus({ locked: true, lockReason: 'ready', blockStatus: 'ready' })).toBe('approved')
    expect(taskStatus({ locked: true, lockReason: 'deadline', blockStatus: 'open' })).toBe(
      'readonly',
    )
    expect(taskStatus({ locked: true, lockReason: 'status', blockStatus: 'open' })).toBe('readonly')
  })

  it('deadlineLeft: kun, soat, bir soatdan kam, o`tgan, muddatsiz', () => {
    const now = Date.parse('2026-11-18T10:00:00Z')
    const at = (ms: number) => new Date(now + ms).toISOString()
    expect(deadlineLeft(at(4 * day + 3_600_000), now)).toEqual({ kind: 'days', n: 4 })
    expect(deadlineLeft(at(5 * 3_600_000 + 60_000), now)).toEqual({ kind: 'hours', n: 5 })
    expect(deadlineLeft(at(30 * 60_000), now)).toEqual({ kind: 'soon' })
    expect(deadlineLeft(at(-1000), now)).toEqual({ kind: 'overdue' })
    expect(deadlineLeft(null, now)).toEqual({ kind: 'none' })
    expect(deadlineLeft('xato', now)).toEqual({ kind: 'none' })
  })

  it('menyu bandi: faqat o`qituvchiga, imtihon moduli yoqilganda', () => {
    const item = NAV_ITEMS.find((i) => i.name === 'exam-tasks')!
    expect(item.labelKey).toBe('nav.examTasks')
    expect(uz.nav.examTasks).toBe('Mening imtihon vazifalarim')
    const ctx = (role: string, on = true) => ({
      hasRole: (r?: string[]) => !r || r.includes(role),
      hasPermission: (p?: string) => !p || p === 'exams.questions',
      isFeatureEnabled: () => on,
    })
    expect(canAccess(ctx('teacher') as never, item)).toBe(true)
    expect(canAccess(ctx('school_admin') as never, item)).toBe(false)
    expect(canAccess(ctx('teacher', false) as never, item)).toBe(false)
  })
})

describe('Mening imtihon vazifalarim sahifasi', () => {
  it('kartochka: "Imtihon · Fan", "Kerak: N savol", muddat va necha kun qolgani, progress, holat', async () => {
    api.myBlocks.mockResolvedValue([task()])
    const { w } = await mountRoute(MyExamTasksView, '/exams/tasks', '/exams/tasks')
    expect(w.get('[data-testid="task-title"]').text()).toBe('DTM sinov — noyabr · Matematika')
    const meta = w.get('[data-testid="task-meta"]').text()
    expect(meta).toContain('Kerak: 30 savol')
    expect(meta).toContain('Muddat:')
    expect(w.get('[data-testid="task-left"]').text()).toContain('4 kun qoldi')
    expect(w.get('[data-testid="task-progress"]').text()).toBe('12/30')
    expect(w.get('[data-testid="task-progress"]').classes().join(' ')).toContain('warning')
    expect(w.get('[data-testid="task-status"]').text()).toBe("Yig'ilmoqda")
    expect(w.text().toLowerCase()).not.toContain('blok')
  })

  it('maqsadga yetgan = success rang; holatlar: Tugatdim, Tasdiqlangan, Faqat o`qish', async () => {
    api.myBlocks.mockResolvedValue([
      task({ count: 30, blockStatus: 'ready', blockId: 'b1' }),
      task({ blockId: 'b2', locked: true, lockReason: 'ready', blockStatus: 'ready', count: 30 }),
      task({ blockId: 'b3', locked: true, lockReason: 'deadline' }),
    ])
    const { w } = await mountRoute(MyExamTasksView, '/exams/tasks', '/exams/tasks')
    const statuses = w.findAll('[data-testid="task-status"]').map((x) => x.text())
    // kutilayotgan(yo'q) -> tugatdim ham kutilmaydi: tartib muddat bo'yicha, barchasi pastda
    expect(statuses.sort()).toEqual(
      ['Faqat o`qish'.replace('`', "'"), 'Tasdiqlangan', 'Tugatdim'].sort(),
    )
    expect(w.findAll('[data-testid="task-progress"]')[0]!.classes().join(' ')).toContain('success')
  })

  it('kutilayotganlar tepada; kartochkani bosish vazifa sahifasiga olib boradi', async () => {
    api.myBlocks.mockResolvedValue([
      task({ blockId: 'done', count: 30, blockStatus: 'ready', subjectName: 'Tugagan fan' }),
      task({ blockId: 'todo', subjectName: 'Kutilayotgan fan' }),
    ])
    const { w, router } = await mountRoute(MyExamTasksView, '/exams/tasks', '/exams/tasks')
    const titles = w.findAll('[data-testid="task-title"]').map((x) => x.text())
    expect(titles[0]).toContain('Kutilayotgan fan')
    await w.get('[data-testid="task-0"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-my-block')
    expect(router.currentRoute.value.params).toMatchObject({ sessionId: 'e1', blockId: 'todo' })
  })

  it('vazifa yo`q: bo`sh holat', async () => {
    api.myBlocks.mockResolvedValue([])
    const { w } = await mountRoute(MyExamTasksView, '/exams/tasks', '/exams/tasks')
    expect(w.find('[data-testid="tasks-empty"]').exists()).toBe(true)
    expect(w.find('[data-testid="tasks-list"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
const q = (over: Partial<PasteQuestion> & { idx: number }): PasteQuestion => ({
  number: over.idx,
  line: over.idx,
  content: [{ type: 'text', text: `Savol ${over.idx}` }],
  options: [
    { id: 'A', content: [{ type: 'text', text: 'bir' }] },
    { id: 'B', content: [{ type: 'text', text: 'ikki' }] },
    { id: 'C', content: [{ type: 'math', tex: 'x^2' }] },
  ],
  correct: ['B'],
  type: 'single',
  warnings: [],
  pickable: false,
  ...over,
})
const noAnswer = (idx: number): PasteQuestion =>
  q({
    idx,
    correct: [],
    pickable: true,
    warnings: [{ code: 'noAnswer', message: "To'g'ri javob ko'rsatilmagan", blocking: true }],
  })
const pv = (items: PasteQuestion[]): PastePreview => ({
  stats: {
    total: items.length,
    ok: items.filter((i) => !i.warnings.some((w) => w.blocking)).length,
    problems: items.filter((i) => i.warnings.some((w) => w.blocking)).length,
  },
  items,
  ignored: [],
  limits: { maxQuestions: 200, maxBytes: 70000 },
})
const result = (over: Partial<PasteCommitResult> = {}): PasteCommitResult => ({
  created: 3,
  ids: ['q1', 'q2', 'q3'],
  skipped: [],
  failed: [],
  excluded: 0,
  total: 3,
  addedToBlock: 3,
  count: 15,
  target: 30,
  ...over,
})

const detail = (over: Partial<MyBlockDetail['block']> = {}): MyBlockDetail => ({
  role: 'contributor',
  exam: { id: 'e1', title: 'DTM sinov', contribDeadline: '2026-11-30T05:00:00.000Z' },
  block: {
    id: 'b1',
    subjectId: 'math',
    subjectName: 'Matematika',
    title: 'Matematika',
    targetCount: 30,
    count: 12,
    status: 'open',
    readyBy: null,
    canMarkReady: true,
    locked: false,
    lockReason: null,
    ...over,
  },
  questions: [],
  rules: [],
})

const type = async (w: ReturnType<typeof mount>, value: string) => {
  await w.get('[data-testid="paste-text"]').setValue(value)
}

describe('Vazifa sahifasi: usullar (tablar)', () => {
  it('"Matnni joylash" standart; Word/Excel/Bankdan/Bittalab tablari mavjud va mavjud amallarga ulangan', async () => {
    api.myBlock.mockResolvedValue(detail())
    const { w, router } = await mountRoute(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
    )
    expect(w.get('[data-testid="myblock-title"]').text()).toBe("Matematika uchun savollar qo'shish")
    const tabs = w.findAll('[role="tab"]').map((x) => x.text())
    expect(tabs).toEqual([
      'Matnni joylash',
      'Rasm / PDF (OCR)',
      'Word (.docx)',
      'Excel',
      'Bankdan',
      'Bittalab',
    ])
    expect(w.get('[data-testid="tab-paste"]').attributes('aria-selected')).toBe('true')
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(true)
    expect(w.find('[data-testid="myblock-left"]').exists()).toBe(true)
    expect(w.get('[data-testid="myblock-status"]').text()).toBe("Yig'ilmoqda")
    // Word
    await w.get('[data-testid="tab-word"]').trigger('click')
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(false)
    await w.get('[data-testid="myblock-import-word"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-question-import')
    expect(router.currentRoute.value.query).toMatchObject({
      blockSession: 'e1',
      block: 'b1',
      kind: 'word',
    })
    await router.push('/exams/blocks/e1/b1')
    await flushPromises()
    await w.get('[data-testid="tab-excel"]').trigger('click')
    await w.get('[data-testid="myblock-import-excel"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ kind: 'excel' })
  })

  it('qulflangan vazifada tablar yo`q, sababi tushuntiriladi', async () => {
    api.myBlock.mockResolvedValue(detail({ locked: true, lockReason: 'deadline' }))
    const { w } = await mountRoute(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
    )
    expect(w.find('[data-testid="myblock-tabs"]').exists()).toBe(false)
    expect(w.get('[data-testid="myblock-locked"]').text()).toContain('muddati tugagan')
    expect(w.get('[data-testid="myblock-status"]').text()).toBe("Faqat o'qish")
  })
})

describe('Matnni joylash: jonli ko`rinish va saqlash (vazifa)', () => {
  const mountPaste = async (
    items: PasteQuestion[] = [q({ idx: 1 }), q({ idx: 2 }), noAnswer(3)],
  ) => {
    api.myBlock.mockResolvedValue(detail())
    api.blockPastePreview.mockResolvedValue(pv(items))
    return mountRoute(MyBlockView, '/exams/blocks/e1/b1', '/exams/blocks/:sessionId/:blockId')
  }

  it('matn yozilganda ~300 ms dan keyin BIR marta tekshiriladi; "N ta savol topildi" va tayyor/muammo hisobi', async () => {
    const { w } = await mountPaste()
    expect(w.find('[data-testid="paste-empty"]').exists()).toBe(true)
    await type(w, '1.')
    await type(w, '1. S')
    await type(w, '1. Savol\nA) 1')
    expect(api.blockPastePreview).not.toHaveBeenCalled()
    await sleep(650)
    await flushPromises()
    expect(api.blockPastePreview).toHaveBeenCalledTimes(1)
    expect(api.blockPastePreview).toHaveBeenCalledWith('e1', 'b1', '1. Savol\nA) 1')
    expect(w.get('[data-testid="paste-count"]').text()).toBe('3 ta savol topildi')
    expect(w.get('[data-testid="paste-ok"]').text()).toBe('2 ta tayyor')
    expect(w.get('[data-testid="paste-problems"]').text()).toBe('1 tasida muammo')
    // to'g'ri javob belgilangan
    expect(w.get('[data-testid="paste-opt-1-B"]').classes().join(' ')).toContain('success')
    // formula blok ko'rinadi (KaTeX)
    expect(w.get('[data-testid="paste-opt-1-C"]').html()).toContain('katex')
    expect(w.get('[data-testid="paste-commit"]').text()).toBe("2 ta savolni qo'shish")
  })

  it('javobsiz savol: ogohlantirish va A/B/C tugmalari; tanlangach muammo yo`qoladi va tugma "3 ta savolni qo`shish"', async () => {
    const { w } = await mountPaste()
    await type(w, 'x')
    await sleep(650)
    await flushPromises()
    expect(w.find('[data-testid="paste-warn-3-noAnswer"]').exists()).toBe(true)
    expect(w.find('[data-testid="paste-pick-1"]').exists()).toBe(false)
    await w.get('[data-testid="paste-pick-3-C"]').trigger('click')
    expect(w.find('[data-testid="paste-warn-3-noAnswer"]').exists()).toBe(false)
    expect(w.find('[data-testid="paste-problems"]').exists()).toBe(false)
    expect(w.get('[data-testid="paste-opt-3-C"]').classes().join(' ')).toContain('success')
    expect(w.get('[data-testid="paste-commit"]').text()).toBe("3 ta savolni qo'shish")
    // boshqa harfni bosish tanlovni almashtiradi
    await w.get('[data-testid="paste-pick-3-A"]').trigger('click')
    expect(w.get('[data-testid="paste-opt-3-C"]').classes().join(' ')).not.toContain('success')
    expect(w.get('[data-testid="paste-opt-3-A"]').classes().join(' ')).toContain('success')
  })

  it('saqlash: matn, tanlangan javob, qo`shmaslik, qiyinlik/ball serverga ketadi; keyin toast, matn tozalanadi, vazifa yangilanadi', async () => {
    const { w } = await mountPaste()
    await type(w, '1. a\n...')
    await sleep(650)
    await flushPromises()
    await w.get('[data-testid="paste-pick-3-A"]').trigger('click')
    await w.get('[data-testid="paste-skip-2"]').setValue(true)
    expect(w.get('[data-testid="paste-commit"]').text()).toBe("2 ta savolni qo'shish")
    await w.get('[data-testid="paste-points"]').setValue('2,5')
    api.blockPasteCommit.mockResolvedValue(result({ created: 2 }))
    const before = api.myBlock.mock.calls.length
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect(api.blockPasteCommit).toHaveBeenCalledWith('e1', 'b1', {
      text: '1. a\n...',
      difficulty: 2,
      points: 2.5,
      picks: [{ idx: 3, answer: ['A'] }],
      exclude: [2],
    })
    expect(JSON.stringify(useToast().toasts)).toContain("2 ta savol qo'shildi")
    expect((w.get('[data-testid="paste-text"]').element as HTMLTextAreaElement).value).toBe('')
    expect(w.find('[data-testid="paste-empty"]').exists()).toBe(true)
    expect(api.myBlock.mock.calls.length).toBeGreaterThan(before)
  })

  it('hal qilinmagan muammoli savol saqlanmaydi: faqat tayyorlar hisoblanadi; hammasi muammoli bo`lsa tugma o`chiq', async () => {
    const { w } = await mountPaste([noAnswer(1), noAnswer(2)])
    await type(w, 'x')
    await sleep(650)
    await flushPromises()
    expect(w.get('[data-testid="paste-commit"]').text()).toBe("0 ta savolni qo'shish")
    expect(w.get('[data-testid="paste-commit"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="paste-pick-1-B"]').trigger('click')
    expect(w.get('[data-testid="paste-commit"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-testid="paste-commit"]').text()).toBe("1 ta savolni qo'shish")
  })

  it('server xatosi (hajm chegarasi) ko`rinadi; matn bo`shatilsa tozalanadi', async () => {
    api.myBlock.mockResolvedValue(detail())
    api.blockPastePreview.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'xato', 400, [
        { path: 'text', message: '201 ta savol topildi, bir martada 200 tadan ko‘p bo‘lmaydi' },
      ]),
    )
    const { w } = await mountRoute(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
    )
    await type(w, 'juda ko`p')
    await sleep(650)
    await flushPromises()
    expect(w.get('[data-testid="paste-error"]').text()).toContain('201 ta savol topildi')
    expect(w.get('[data-testid="paste-commit"]').attributes('disabled')).toBeDefined()
    await type(w, '')
    await flushPromises()
    expect(w.find('[data-testid="paste-error"]').exists()).toBe(false)
  })

  it('saqlashda server rad etsa toast xato; matn saqlanib qoladi', async () => {
    const { w } = await mountPaste()
    await type(w, 'abc')
    await sleep(650)
    await flushPromises()
    api.blockPasteCommit.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Blok hozir tahrirlash uchun yopiq', 403, []),
    )
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect((w.get('[data-testid="paste-text"]').element as HTMLTextAreaElement).value).toBe('abc')
    expect(useToast().toasts.some((t) => t.kind === 'error')).toBe(true)
  })

  it('matn o`zgarib savol tarkibi o`zgarsa, tanlangan javob bekor bo`ladi', async () => {
    const { w } = await mountPaste([noAnswer(1)])
    await type(w, 'x')
    await sleep(650)
    await flushPromises()
    await w.get('[data-testid="paste-pick-1-B"]').trigger('click')
    expect(w.find('[data-testid="paste-warn-1-noAnswer"]').exists()).toBe(false)
    api.blockPastePreview.mockResolvedValue(
      pv([
        q({
          idx: 1,
          correct: [],
          pickable: true,
          content: [{ type: 'text', text: 'Boshqa matn' }],
          warnings: [{ code: 'noAnswer', message: 'yo`q', blocking: true }],
        }),
      ]),
    )
    await type(w, 'xy')
    await sleep(650)
    await flushPromises()
    expect(w.find('[data-testid="paste-warn-1-noAnswer"]').exists()).toBe(true)
  })

  it('ko`p javobli savolga Ctrl bilan bir nechta javob tanlanadi', async () => {
    const { w } = await mountPaste([noAnswer(1)])
    await type(w, 'x')
    await sleep(650)
    await flushPromises()
    await w.get('[data-testid="paste-pick-1-A"]').trigger('click')
    await w.get('[data-testid="paste-pick-1-C"]').trigger('click', { ctrlKey: true })
    api.blockPasteCommit.mockResolvedValue(result({ created: 1 }))
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect(api.blockPasteCommit.mock.calls[0]![2].picks).toEqual([{ idx: 1, answer: ['A', 'C'] }])
  })
})

describe('Matnni joylash: savollar banki rejimi', () => {
  const mountBank = (props: Record<string, unknown> = { topicId: 't1' }) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const w = mount(PasteQuestions, {
      props: { mode: 'bank', ...props },
      global: { plugins: [pinia, i18n] },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('bank: pastePreview/pasteCommit, mavzu bilan, standart qoralama; "darhol faol" belgisi', async () => {
    api.pastePreview.mockResolvedValue(pv([q({ idx: 1 })]))
    api.pasteCommit.mockResolvedValue(result({ created: 1, addedToBlock: undefined }))
    const w = mountBank()
    await w.get('[data-testid="paste-text"]').setValue('1. Savol')
    await sleep(650)
    await flushPromises()
    expect(api.pastePreview).toHaveBeenCalledWith('1. Savol')
    expect(api.blockPastePreview).not.toHaveBeenCalled()
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect(api.pasteCommit).toHaveBeenCalledWith({
      text: '1. Savol',
      topicId: 't1',
      status: 'draft',
      difficulty: 2,
      points: 1,
      picks: [],
      exclude: [],
    })
    expect(w.emitted('committed')).toHaveLength(1)
    await w.get('[data-testid="paste-text"]').setValue('2. Yana')
    await sleep(650)
    await flushPromises()
    await w.get('[data-testid="paste-active"] input').setValue(true)
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect(api.pasteCommit.mock.calls[1]![0]).toMatchObject({ status: 'active' })
  })

  it('mavzusiz bank rejimida saqlash tugmasi o`chiq; namuna tugmasi 4 savol joylaydi', async () => {
    api.pastePreview.mockResolvedValue(pv([q({ idx: 1 })]))
    const w = mountBank({})
    await w.get('[data-testid="paste-sample"]').trigger('click')
    expect((w.get('[data-testid="paste-text"]').element as HTMLTextAreaElement).value).toContain(
      '1. 7 + 5 nechiga teng?',
    )
    await sleep(650)
    await flushPromises()
    expect(w.get('[data-testid="paste-commit"]').attributes('disabled')).toBeDefined()
  })
})
