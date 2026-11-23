import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type { MyBlockDetail, RandomQuestion, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { ruleLabel } from '@/utils/examRules'

const api = {
  myBlock: vi.fn(),
  subjects: vi.fn(),
  listTopics: vi.fn(),
  randomAvailability: vi.fn(),
  randomPreview: vi.fn(),
  randomReplace: vi.fn(),
  addToBlock: vi.fn(),
  addBlockRule: vi.fn(),
  updateBlockRule: vi.fn(),
  removeBlockRule: vi.fn(),
  composerRemoveRule: vi.fn(),
  composerBlockQuestions: vi.fn(),
  getSession: vi.fn(),
  getQuestion: vi.fn(),
  myBlocks: vi.fn(),
  markBlockReady: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import BlockReviewView from './BlockReviewView.vue'
import MyBlockView from './MyBlockView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mounted: { unmount: () => void }[] = []
const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
const $$ = (sel: string) => [...document.body.querySelectorAll(sel)] as HTMLElement[]
const click = async (el: Element | null) => {
  ;(el as HTMLElement).click()
  await flushPromises()
}
const setNum = async (id: string, v: string) => {
  const el = $(id) as HTMLInputElement
  el.value = v
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

const avail = (over: Record<string, unknown> = {}) => ({
  difficulties: {
    '1': { total: 12, inExam: 3, available: 9 },
    '2': { total: 20, inExam: 0, available: 20 },
    '3': { total: 4, inExam: 1, available: 3 },
  },
  topics: ['Algebra', 'Geometriya'],
  ...over,
})
const rq = (id: string, difficulty: number, text = `Savol ${id}`): RandomQuestion => ({
  id,
  difficulty,
  type: 'single',
  points: 1,
  content: [{ type: 'text', text }],
  options: [
    { id: 'a', content: [{ type: 'text', text: 'Birinchi' }], correct: false },
    { id: 'b', content: [{ type: 'text', text: 'Ikkinchi' }], correct: true },
  ],
})
const detail = (over: Partial<MyBlockDetail> = {}): MyBlockDetail => ({
  role: 'contributor',
  exam: { id: 'e1', title: 'DTM', contribDeadline: null },
  block: {
    id: 'b1',
    subjectId: 'math',
    subjectName: 'Matematika',
    title: 'Matematika',
    targetCount: 20,
    count: 2,
    status: 'open',
    locked: false,
    lockReason: null,
    canMarkReady: true,
  },
  questions: [],
  rules: [],
  ...over,
})

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  api.myBlock.mockResolvedValue(detail())
  api.myBlocks.mockResolvedValue([])
  api.subjects.mockResolvedValue({ scope: 'all', subjects: [{ id: 'math', name: 'Matematika' }] })
  api.listTopics.mockResolvedValue({
    topics: [
      { id: 't1', name: 'Algebra', questionsCount: 20 },
      { id: 't2', name: 'Geometriya', questionsCount: 12 },
    ],
  })
  api.randomAvailability.mockResolvedValue(avail())
  for (const t of [...useToast().toasts]) useToast().dismiss(t.id)
  useConfirm().settle(false)
})

async function mountBlock(comp: unknown, path: string, routePath: string, role = 'teacher') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('t', {
    id: 'u1',
    role,
    schoolId: 's1',
    permissions: role === 'teacher' ? [] : ['exams.manage'],
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
      { path: '/exams/questions/:id/edit', name: 'exam-question-edit', component: empty },
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
const openModal = async () => {
  const { w } = await mountBlock(
    MyBlockView,
    '/exams/blocks/e1/b1',
    '/exams/blocks/:sessionId/:blockId',
  )
  await w.get('[data-testid="tab-bank"]').trigger('click')
  await w.get('[data-testid="myblock-random"]').trigger('click')
  await flushPromises()
  return w
}

describe('"Daraja bo`yicha tasodifiy": oyna va mavjudlik', () => {
  it('"Bankdan" yorlig`ida tugma; oyna ochilganda barcha mavzular bo`yicha mavjudlik daraja kesimida ko`rinadi', async () => {
    const w = await openModal()
    expect($('random-modal')).not.toBeNull()
    expect(api.randomAvailability).toHaveBeenCalledWith('e1', 'b1', { allTopics: true, type: null })
    expect($('rp-avail-easy').textContent).toContain(
      'Oson: bankda 12 ta, 3 tasi allaqachon imtihonda',
    )
    expect($('rp-avail-medium').textContent).toContain('tanlash mumkin: 20')
    expect($('rp-avail-hard').textContent).toContain(
      'Qiyin: bankda 4 ta, 1 tasi allaqachon imtihonda',
    )
    w.unmount()
  })

  it('mavzularni qo`lda tanlash va tur filtri mavjudlikni qayta so`raydi (kechiktirib)', async () => {
    vi.useFakeTimers()
    try {
      const { w } = await mountBlock(
        MyBlockView,
        '/exams/blocks/e1/b1',
        '/exams/blocks/:sessionId/:blockId',
      )
      await w.get('[data-testid="tab-bank"]').trigger('click')
      await w.get('[data-testid="myblock-random"]').trigger('click')
      await flushPromises()
      api.randomAvailability.mockClear()
      // "barcha mavzular" o'chadi -> ro'yxat; hech narsa tanlanmagan: so'rov yo'q
      const all = $('rp-all').querySelector('input') as HTMLInputElement
      all.click()
      await vi.advanceTimersByTimeAsync(300)
      expect(api.randomAvailability).not.toHaveBeenCalled()
      await click($('rp-topic-t1').querySelector('input'))
      await click($('rp-topic-t2').querySelector('input'))
      await vi.advanceTimersByTimeAsync(300)
      expect(api.randomAvailability).toHaveBeenLastCalledWith('e1', 'b1', {
        topicIds: ['t1', 't2'],
        type: null,
      })
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Rejim 1: tanlash, almashtirish, olib tashlash, qo`shish', () => {
  const items = [rq('q1', 2), rq('q2', 2), rq('q3', 3)]

  it('tasodifiy tanlash: daraja sonlari serverga ketadi, ro`yxatda matn va to`g`ri javob belgisi; "N ta savolni qo`shish"', async () => {
    api.randomPreview.mockResolvedValue({
      items,
      available: { '1': 9, '2': 20, '3': 3 },
      shortfall: { '1': 0, '2': 0, '3': 0 },
    })
    api.addToBlock.mockResolvedValue({ added: 3, skipped: 0, count: 5, target: 20 })
    await openModal()
    await setNum('rp-count-medium', '2')
    await setNum('rp-count-hard', '1')
    await click($('rp-pick'))
    expect(api.randomPreview).toHaveBeenCalledWith('e1', 'b1', {
      allTopics: true,
      type: null,
      counts: { easy: 0, medium: 2, hard: 1 },
    })
    expect($$('[data-testid^="rp-item-"]')).toHaveLength(3)
    expect($('rp-item-0').textContent).toContain('Savol q1')
    expect($('rp-item-0').textContent).toContain("O'rta")
    expect($('rp-item-2').textContent).toContain('Qiyin')
    const correct = $('rp-item-0').querySelectorAll('[data-correct="true"]')
    expect(correct).toHaveLength(1)
    expect(correct[0]!.textContent).toContain('Ikkinchi')
    expect($('rp-add').textContent).toContain("3 ta savolni qo'shish")
    await click($('rp-add'))
    expect(api.addToBlock).toHaveBeenCalledWith('e1', 'b1', ['q1', 'q2', 'q3'])
    expect(JSON.stringify(useToast().toasts)).toContain("3 ta savol qo'shildi")
    expect($('random-modal')).toBeNull() // oyna yopildi
    expect(api.myBlock).toHaveBeenCalledTimes(2) // qayta yuklandi
  })

  it('almashtirish: joriy ro`yxat "exclude" bilan yuboriladi va faqat shu savol almashadi; olib tashlash soni kamaytiradi', async () => {
    api.randomPreview.mockResolvedValue({
      items,
      available: { '1': 0, '2': 20, '3': 3 },
      shortfall: { '1': 0, '2': 0, '3': 0 },
    })
    api.randomReplace.mockResolvedValue({ item: rq('q9', 2, 'Yangi savol'), remaining: 5 })
    await openModal()
    await setNum('rp-count-medium', '2')
    await click($('rp-pick'))
    await click($('rp-replace-1'))
    expect(api.randomReplace).toHaveBeenCalledWith('e1', 'b1', {
      allTopics: true,
      type: null,
      difficulty: 2,
      exclude: ['q1', 'q2', 'q3'],
    })
    expect($$('[data-qid]').map((x) => x.dataset.qid)).toEqual(['q1', 'q9', 'q3'])
    expect($('rp-item-1').textContent).toContain('Yangi savol')
    await click($('rp-remove-0'))
    expect($$('[data-qid]').map((x) => x.dataset.qid)).toEqual(['q9', 'q3'])
    expect($('rp-add').textContent).toContain("2 ta savolni qo'shish")
    // almashtirish uchun boshqa savol yo'q
    api.randomReplace.mockRejectedValue(
      new ApiError('CONFLICT', 'Almashtirish uchun boshqa savol qolmadi', 409),
    )
    await click($('rp-replace-0'))
    expect(JSON.stringify(useToast().toasts)).toContain('Almashtirish uchun boshqa savol qolmadi')
  })

  it('yetarli savol yo`q: aniq xabar (kerak/bor), bor qadarini qo`shish mumkin; hamma olib tashlansa "qo`shish" o`chiq', async () => {
    api.randomPreview.mockResolvedValue({
      items: [rq('q1', 3), rq('q2', 3)],
      available: { '1': 0, '2': 0, '3': 2 },
      shortfall: { '1': 0, '2': 0, '3': 3 },
    })
    await openModal()
    await setNum('rp-count-hard', '5')
    await click($('rp-pick'))
    expect($('rp-shortfall').textContent).toContain('Qiyin: kerak 5, bor 2')
    expect($('rp-add').textContent).toContain("2 ta savolni qo'shish")
    await click($('rp-remove-0'))
    await click($('rp-remove-0'))
    expect(($('rp-add') as HTMLButtonElement).disabled).toBe(true)
  })

  it('hech narsa kiritilmasa tushunarli xabar va so`rov yo`q', async () => {
    await openModal()
    await click($('rp-pick'))
    expect($('rp-error').textContent).toContain('kamida bitta savol soni')
    expect(api.randomPreview).not.toHaveBeenCalled()
  })
})

describe('Rejim 2: qoida saqlash va ko`rsatish', () => {
  it('har daraja uchun alohida qoida (bir nechta mavzu bilan); yetmasa ogohlantirish', async () => {
    vi.useFakeTimers()
    try {
      api.addBlockRule
        .mockResolvedValueOnce({ ruleId: 'r1', poolSize: 20, enough: true })
        .mockResolvedValueOnce({ ruleId: 'r2', poolSize: 1, enough: false })
      const { w } = await mountBlock(
        MyBlockView,
        '/exams/blocks/e1/b1',
        '/exams/blocks/:sessionId/:blockId',
      )
      await w.get('[data-testid="tab-bank"]').trigger('click')
      await w.get('[data-testid="myblock-random"]').trigger('click')
      await flushPromises()
      ;($('rp-all').querySelector('input') as HTMLInputElement).click()
      await flushPromises()
      await click($('rp-topic-t1').querySelector('input'))
      await click($('rp-topic-t2').querySelector('input'))
      await click($('rp-mode2'))
      await setNum('rp-count-medium', '10')
      await setNum('rp-count-hard', '2')
      await click($('rp-save-rule'))
      expect(api.addBlockRule).toHaveBeenCalledTimes(2)
      expect(api.addBlockRule).toHaveBeenNthCalledWith(1, 'e1', 'b1', {
        topicIds: ['t1', 't2'],
        type: null,
        difficulty: 2,
        count: 10,
      })
      expect(api.addBlockRule).toHaveBeenNthCalledWith(2, 'e1', 'b1', {
        topicIds: ['t1', 't2'],
        type: null,
        difficulty: 3,
        count: 2,
      })
      const msg = JSON.stringify(useToast().toasts)
      expect(msg).toContain('Qoida saqlandi')
      expect(msg).toContain("qoida saqlandi, lekin rejalashtirishdan oldin savol qo'shing")
      expect($('random-modal')).toBeNull()
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('blok ro`yxatida: "Qoida: Algebra, Geometriya · O`rta 10 ta (har o`quvchiga tasodifiy)", hovuz hajmi, tahrirlash va olib tashlash (faqat o`ziniki)', async () => {
    api.myBlock.mockResolvedValue(
      detail({
        rules: [
          {
            ruleId: 'r1',
            topicId: 't1',
            topicIds: ['t1', 't2'],
            allTopics: false,
            topicName: 'Algebra, Geometriya',
            count: 10,
            difficulty: 2,
            type: null,
            canRemove: true,
            poolSize: 13,
          },
          {
            ruleId: 'r2',
            topicId: '',
            allTopics: true,
            topicName: null,
            count: 5,
            difficulty: 3,
            type: null,
            canRemove: false,
            poolSize: 3,
          },
          {
            ruleId: null,
            topicId: 't1',
            topicName: 'Algebra',
            count: 4,
            difficulty: null,
            type: null,
          },
        ],
      }),
    )
    api.updateBlockRule.mockResolvedValue({ ruleId: 'r1', count: 8 })
    api.removeBlockRule.mockResolvedValue({ removed: true })
    const { w } = await mountBlock(
      MyBlockView,
      '/exams/blocks/e1/b1',
      '/exams/blocks/:sessionId/:blockId',
    )
    const rows = w.findAll('[data-testid^="myblock-rule-"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.get('[data-testid="rule-text"]').text()).toBe(
      "Qoida: Algebra, Geometriya · O'rta 10 ta (har o'quvchiga tasodifiy)",
    )
    expect(rows[0]!.get('[data-testid="rule-pool"]').text()).toBe('bankda 13 ta mos savol')
    expect(rows[1]!.get('[data-testid="rule-text"]').text()).toContain(
      'barcha mavzular · Qiyin 5 ta',
    )
    // yetmaydi: ogohlantirish; boshqaning qoidasida tugmalar yo'q
    expect(rows[1]!.find('[data-testid="rule-warning"]').exists()).toBe(true)
    expect(rows[1]!.find('[data-testid="rule-remove"]').exists()).toBe(false)
    expect(rows[0]!.find('[data-testid="rule-warning"]').exists()).toBe(false)
    // eski (tuzuvchi) qoida oddiy matn
    expect(rows[2]!.get('[data-testid="rule-text"]').text()).toBe('Qoida: Algebra mavzusidan 4 ta')
    expect(rows[2]!.find('[data-testid="rule-edit"]').exists()).toBe(false)
    // tahrirlash
    await rows[0]!.get('[data-testid="rule-edit"]').trigger('click')
    const input = rows[0]!.get('[data-testid="rule-count-input"]')
    await input.setValue('8')
    await rows[0]!.get('[data-testid="rule-count-save"]').trigger('click')
    await flushPromises()
    expect(api.updateBlockRule).toHaveBeenCalledWith('e1', 'b1', 'r1', 8)
    // olib tashlash: tasdiq bilan
    const c = useConfirm()
    await rows[0]!.get('[data-testid="rule-remove"]').trigger('click')
    await flushPromises()
    expect(c.state.open).toBe(true)
    c.settle(true)
    await flushPromises()
    expect(api.removeBlockRule).toHaveBeenCalledWith('e1', 'b1', 'r1')
  })

  it('ruleLabel: daraja yo`q bo`lsa ham ishlaydi', () => {
    const t = (k: string, p?: Record<string, unknown>) => i18n.global.t(k, p ?? {}) as string
    expect(
      ruleLabel(t, {
        ruleId: 'x',
        topicId: '',
        allTopics: true,
        topicName: null,
        count: 3,
        difficulty: null,
        type: null,
      }),
    ).toBe("Qoida: barcha mavzular ·  3 ta (har o'quvchiga tasodifiy)")
  })
})

describe('Tuzuvchi ko`rib chiqish sahifasi', () => {
  it('qoidalar hovuz hajmi bilan ko`rinadi; tuzuvchi qoidani olib tashlay oladi (qoralama holatda)', async () => {
    api.getSession.mockResolvedValue({
      id: 'e1',
      title: 'DTM',
      status: 'draft',
      canEdit: true,
      blocks: [
        {
          id: 'b1',
          legacy: false,
          subjectId: 'math',
          subjectName: 'Matematika',
          title: 'Matematika',
          targetCount: 20,
          count: 12,
          status: 'open',
          contributors: [],
          items: [],
          contribQuestions: [],
        },
      ],
    })
    api.composerBlockQuestions.mockResolvedValue({
      questions: [],
      rules: [
        {
          ruleId: 'r1',
          topicId: 't1',
          topicIds: ['t1'],
          allTopics: false,
          topicName: 'Algebra',
          count: 10,
          difficulty: 2,
          type: null,
          poolSize: 7,
          canRemove: true,
        },
      ],
    })
    api.composerRemoveRule.mockResolvedValue({ removed: true })
    const { w } = await mountBlock(
      BlockReviewView,
      '/exams/sessions/e1/review/b1',
      '/exams/sessions/:id/review/:blockId',
      'school_admin',
    )
    const row = w.get('[data-testid="review-rule-0"]')
    expect(row.text()).toContain("Qoida: Algebra · O'rta 10 ta (har o'quvchiga tasodifiy)")
    expect(row.get('[data-testid="review-rule-pool"]').text()).toBe('bankda 7 ta mos savol')
    expect(row.text()).toContain("Bankda hozircha yetarli savol yo'q (kerak 10, bor 7)")
    const c = useConfirm()
    await row.get('[data-testid="review-rule-remove"]').trigger('click')
    await flushPromises()
    c.settle(true)
    await flushPromises()
    expect(api.composerRemoveRule).toHaveBeenCalledWith('e1', 'b1', 'r1')
  })
})
