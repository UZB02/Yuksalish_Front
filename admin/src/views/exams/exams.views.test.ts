import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { Question, QuestionListItem, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

const api = {
  subjects: vi.fn(),
  getTopic: vi.fn(),
  listTopics: vi.fn(),
  createTopic: vi.fn(),
  listQuestions: vi.fn(),
  bulkStatus: vi.fn(),
  getQuestion: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  archiveQuestion: vi.fn(),
  restoreQuestion: vi.fn(),
  duplicateQuestion: vi.fn(),
  removeQuestion: vi.fn(),
  teachers: vi.fn(),
  uploadAsset: vi.fn(),
  fetchAssetBlob: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import QuestionEditorView from './QuestionEditorView.vue'
import QuestionsView from './QuestionsView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const item = (over: Partial<QuestionListItem> = {}): QuestionListItem => ({
  id: 'q1',
  subjectId: 'math',
  subjectName: 'Matematika',
  topicId: 'topic1',
  topicName: 'Kasrlar',
  difficulty: 2,
  type: 'single',
  points: 1,
  status: 'active',
  version: 1,
  authorId: 'u1',
  authorName: 'Ustoz',
  isMine: true,
  isShared: false,
  sharedWithMe: false,
  canEdit: true,
  preview: '2+2 nechiga teng?',
  hasMath: false,
  hasImage: false,
  optionsCount: 2,
  createdAt: '',
  updatedAt: '',
  ...over,
})
const page = (items: QuestionListItem[], total = items.length) => ({
  items,
  meta: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) },
})

async function mountAt(path: string, role: 'teacher' | 'school_admin' | 'superadmin' = 'teacher') {
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
      { path: '/exams/questions', name: 'exam-questions', component: empty },
      { path: '/exams/topics/:topicId', name: 'exam-topic', component: QuestionsView },
      { path: '/exams/subjects/:subjectId', name: 'exam-subject', component: empty },
      { path: '/exams/questions/new', name: 'exam-question-create', component: QuestionEditorView },
      {
        path: '/exams/questions/:id/edit',
        name: 'exam-question-edit',
        component: QuestionEditorView,
      },
      { path: '/exams/questions/import', name: 'exam-question-import', component: empty },
      { path: '/x', name: 'x', component: empty },
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
  vi.clearAllMocks()
  api.getTopic.mockResolvedValue({
    id: 'topic1',
    subjectId: 'math',
    subjectName: 'Matematika',
    name: 'Kasrlar',
    description: '',
  })
  api.listTopics.mockResolvedValue({
    subject: { id: 'math', name: 'Matematika', isActive: true },
    topics: [
      { id: 'topic1', name: 'Kasrlar' },
      { id: 'topic2', name: 'Tenglamalar' },
    ],
  })
  api.teachers.mockResolvedValue([
    { id: 't1', fullName: 'Ali Valiyev', teachesSubject: true },
    { id: 't2', fullName: 'Bobur Karimov', teachesSubject: false },
  ])
  api.subjects.mockResolvedValue({ scope: 'own', subjects: [{ id: 'math', name: 'Matematika' }] })
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('QuestionsView (savollar ro`yxati)', () => {
  it("qatorlar holat, tur va qiyinlik belgilari bilan; javob kaliti so'ralmaydi", async () => {
    api.listQuestions.mockResolvedValue(
      page([
        item(),
        item({ id: 'q2', status: 'draft', preview: 'Ikkinchi', canEdit: false, isMine: false }),
      ]),
    )
    const { w } = await mountAt('/exams/topics/topic1')
    const rows = w.findAll('[data-testid="question-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('2+2 nechiga teng?')
    expect(rows[0]!.get('[data-testid="row-status"]').text()).toBe(uz.exams.status.active)
    expect(rows[1]!.get('[data-testid="row-status"]').text()).toBe(uz.exams.status.draft)
    expect(rows[0]!.text()).toContain(uz.exams.types.single)
    expect(rows[1]!.text()).toContain(uz.exams.questions.readOnly)
    expect(JSON.stringify(api.listQuestions.mock.calls)).not.toContain('answer')
  })

  it("bo'sh holat: sarlavha va 'Savol qo'shish' tugmasi", async () => {
    api.listQuestions.mockResolvedValue(page([]))
    const { w } = await mountAt('/exams/topics/topic1')
    expect(w.text()).toContain(uz.exams.questions.emptyTitle)
    expect(w.findAll('[data-testid="question-row"]')).toHaveLength(0)
    expect(w.get('[data-testid="add-question"]').text()).toContain(uz.exams.questions.add)
  })

  it("filtr: qidiruv, tur, holat va 'mening savollarim' serverga uzatiladi", async () => {
    api.listQuestions.mockResolvedValue(page([item()]))
    const { w } = await mountAt('/exams/topics/topic1')
    expect(api.listQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, search: undefined, type: undefined }),
    )
    await w.get('[data-testid="filter-search"]').setValue('kasr')
    await vi.waitFor(
      () =>
        expect(api.listQuestions).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'kasr' }),
        ),
      { timeout: 2000 },
    )
    await w.get('input[type="checkbox"]').setValue(true)
    await vi.waitFor(() =>
      expect(api.listQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ mine: true })),
    )
  })

  it('filtr natijasi bo`sh: "topilmadi" holati va tozalash tugmasi', async () => {
    api.listQuestions.mockResolvedValueOnce(page([item()])).mockResolvedValue(page([]))
    const { w } = await mountAt('/exams/topics/topic1')
    await w.get('[data-testid="filter-search"]').setValue('yoq')
    await vi.waitFor(() => expect(w.text()).toContain(uz.exams.questions.noMatchTitle), {
      timeout: 2000,
    })
  })

  it("breadcrumb: Savollar banki › fan › mavzu; so'rov mavzu bo'yicha; mavzu topilmasa xabar", async () => {
    api.listQuestions.mockResolvedValue(page([item()]))
    const { w } = await mountAt('/exams/topics/topic1')
    const crumb = w.get('[data-testid="exam-breadcrumb"]')
    expect(crumb.text()).toContain('Savollar banki')
    expect(crumb.text()).toContain('Matematika')
    expect(crumb.text()).toContain('Kasrlar')
    expect(api.listQuestions).toHaveBeenCalledWith(expect.objectContaining({ topicId: 'topic1' }))
    expect(
      w.get('[data-testid="add-question"]').element.closest('a')!.getAttribute('href'),
    ).toContain('topicId=topic1')
    // Alohida "Import" tugmasi yo'q: Word/Excel va joylash "Savol qo'shish" ichida
    expect(w.find('[data-testid="import-questions"]').exists()).toBe(false)
    api.getTopic.mockRejectedValue(new Error('403'))
    const bad = await mountAt('/exams/topics/zzz')
    expect(bad.w.find('[data-testid="topic-forbidden"]').exists()).toBe(true)
  })
})

describe('QuestionEditorView (muharrir)', () => {
  const full = (over: Partial<Question> = {}): Question => ({
    ...item(),
    content: [{ type: 'text', text: '2+2 nechiga teng?' }],
    options: [
      { id: 'a', content: [{ type: 'text', text: '3' }] },
      { id: 'b', content: [{ type: 'text', text: '4' }] },
    ],
    answer: { optionId: 'b' },
    ...over,
  })

  it('yangi savol: bitta fan bo`lsa avtomatik tanlanadi; bo`sh forma saqlanmaydi (validatsiya)', async () => {
    const { w } = await mountAt('/exams/questions/new')
    await w.get('[data-testid="method-single"]').trigger('click')
    expect(w.find('[data-testid="question-form"]').exists()).toBe(true)
    await w.get('[data-testid="save-question"]').trigger('submit')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createQuestion).not.toHaveBeenCalled()
    expect(w.text()).toContain(uz.exams.errors.contentEmpty)
    expect(w.text()).toContain(uz.exams.errors.correctSingle)
  })

  it("to'g'ri to'ldirilgan savol serverga javob kaliti bilan yuboriladi", async () => {
    api.createQuestion.mockResolvedValue(full({ id: 'new1' }))
    api.getQuestion.mockResolvedValue(full({ id: 'new1' }))
    const { w, router } = await mountAt('/exams/questions/new?topicId=topic1')
    await w.get('[data-testid="method-single"]').trigger('click')
    await w.get('[data-testid="block-text"]').setValue('2+2 nechiga teng?')
    const opts = w.findAll('[data-testid="option-row"]')
    await opts[0]!.get('textarea').setValue('3')
    await opts[1]!.get('textarea').setValue('4')
    await opts[1]!.get('[data-testid="option-correct"]').setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createQuestion).toHaveBeenCalledTimes(1)
    expect(api.createQuestion.mock.calls[0]![0]).toMatchObject({
      topicId: 'topic1',
      type: 'single',
      answer: { optionId: 'b' },
      status: 'draft',
      points: 1,
      difficulty: 2,
    })
    expect(router.currentRoute.value.name).toBe('exam-question-edit')
  })

  it("tur almashtirish: qisqa javob chip bo'limi, esse rubrika; variantlar bo'limi yashiriladi", async () => {
    const { w } = await mountAt('/exams/questions/new')
    await w.get('[data-testid="method-single"]').trigger('click')
    const types = w.findAll('[data-testid="type-option"]')
    expect(types).toHaveLength(4)
    await types[2]!.trigger('click')
    expect(w.find('[data-testid="options-editor"]').exists()).toBe(false)
    expect(w.find('[data-testid="accepted-answers"]').exists()).toBe(true)
    await types[3]!.trigger('click')
    expect(w.find('[data-testid="field-rubric"]').exists()).toBe(true)
    await types[1]!.trigger('click')
    expect(w.findAll('input[type="checkbox"]').length).toBeGreaterThan(0)
    expect(w.find('[data-testid="partial-credit"]').exists()).toBe(true)
  })

  it("ko'rinish paneli o'quvchi ko'rinishi: formadagi to'g'ri javob belgilangan bo'lsa ham ko'rinmaydi", async () => {
    api.getQuestion.mockResolvedValue(full())
    const { w } = await mountAt('/exams/questions/q1/edit')
    const panel = w.get('[data-testid="preview-panel"]')
    expect(panel.text()).toContain('2+2 nechiga teng?')
    expect(panel.findAll('[data-testid="preview-option"]')).toHaveLength(2)
    const html = panel.html().toLowerCase()
    expect(html).not.toContain('checked')
    expect(html).not.toContain("variant to'g'ri")
    expect(html).not.toContain('option-correct')
  })

  it("mobil tablar: Tahrirlash va Ko'rinish o'rtasida almashadi", async () => {
    api.getQuestion.mockResolvedValue(full())
    const { w } = await mountAt('/exams/questions/q1/edit')
    expect(w.get('[data-testid="preview-panel"]').classes()).toContain('hidden')
    await w.get('[data-testid="tab-preview"]').trigger('click')
    expect(w.get('[data-testid="preview-panel"]').classes()).not.toContain('hidden')
    expect(w.get('[data-testid="question-form"]').classes()).toContain('hidden')
  })

  it("boshqa muallifning savoli: faqat o'qish, forma va javob kaliti yo'q", async () => {
    api.getQuestion.mockResolvedValue(full({ canEdit: false, isMine: false, answer: undefined }))
    const { w } = await mountAt('/exams/questions/q1/edit')
    expect(w.find('[data-testid="question-form"]').exists()).toBe(false)
    expect(w.find('[data-testid="readonly-note"]').exists()).toBe(true)
    expect(w.find('[data-testid="preview-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="save-question"]').exists()).toBe(false)
  })

  it("fani yo'q o'qituvchi: ogohlantirish; server xatosi maydonga bog'lanadi", async () => {
    api.subjects.mockResolvedValue({ scope: 'own', subjects: [] })
    const { w } = await mountAt('/exams/questions/new')
    await w.get('[data-testid="method-single"]').trigger('click')
    expect(w.find('[data-testid="no-subjects"]').exists()).toBe(true)
  })

  it("server validatsiya xatosi (400) ko'rsatiladi va saqlanmagan o'zgarish yo'qolmaydi", async () => {
    const { ApiError } = await import('@/api/errors')
    api.createQuestion.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', "Ma'lumotlar noto'g'ri", 400, [
        { path: 'content.0.text', message: 'Matn 5000 belgidan oshmasligi kerak' },
      ]),
    )
    const { w } = await mountAt('/exams/questions/new?topicId=topic1')
    await w.get('[data-testid="method-single"]').trigger('click')
    await w.get('[data-testid="block-text"]').setValue('x')
    const opts = w.findAll('[data-testid="option-row"]')
    await opts[0]!.get('textarea').setValue('1')
    await opts[1]!.get('textarea').setValue('2')
    await opts[0]!.get('[data-testid="option-correct"]').setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createQuestion).toHaveBeenCalled()
    expect(w.text()).toContain('Matn 5000 belgidan oshmasligi kerak')
    expect((w.get('[data-testid="block-text"]').element as HTMLTextAreaElement).value).toBe('x')
  })
})

describe('Ulashish (sharing)', () => {
  const full = (over: Partial<Question> = {}): Question => ({
    ...item(),
    content: [{ type: 'text', text: 'Savol' }],
    options: [
      { id: 'a', content: [{ type: 'text', text: '3' }] },
      { id: 'b', content: [{ type: 'text', text: '4' }] },
    ],
    answer: { optionId: 'b' },
    sharing: { mode: 'private', userIds: [] },
    ...over,
  })

  it("ro'yxat: 'Menga ulashilgan' filtri serverga uzatiladi, belgilar ko'rinadi", async () => {
    api.listQuestions.mockResolvedValue(
      page([
        item({ id: 'a', sharedWithMe: true, isMine: false, canEdit: false, isShared: true }),
        item({ id: 'b', isShared: true }),
        item({ id: 'c' }),
      ]),
    )
    const { w } = await mountAt('/exams/topics/topic1')
    expect(w.findAll('[data-testid="badge-shared-with-me"]')).toHaveLength(1)
    expect(w.findAll('[data-testid="badge-shared"]')).toHaveLength(1)
    await w.get('[data-testid="filter-shared"] input').setValue(true)
    await vi.waitFor(() =>
      expect(api.listQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ shared: true })),
    )
  })

  it("muharrir: ulashish bo'limi, 3 rejim; 'tanlangan' rejimda o'qituvchilar ro'yxati (fanni o'qitadiganlar belgisi)", async () => {
    const { w } = await mountAt('/exams/questions/new')
    await w.get('[data-testid="method-single"]').trigger('click')
    const modes = w.findAll('[data-testid="sharing-mode"]')
    expect(modes.map((m) => m.text())).toEqual([
      'Yopiq',
      "Fan o'qituvchilariga",
      "Tanlangan o'qituvchilarga",
    ])
    expect(modes[0]!.attributes('aria-checked')).toBe('true')
    expect(w.find('[data-testid="sharing-teachers"]').exists()).toBe(false)
    await modes[2]!.trigger('click')
    await flushPromises()
    expect(api.teachers).toHaveBeenCalledWith('math')
    const list = w.get('[data-testid="sharing-teachers"]')
    expect(list.text()).toContain('Ali Valiyev')
    expect(list.text()).toContain("shu fan o'qituvchisi")
    await list.findAll('[data-testid="sharing-teacher"]')[1]!.setValue(true)
    expect(list.text()).toContain('Tanlandi: 1 ta')
  })

  it("saqlashda ulashish serverga ketadi; 'tanlangan' bo'sh bo'lsa saqlanmaydi", async () => {
    api.createQuestion.mockResolvedValue(full({ id: 'n1' }))
    api.getQuestion.mockResolvedValue(full({ id: 'n1' }))
    const { w } = await mountAt('/exams/questions/new?topicId=topic1')
    await w.get('[data-testid="method-single"]').trigger('click')
    await w.get('[data-testid="block-text"]').setValue('Savol')
    const opts = w.findAll('[data-testid="option-row"]')
    await opts[0]!.get('textarea').setValue('3')
    await opts[1]!.get('textarea').setValue('4')
    await opts[1]!.get('[data-testid="option-correct"]').setValue(true)
    await w.findAll('[data-testid="sharing-mode"]')[2]!.trigger('click')
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createQuestion).not.toHaveBeenCalled()
    expect(w.get('[data-testid="sharing-error"]').text()).toContain(uz.exams.errors.sharingUsers)
    await w.findAll('[data-testid="sharing-teacher"]')[0]!.setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createQuestion.mock.calls[0]![0]).toMatchObject({
      sharing: { mode: 'users', userIds: ['t1'] },
    })
  })

  it("mavjud ulashish formaga yuklanadi; 'Fan o'qituvchilariga' da ro'yxat chaqirilmaydi", async () => {
    api.getQuestion.mockResolvedValue(full({ sharing: { mode: 'subject', userIds: [] } }))
    const { w } = await mountAt('/exams/questions/q1/edit')
    expect(w.findAll('[data-testid="sharing-mode"]')[1]!.attributes('aria-checked')).toBe('true')
    expect(api.teachers).not.toHaveBeenCalled()
  })

  it("ulashilgan (faqat o'qish) savol: ulashish sozlamasi yo'q, 'Nusxa olish' tugmasi nusxani ochadi", async () => {
    api.getQuestion.mockResolvedValue(full({ canEdit: false, isMine: false, sharing: undefined }))
    api.duplicateQuestion.mockResolvedValue(full({ id: 'copy1' }))
    const { w, router } = await mountAt('/exams/questions/q1/edit')
    expect(w.find('[data-testid="sharing-section"]').exists()).toBe(false)
    await w.get('[data-testid="duplicate-shared"]').trigger('click')
    await flushPromises()
    expect(api.duplicateQuestion).toHaveBeenCalledWith('q1')
    expect(router.currentRoute.value.params.id).toBe('copy1')
  })
})

describe('QuestionsView: ommaviy holat o`zgartirish', () => {
  const $ = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
  const click = async (el: Element | null) => {
    ;(el as HTMLElement).click()
    await flushPromises()
  }
  const pageOf = (items: QuestionListItem[], total = items.length) => ({
    items,
    meta: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) || 1 },
  })
  /** Ro'yxat so'rovi va qoralamalar soni (limit 1) uchun alohida javob */
  const setup = (items: QuestionListItem[], total = items.length, drafts = 0) =>
    api.listQuestions.mockImplementation(async (p: { status?: string; limit?: number }) =>
      p.status === 'draft' && p.limit === 1 ? pageOf([], drafts) : pageOf(items, total),
    )

  beforeEach(() => {
    document.body.innerHTML = ''
    api.bulkStatus.mockResolvedValue({ updated: 2, unchanged: 0, skipped: [] })
  })

  it('faqat tahrirlanadigan savollar belgilanadi; "Faol qilish" tanlangan id lar bilan chaqiriladi', async () => {
    setup([item({ id: 'q1' }), item({ id: 'q2' }), item({ id: 'q3', canEdit: false })])
    await mountAt('/exams/topics/topic1')
    expect(($('select-q3').querySelector('input') as HTMLInputElement).disabled).toBe(true)
    expect($('selected-count')).toBeNull()
    await click($('select-page').querySelector('input'))
    expect($('selected-count').textContent?.trim()).toBe('Tanlangan: 2')
    await click($('bulk-active'))
    expect(api.bulkStatus).toHaveBeenCalledWith({ ids: ['q1', 'q2'], toStatus: 'active' })
    expect($('selected-count')).toBeNull()
  })

  it('qoralama qilish tasdiqsiz, arxivlash tasdiq bilan', async () => {
    setup([item({ id: 'q1' }), item({ id: 'q2' })])
    await mountAt('/exams/topics/topic1')
    await click($('select-q1').querySelector('input'))
    await click($('bulk-draft'))
    expect(api.bulkStatus).toHaveBeenLastCalledWith({ ids: ['q1'], toStatus: 'draft' })
    await click($('select-q2').querySelector('input'))
    await click($('bulk-archive'))
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    expect(api.bulkStatus).toHaveBeenCalledTimes(1)
    c.settle(true)
    await flushPromises()
    expect(api.bulkStatus).toHaveBeenLastCalledWith({ ids: ['q2'], toStatus: 'archived' })
  })

  it('"Barcha N ta"ni belgilash: serverda mavzu bo`yicha; boshqa filtr bo`lsa taklif yo`q', async () => {
    setup([item({ id: 'q1' }), item({ id: 'q2' })], 45)
    const { w } = await mountAt('/exams/topics/topic1')
    expect($('select-all-filtered')).toBeNull()
    await click($('select-page').querySelector('input'))
    expect($('select-all-filtered').textContent).toContain('45')
    await click($('select-all-filtered'))
    expect($('selected-count').textContent?.trim()).toBe('Tanlangan: 45')
    await click($('bulk-active'))
    expect(api.bulkStatus).toHaveBeenCalledWith({
      topicId: 'topic1',
      fromStatus: undefined,
      toStatus: 'active',
    })
    await w.get('[data-testid="filter-search"]').setValue('kasr')
    await new Promise((r) => setTimeout(r, 450))
    await flushPromises()
    await click($('select-page').querySelector('input'))
    expect($('select-all-filtered')).toBeNull()
  })

  it('tezkor tugma: qoralamalar soni bilan, tasdiqdan keyin topicId+fromStatus=draft; o`qituvchi uchun faqat o`ziniki sanaladi', async () => {
    setup([item({ id: 'q1', status: 'draft' })], 1, 3)
    await mountAt('/exams/topics/topic1')
    expect($('activate-all-drafts').textContent).toContain('3 ta')
    expect(api.listQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', limit: 1, mine: true }),
    )
    await click($('activate-all-drafts'))
    const c = useConfirm()
    expect(c.state.open).toBe(true)
    c.settle(true)
    await flushPromises()
    expect(api.bulkStatus).toHaveBeenCalledWith({
      topicId: 'topic1',
      fromStatus: 'draft',
      toStatus: 'active',
    })
  })

  it('qoralama yo`q bo`lsa tezkor tugma ko`rinmaydi; o`tkazib yuborilganlar sababi xabarda', async () => {
    setup([item({ id: 'q1' })], 1, 0)
    api.bulkStatus.mockResolvedValue({
      updated: 0,
      unchanged: 0,
      skipped: [{ id: 'q1', reason: "To'g'ri javob belgilanmagan" }],
    })
    await mountAt('/exams/topics/topic1')
    expect($('activate-all-drafts')).toBeNull()
    await click($('select-q1').querySelector('input'))
    await click($('bulk-active'))
    expect(JSON.stringify(useToast().toasts)).toContain("To'g'ri javob belgilanmagan")
  })
})
