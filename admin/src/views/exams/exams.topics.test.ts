import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { ExamTopic, User } from '@/api/types'
import { ApiError } from '@/api/errors'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'

const api = {
  subjects: vi.fn(),
  listTopics: vi.fn(),
  getTopic: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  removeTopic: vi.fn(),
  reorderTopics: vi.fn(),
  listQuestions: vi.fn(),
  getQuestion: vi.fn(),
  createQuestion: vi.fn(),
  teachers: vi.fn(),
  fetchAssetBlob: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import ExamSubjectsView from './ExamSubjectsView.vue'
import QuestionEditorView from './QuestionEditorView.vue'
import SubjectTopicsView from './SubjectTopicsView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const subj = (over = {}) => ({
  id: 'math',
  name: 'Matematika',
  isActive: true,
  topicsCount: 2,
  questionsCount: 7,
  ...over,
})
const topic = (over: Partial<ExamTopic> = {}): ExamTopic => ({
  id: 't1',
  subjectId: 'math',
  subjectName: 'Matematika',
  name: 'Kasrlar',
  description: 'Oddiy kasrlar',
  order: 1,
  createdBy: 'u1',
  createdByName: 'Ali',
  isMine: true,
  questionsCount: 3,
  isEmpty: false,
  canEdit: true,
  canDelete: false,
  ...over,
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
      { path: '/exams/questions', name: 'exam-questions', component: ExamSubjectsView },
      { path: '/exams/subjects/:subjectId', name: 'exam-subject', component: SubjectTopicsView },
      { path: '/exams/topics/:topicId', name: 'exam-topic', component: empty },
      { path: '/exams/questions/new', name: 'exam-question-create', component: QuestionEditorView },
      {
        path: '/exams/questions/:id/edit',
        name: 'exam-question-edit',
        component: QuestionEditorView,
      },
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

const topicsResp = (topics: ExamTopic[]) => ({
  subject: { id: 'math', name: 'Matematika', isActive: true },
  topics,
})

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  api.subjects.mockResolvedValue({
    scope: 'own',
    subjects: [subj(), subj({ id: 'phys', name: 'Fizika', topicsCount: 0, questionsCount: 0 })],
  })
  api.teachers.mockResolvedValue([])
})

describe('ExamSubjectsView: fan kartalari', () => {
  it('kartalar: nom, mavzular va ko`rinadigan savollar soni; kartani bosish fan sahifasiga olib boradi', async () => {
    const { w, router } = await mountAt('/exams/questions')
    const cards = w.findAll('[data-testid="subject-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Matematika')
    expect(cards[0]!.get('[data-testid="subject-topics"]').text()).toBe('2 ta mavzu')
    expect(cards[0]!.get('[data-testid="subject-questions"]').text()).toBe('7 ta savol')
    expect(w.text()).toContain(uz.exams.questions.ownScopeHint)
    await cards[0]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-subject')
    expect(router.currentRoute.value.params.subjectId).toBe('math')
  })

  it("qidiruv fan nomi bo'yicha; topilmasa xabar", async () => {
    const { w } = await mountAt('/exams/questions')
    await w.get('[data-testid="subject-search"]').setValue('fiz')
    expect(w.findAll('[data-testid="subject-card"]')).toHaveLength(1)
    await w.get('[data-testid="subject-search"]').setValue('zzz')
    expect(w.findAll('[data-testid="subject-card"]')).toHaveLength(0)
    expect(w.text()).toContain(uz.exams.bank.noMatch)
  })

  it('fan biriktirilmagan o`qituvchi: "Sizga fan biriktirilmagan"; ma`muriyat uchun nofaol fan belgisi', async () => {
    api.subjects.mockResolvedValue({ scope: 'own', subjects: [] })
    const a = await mountAt('/exams/questions')
    expect(a.w.get('[data-testid="no-subjects"]').text()).toContain('Sizga fan biriktirilmagan')
    api.subjects.mockResolvedValue({ scope: 'all', subjects: [subj({ isActive: false })] })
    const b = await mountAt('/exams/questions')
    expect(b.w.find('[data-testid="subject-inactive"]').exists()).toBe(true)
  })
})

describe('SubjectTopicsView: mavzu kartalari', () => {
  it('breadcrumb, kartalar (nom, tavsif, savollar soni, yaratuvchi) va navigatsiya mavzu sahifasiga', async () => {
    api.listTopics.mockResolvedValue(
      topicsResp([
        topic(),
        topic({
          id: 't2',
          name: 'Tenglamalar',
          description: '',
          isMine: false,
          createdByName: 'Vali',
          canEdit: false,
          questionsCount: 0,
          isEmpty: true,
        }),
      ]),
    )
    const { w, router } = await mountAt('/exams/subjects/math')
    expect(api.listTopics).toHaveBeenCalledWith('math')
    expect(w.get('[data-testid="exam-breadcrumb"]').text()).toContain('Savollar banki')
    expect(w.get('h1').text()).toBe('Matematika')
    const cards = w.findAll('[data-testid="topic-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Oddiy kasrlar')
    expect(cards[0]!.get('[data-testid="topic-questions"]').text()).toBe('3 ta savol')
    expect(cards[1]!.text()).toContain('Vali')
    await cards[0]!.get('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('exam-topic')
    expect(router.currentRoute.value.params.topicId).toBe('t1')
  })

  it("tahrirlash va o'chirish: huquqsiz yoki bo'sh bo'lmasa o'chirilgan va tooltip bor", async () => {
    api.listTopics.mockResolvedValue(
      topicsResp([
        topic({ canEdit: true, canDelete: false }),
        topic({ id: 't2', name: 'B', canEdit: false, canDelete: false }),
        topic({
          id: 't3',
          name: 'C',
          canEdit: true,
          canDelete: true,
          isEmpty: true,
          questionsCount: 0,
        }),
      ]),
    )
    const { w } = await mountAt('/exams/subjects/math')
    const edit = w.findAll('[data-testid="topic-edit"]')
    const del = w.findAll('[data-testid="topic-delete"]')
    expect(edit.map((b) => b.attributes('disabled') !== undefined)).toEqual([false, true, false])
    expect(del.map((b) => b.attributes('disabled') !== undefined)).toEqual([true, true, false])
    expect(del[0]!.attributes('title')).toBe(uz.exams.topics.notEmpty)
    expect(edit[1]!.attributes('title')).toBe(uz.exams.topics.cantEdit)
    expect(del[1]!.attributes('title')).toBe(uz.exams.topics.cantEdit)
    // Tartiblash tugmalari: hamma mavzuni o'zgartira olmasa ko'rinmaydi
    expect(w.find('[data-testid="topic-up"]').exists()).toBe(false)
  })

  it("mavzu qo'shish oynasi: nom majburiy, yaratilgach ro'yxat yangilanadi; takroriy nom (409) xabari", async () => {
    api.listTopics.mockResolvedValue(topicsResp([]))
    const { w } = await mountAt('/exams/subjects/math')
    expect(w.find('[data-testid="no-topics"]').exists()).toBe(true)
    await w.get('[data-testid="add-topic"]').trigger('click')
    await flushPromises()
    const input = document.body.querySelector('[data-testid="topic-name"]') as HTMLInputElement
    const desc = document.body.querySelector(
      '[data-testid="topic-description"]',
    ) as HTMLTextAreaElement
    const save = document.body.querySelector('[data-testid="topic-save"]') as HTMLButtonElement
    expect(input).toBeTruthy()
    // Bo'sh nom
    save.click()
    await flushPromises()
    expect(api.createTopic).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(uz.exams.topics.errors.nameRequired)
    // Takroriy nom
    input.value = 'Kasrlar'
    input.dispatchEvent(new Event('input'))
    desc.value = 'Tavsif'
    desc.dispatchEvent(new Event('input'))
    api.createTopic.mockRejectedValueOnce(new ApiError('CONFLICT', 'dup', 409))
    save.click()
    await flushPromises()
    expect(document.body.textContent).toContain(uz.exams.topics.errors.duplicate)
    // Muvaffaqiyat
    api.createTopic.mockResolvedValueOnce(topic())
    api.listTopics.mockResolvedValue(topicsResp([topic()]))
    save.click()
    await flushPromises()
    expect(api.createTopic).toHaveBeenLastCalledWith('math', {
      name: 'Kasrlar',
      description: 'Tavsif',
    })
    expect(w.findAll('[data-testid="topic-card"]')).toHaveLength(1)
  })

  it("o'chirish: tasdiq so'raladi, so'ng mavzu o'chiriladi", async () => {
    api.listTopics.mockResolvedValue(
      topicsResp([topic({ canDelete: true, isEmpty: true, questionsCount: 0 })]),
    )
    api.removeTopic.mockResolvedValue({ id: 't1', deleted: true })
    const { w } = await mountAt('/exams/subjects/math')
    const { state, settle } = useConfirm()
    await w.get('[data-testid="topic-delete"]').trigger('click')
    await flushPromises()
    expect(state.open).toBe(true)
    expect(api.removeTopic).not.toHaveBeenCalled()
    settle(true)
    await flushPromises()
    expect(api.removeTopic).toHaveBeenCalledWith('t1')
  })

  it("tartiblash: ma'muriyat (hammasi tahrirlanadi) ko'radi; pastga tugmasi serverga yangi tartibni yuboradi", async () => {
    const list = [topic({ id: 'a', name: 'A' }), topic({ id: 'b', name: 'B' })]
    api.listTopics.mockResolvedValue(topicsResp(list))
    api.reorderTopics.mockResolvedValue(topicsResp([list[1]!, list[0]!]))
    const { w } = await mountAt('/exams/subjects/math')
    await w.findAll('[data-testid="topic-down"]')[0]!.trigger('click')
    await flushPromises()
    expect(api.reorderTopics).toHaveBeenCalledWith('math', ['b', 'a'])
    expect(w.findAll('[data-testid="topic-name-text"]').map((x) => x.text())).toEqual(['B', 'A'])
  })

  it("o'qituvchi fani bo'lmagan fan: 403 holati (xabar va bankka havola)", async () => {
    api.listTopics.mockRejectedValue(new ApiError('FORBIDDEN', 'x', 403))
    const { w } = await mountAt('/exams/subjects/phys')
    expect(w.get('[data-testid="subject-forbidden"]').text()).toContain(
      'Bu fan sizga biriktirilmagan',
    )
  })
})

describe('QuestionEditorView: mavzu tanlash', () => {
  it('?topicId bilan fan va mavzu oldindan tanlangan; fan almashsa mavzu tozalanadi va yangi fan mavzulari yuklanadi', async () => {
    api.getTopic.mockResolvedValue({
      id: 't1',
      subjectId: 'math',
      subjectName: 'Matematika',
      name: 'Kasrlar',
    })
    api.subjects.mockResolvedValue({
      scope: 'own',
      subjects: [subj(), subj({ id: 'phys', name: 'Fizika' })],
    })
    api.listTopics.mockImplementation((id: string) =>
      Promise.resolve({
        subject: { id, name: id, isActive: true },
        topics:
          id === 'math'
            ? [
                { id: 't1', name: 'Kasrlar' },
                { id: 't2', name: 'Tenglamalar' },
              ]
            : [{ id: 'p1', name: 'Kinematika' }],
      }),
    )
    const { w } = await mountAt('/exams/questions/new?topicId=t1')
    const topicSel = w.get('[data-testid="field-topic"]')
    expect((topicSel.element as HTMLSelectElement).value).toBe('t1')
    expect([...(topicSel.element as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      'Mavzuni tanlang',
      'Kasrlar',
      'Tenglamalar',
    ])
    await w.get('[data-testid="field-subject"]').setValue('phys')
    await flushPromises()
    expect(api.listTopics).toHaveBeenLastCalledWith('phys')
    expect((w.get('[data-testid="field-topic"]').element as HTMLSelectElement).value).toBe('')
    expect(
      [...(w.get('[data-testid="field-topic"]').element as HTMLSelectElement).options].map(
        (o) => o.text,
      ),
    ).toContain('Kinematika')
  })

  it("mavzusiz saqlab bo'lmaydi; tez yaratish yangi mavzuni tanlab qo'yadi", async () => {
    api.subjects.mockResolvedValue({ scope: 'own', subjects: [subj()] })
    api.listTopics.mockResolvedValue({
      subject: { id: 'math', name: 'M', isActive: true },
      topics: [],
    })
    api.createTopic.mockResolvedValue(topic({ id: 'tn', name: 'Yangi mavzu' }))
    const { w } = await mountAt('/exams/questions/new')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain(uz.exams.errors.topic)
    await w.get('[data-testid="quick-topic-input"]').setValue('Yangi mavzu')
    await w.get('[data-testid="quick-topic-add"]').trigger('click')
    await flushPromises()
    expect(api.createTopic).toHaveBeenCalledWith('math', { name: 'Yangi mavzu' })
    expect((w.get('[data-testid="field-topic"]').element as HTMLSelectElement).value).toBe('tn')
  })
})
