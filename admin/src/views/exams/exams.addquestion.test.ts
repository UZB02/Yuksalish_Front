import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { PasteCommitResult, PastePreview, Question, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const api = {
  subjects: vi.fn(),
  getTopic: vi.fn(),
  listTopics: vi.fn(),
  createTopic: vi.fn(),
  getQuestion: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  myBlock: vi.fn(),
  createInBlock: vi.fn(),
  pastePreview: vi.fn(),
  pasteCommit: vi.fn(),
  teachers: vi.fn(),
  uploadAsset: vi.fn(),
  fetchAssetBlob: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import QuestionEditorView from './QuestionEditorView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

async function mountAt(path: string) {
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
      { path: '/exams/questions', name: 'exam-questions', component: empty },
      { path: '/exams/topics/:topicId', name: 'exam-topic', component: empty },
      { path: '/exams/questions/new', name: 'exam-question-create', component: QuestionEditorView },
      {
        path: '/exams/questions/:id/edit',
        name: 'exam-question-edit',
        component: QuestionEditorView,
      },
      { path: '/exams/questions/import', name: 'exam-question-import', component: empty },
      { path: '/exams/blocks/:sessionId/:blockId', name: 'exam-my-block', component: empty },
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

const saved = (over: Partial<Question> = {}): Question =>
  ({
    id: 'n1',
    subjectId: 'math',
    subjectName: 'Matematika',
    topicId: 't1',
    topicName: 'Kasrlar',
    difficulty: 3,
    type: 'single',
    points: 2,
    status: 'active',
    version: 1,
    authorId: 'u1',
    authorName: 'Ustoz',
    isMine: true,
    isShared: false,
    sharedWithMe: false,
    canEdit: true,
    content: [{ type: 'text', text: 'Savol' }],
    options: [
      { id: 'a', content: [{ type: 'text', text: '1' }] },
      { id: 'b', content: [{ type: 'text', text: '2' }] },
    ],
    answer: { optionId: 'b' },
    sharing: { mode: 'private', userIds: [] },
    ...over,
  }) as unknown as Question

const pv = (n: number): PastePreview => ({
  stats: { total: n, ok: n, problems: 0 },
  items: Array.from({ length: n }, (_, i) => ({
    idx: i + 1,
    number: i + 1,
    line: i + 1,
    content: [{ type: 'text' as const, text: `Savol ${i + 1}` }],
    options: [
      { id: 'A', content: [{ type: 'text' as const, text: 'bir' }] },
      { id: 'B', content: [{ type: 'text' as const, text: 'ikki' }] },
    ],
    correct: ['B'],
    type: 'single' as const,
    warnings: [],
    pickable: false,
  })),
  ignored: [],
  limits: { maxQuestions: 200, maxBytes: 70000 },
})
const res = (created: number): PasteCommitResult => ({
  created,
  ids: [],
  skipped: [],
  failed: [],
  excluded: 0,
  total: created,
})

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  api.getTopic.mockResolvedValue({
    id: 't1',
    subjectId: 'math',
    subjectName: 'Matematika',
    name: 'Kasrlar',
    description: '',
  })
  api.listTopics.mockImplementation(async (id: string) => ({
    subject: { id, name: id, isActive: true },
    topics:
      id === 'math'
        ? [
            { id: 't1', name: 'Kasrlar' },
            { id: 't2', name: 'Tenglamalar' },
          ]
        : [{ id: 'p1', name: 'Kinematika' }],
  }))
  api.subjects.mockResolvedValue({
    scope: 'own',
    subjects: [
      { id: 'math', name: 'Matematika' },
      { id: 'phys', name: 'Fizika' },
    ],
  })
  api.teachers.mockResolvedValue([])
  for (const t of [...useToast().toasts]) useToast().dismiss(t.id)
})

describe('Savol qo`shish sahifasi: ixcham sarlavha va usullar', () => {
  it('sarlavhada "Fan · Mavzu" va "o`zgartirish"; usullar: Matnni joylash (standart), Rasm / PDF (OCR), Bittalab, Word (.docx), Excel', async () => {
    const { w } = await mountAt('/exams/questions/new?topicId=t1')
    expect(w.get('h1').text()).toBe("Savol qo'shish")
    expect(w.get('[data-testid="ctx-text"]').text()).toBe('Matematika · Kasrlar')
    expect(w.find('[data-testid="ctx-panel"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="method-tabs"] [role="tab"]').map((x) => x.text())).toEqual([
      'Matnni joylash',
      'Rasm / PDF (OCR)',
      'Bittalab',
      'Word (.docx)',
      'Excel',
    ])
    expect(w.get('[data-testid="method-paste"]').attributes('aria-selected')).toBe('true')
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(true)
    // katta bo'limlar yo'q: forma Bittalab tabigacha ko'rinmaydi
    expect(w.find('[data-testid="question-form"]').exists()).toBe(false)
  })

  it('mavzu o`zgartirish: panel ochiladi, mavzu almashsa sarlavha va joylash mavzusi yangilanadi; yangi mavzu shu yerda yaratiladi', async () => {
    api.createTopic.mockResolvedValue({ id: 't3', name: 'Yangi mavzu' })
    api.pastePreview.mockResolvedValue(pv(1))
    api.pasteCommit.mockResolvedValue(res(1))
    const { w } = await mountAt('/exams/questions/new?topicId=t1')
    await w.get('[data-testid="ctx-change"]').trigger('click')
    expect(w.find('[data-testid="ctx-panel"]').exists()).toBe(true)
    await w.get('[data-testid="field-topic"]').setValue('t2')
    expect(w.get('[data-testid="ctx-text"]').text()).toBe('Matematika · Tenglamalar')
    await w.get('[data-testid="quick-topic-input"]').setValue('Yangi mavzu')
    await w.get('[data-testid="quick-topic-add"]').trigger('click')
    await flushPromises()
    expect(api.createTopic).toHaveBeenCalledWith('math', { name: 'Yangi mavzu' })
    expect(w.get('[data-testid="ctx-text"]').text()).toBe('Matematika · Yangi mavzu')
    await w.get('[data-testid="ctx-done"]').trigger('click')
    expect(w.find('[data-testid="ctx-panel"]').exists()).toBe(false)
    // joylash yangi mavzuga saqlanadi
    await w.get('[data-testid="paste-text"]').setValue('1. Savol\nA) bir\nB) ikki\nJavob: B')
    await sleep(650)
    await flushPromises()
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect(api.pasteCommit.mock.calls[0]![0]).toMatchObject({ topicId: 't3', status: 'draft' })
  })

  it('mavzu tanlanmagan bo`lsa panel o`zi ochiladi; joylash va import mavzu tanlanguncha yopiq', async () => {
    const { w } = await mountAt('/exams/questions/new')
    expect(w.get('[data-testid="ctx-text"]').text()).toBe('Mavzu tanlanmagan')
    expect(w.find('[data-testid="ctx-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="paste-need-topic"]').exists()).toBe(true)
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(false)
    await w.get('[data-testid="method-word"]').trigger('click')
    expect(w.get('[data-testid="go-import-word"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="field-subject"]').setValue('math')
    await flushPromises()
    await w.get('[data-testid="field-topic"]').setValue('t2')
    expect(w.get('[data-testid="go-import-word"]').attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="method-paste"]').trigger('click')
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(true)
  })

  it('Matnni joylash (bank rejimi): mavzu oldindan tanlangan; saqlangach shu sahifada qoladi, jami va mavzuga havola ko`rinadi', async () => {
    api.pastePreview.mockResolvedValue(pv(2))
    api.pasteCommit.mockResolvedValue(res(2))
    const { w, router } = await mountAt('/exams/questions/new?topicId=t1')
    await w.get('[data-testid="paste-text"]').setValue('1. a\nA) x\nB) y\nJavob: B')
    await sleep(650)
    await flushPromises()
    expect(api.pastePreview).toHaveBeenCalledWith('1. a\nA) x\nB) y\nJavob: B')
    expect(w.get('[data-testid="paste-count"]').text()).toBe('2 ta savol topildi')
    await w.get('[data-testid="paste-commit"]').trigger('click')
    await flushPromises()
    expect(api.pasteCommit).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: 't1', status: 'draft', difficulty: 2, points: 1 }),
    )
    expect(router.currentRoute.value.name).toBe('exam-question-create')
    expect(w.get('[data-testid="paste-done"]').text()).toContain('2 ta')
    expect(w.find('[data-testid="paste-to-topic"]').exists()).toBe(true)
    // yana joylash mumkin
    expect((w.get('[data-testid="paste-text"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('Word/Excel: mavjud import oqimiga mavzu va usul bilan o`tadi', async () => {
    const { w, router } = await mountAt('/exams/questions/new?topicId=t1')
    await w.get('[data-testid="method-excel"]').trigger('click')
    await w.get('[data-testid="go-import-excel"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-question-import')
    expect(router.currentRoute.value.query).toMatchObject({ topicId: 't1', kind: 'excel' })
    await router.push('/exams/questions/new?topicId=t1')
    await flushPromises()
    await w.get('[data-testid="method-word"]').trigger('click')
    await w.get('[data-testid="go-import-word"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ topicId: 't1', kind: 'word' })
  })
})

describe('Bittalab: ixcham forma', () => {
  const fill = async (w: Awaited<ReturnType<typeof mountAt>>['w']) => {
    await w.get('[data-testid="block-text"]').setValue('Savol')
    const rows = w.findAll('[data-testid="option-row"]')
    await rows[0]!.get('textarea').setValue('1')
    await rows[1]!.get('textarea').setValue('2')
    await rows[1]!.get('[data-testid="option-correct"]').setValue(true)
  }

  it('tur, qiyinlik, ball va holat bitta qatorda; savol matni va variantlar bitta kartada; ulashish yig`ilgan', async () => {
    const { w } = await mountAt('/exams/questions/new?topicId=t1')
    await w.get('[data-testid="method-single"]').trigger('click')
    const meta = w.get('[data-testid="meta-row"]')
    expect(meta.findAll('[data-testid="type-option"]')).toHaveLength(4)
    expect(meta.findAll('[data-testid="difficulty-option"]')).toHaveLength(3)
    expect(meta.find('[data-testid="field-points"]').exists()).toBe(true)
    expect(meta.find('[data-testid="field-status"]').exists()).toBe(true)
    const card = w.get('[data-testid="block-text"]').element.closest('section')!
    expect(card.querySelector('[data-testid="options-editor"]')).not.toBeNull()
    expect(card.querySelectorAll('[data-testid="option-row"]')).toHaveLength(2)
    const sharing = w.get('[data-testid="sharing-section"]')
    expect(sharing.element.tagName).toBe('DETAILS')
    expect((sharing.element as HTMLDetailsElement).open).toBe(false)
    expect(sharing.text()).toContain('Yopiq')
    // variant ichida bitta matn bloki: sarlavha satri yo'q (ixcham qator)
    const row = w.findAll('[data-testid="option-row"]')[0]!
    expect(row.find('[data-testid="block-up"]').exists()).toBe(false)
    expect(row.find('[data-testid="block-text"]').exists()).toBe(true)
    // qo'shimcha bloklar "+ Qo'shish" menyusida
    expect(w.find('[data-testid="add-math"]').exists()).toBe(false)
    await w.get('[data-testid="add-menu"]').trigger('click')
    expect(w.find('[data-testid="add-math"]').exists()).toBe(true)
  })

  it('"Saqlash va yana qo`shish": saqlaydi, sahifada qoladi, mavzu/tur/qiyinlik/ball/holat saqlanadi, matn va variantlar tozalanadi', async () => {
    api.createQuestion.mockResolvedValue(saved())
    const { w, router } = await mountAt('/exams/questions/new?topicId=t1')
    await w.get('[data-testid="method-single"]').trigger('click')
    await w.findAll('[data-testid="type-option"]')[1]!.trigger('click') // multi
    await w.findAll('[data-testid="difficulty-option"]')[2]!.trigger('click') // qiyin
    await w.get('[data-testid="field-points"]').setValue('2')
    const rows0 = w.findAll('[data-testid="option-row"]')
    await w.get('[data-testid="block-text"]').setValue('Savol')
    await rows0[0]!.get('textarea').setValue('1')
    await rows0[1]!.get('textarea').setValue('2')
    await rows0[1]!.get('[data-testid="option-correct"]').setValue(true)
    await w.get('[data-testid="save-and-add"]').trigger('click')
    await flushPromises()
    expect(api.createQuestion).toHaveBeenCalledTimes(1)
    expect(api.createQuestion.mock.calls[0]![0]).toMatchObject({
      topicId: 't1',
      type: 'multi',
      difficulty: 3,
      points: 2,
    })
    expect(router.currentRoute.value.name).toBe('exam-question-create')
    expect((w.get('[data-testid="block-text"]').element as HTMLTextAreaElement).value).toBe('')
    for (const r of w.findAll('[data-testid="option-row"]')) {
      expect((r.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    }
    expect(w.findAll('[data-testid="type-option"]')[1]!.attributes('aria-checked')).toBe('true')
    expect(w.findAll('[data-testid="difficulty-option"]')[2]!.attributes('aria-checked')).toBe(
      'true',
    )
    expect((w.get('[data-testid="field-points"]').element as HTMLInputElement).value).toBe('2')
    expect(w.get('[data-testid="ctx-text"]').text()).toBe('Matematika · Kasrlar')
    expect(JSON.stringify(useToast().toasts)).toContain('Savol saqlandi')
    // tozalangan forma validatsiyadan o'tmaydi (xato xabarlari darhol chiqmaydi)
    expect(w.text()).not.toContain(uz.exams.errors.contentEmpty)
  })

  it('oddiy "Saqlash" tahrirlash sahifasiga o`tadi; tahrirlashda "yana qo`shish" va usullar yo`q, mavzu sarlavhasi bor', async () => {
    api.createQuestion.mockResolvedValue(saved({ id: 'n9' }))
    api.getQuestion.mockResolvedValue(saved({ id: 'n9' }))
    const { w, router } = await mountAt('/exams/questions/new?topicId=t1')
    await w.get('[data-testid="method-single"]').trigger('click')
    await fill(w)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-question-edit')
    expect(w.find('[data-testid="method-tabs"]').exists()).toBe(false)
    expect(w.find('[data-testid="save-and-add"]').exists()).toBe(false)
    expect(w.get('[data-testid="ctx-text"]').text()).toBe('Matematika · Kasrlar')
    expect(w.find('[data-testid="question-form"]').exists()).toBe(true)
    expect(w.get('h1').text()).toBe('Savolni tahrirlash')
  })

  it('tahrirlash sahifasi ochilganda ham usullarsiz ixcham forma ishlaydi va saqlanadi', async () => {
    api.getQuestion.mockResolvedValue(saved())
    api.updateQuestion.mockResolvedValue(saved())
    const { w } = await mountAt('/exams/questions/n1/edit')
    expect(w.find('[data-testid="method-tabs"]').exists()).toBe(false)
    expect(w.find('[data-testid="meta-row"]').exists()).toBe(true)
    await w.get('[data-testid="block-text"]').setValue('Yangi matn')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateQuestion).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ topicId: 't1' }),
    )
  })

  it('blok rejimi (vazifa): sarlavhada fan/mavzu yo`q; "Saqlash va yana qo`shish" shu rejimda qoladi', async () => {
    api.myBlock.mockResolvedValue({
      exam: { id: 'e1', title: 'DTM sinov', contribDeadline: null },
      block: {
        id: 'b1',
        subjectId: 'math',
        subjectName: 'Matematika',
        title: 'Matematika',
        targetCount: 5,
        count: 0,
        status: 'open',
        locked: false,
        lockReason: null,
      },
      questions: [],
      rules: [],
      role: 'contributor',
    })
    api.createInBlock.mockResolvedValue({ question: { id: 'x' }, count: 1, target: 5 })
    const { w, router } = await mountAt('/exams/questions/new?blockSession=e1&block=b1')
    expect(w.find('[data-testid="ctx-line"]').exists()).toBe(false)
    expect(w.find('[data-testid="method-tabs"]').exists()).toBe(false)
    expect(w.find('[data-testid="block-mode-note"]').exists()).toBe(true)
    await fill(w)
    await w.get('[data-testid="save-and-add"]').trigger('click')
    await flushPromises()
    expect(api.createInBlock).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('exam-question-create')
    expect((w.get('[data-testid="block-text"]').element as HTMLTextAreaElement).value).toBe('')
  })
})
