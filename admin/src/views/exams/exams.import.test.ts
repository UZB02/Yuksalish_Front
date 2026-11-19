import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { ExamImportItem, ExamImportPreview, User } from '@/api/types'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'
import {
  buildOverrides,
  changeType,
  isEdited,
  isRowImportable,
  rowErrors,
  toRowStates,
} from '@/utils/examImport'

const api = {
  getTopic: vi.fn(),
  importPreview: vi.fn(),
  importCommit: vi.fn(),
  downloadTemplate: vi.fn(),
  fetchAssetBlob: vi.fn(),
}
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import QuestionImportView from './QuestionImportView.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const t = (k: string, p?: object) => i18n.global.t(k, (p ?? {}) as never) as string

const text = (s: string) => ({ type: 'text' as const, text: s })
const item = (row: number, over: Partial<ExamImportItem> = {}): ExamImportItem => ({
  row,
  subjectName: 'Matematika',
  subjectId: 'math',
  difficulty: 2,
  type: 'single',
  points: 1,
  content: [text(`Savol ${row}`)],
  options: [
    { id: 'a', content: [text('3')] },
    { id: 'b', content: [text('4')] },
  ],
  answer: { optionId: 'b' },
  errors: [],
  warnings: [],
  ...over,
})
const bad = item(2, {
  answer: {},
  errors: ["To'g'ri javob: To'g'ri variant tanlanishi kerak"],
})
const warned = item(3, { warnings: ['3-savol: formulani LaTeX ga o‘tkazib bo‘lmadi'] })
const preview = (items: ExamImportItem[], kind: 'excel' | 'word' = 'excel'): ExamImportPreview => ({
  id: 'sess1',
  kind,
  fileName: 'savollar.xlsx',
  expiresAt: new Date(Date.now() + 1800_000).toISOString(),
  consumed: false,
  warnings: [],
  stats: {
    total: items.length,
    valid: items.filter((i) => !i.errors.length).length,
    invalid: items.filter((i) => i.errors.length).length,
  },
  items,
  topic: { id: 'topic1', name: 'Kasrlar', subjectName: 'Matematika' },
})

async function mountView(query = '?topicId=topic1') {
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
      {
        path: '/exams/questions/import',
        name: 'exam-question-import',
        component: QuestionImportView,
      },
    ],
  })
  await router.push(`/exams/questions/import${query}`)
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    { global: { plugins: [pinia, i18n, router] }, attachTo: document.body },
  )
  await flushPromises()
  return { w, router }
}

async function upload(w: Awaited<ReturnType<typeof mountView>>['w'], name = 'q.xlsx') {
  await w.get(`[data-testid="kind-${name.endsWith('.xlsx') ? 'excel' : 'word'}"]`).trigger('click')
  const input = w.get('[data-testid="import-file"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['x'], name)],
    configurable: true,
  })
  await input.trigger('change')
  await w.get('[data-testid="import-analyze"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getTopic.mockResolvedValue({
    id: 'topic1',
    subjectId: 'math',
    subjectName: 'Matematika',
    name: 'Kasrlar',
  })
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('import yordamchilari (utils/examImport)', () => {
  it('tahrirlanmagan qator: server xatolari; tahrirlangan: mijozda qayta hisoblanadi', () => {
    const [ok, err] = toRowStates([item(1), bad])
    expect(rowErrors(ok!, t)).toEqual([])
    expect(rowErrors(err!, t)).toEqual(bad.errors)
    expect(isEdited(err!)).toBe(false)
    err!.item.answer = { optionId: 'a' }
    expect(isEdited(err!)).toBe(true)
    expect(rowErrors(err!, t)).toEqual([])
    expect(isRowImportable(err!, t)).toBe(true)
    err!.excluded = true
    expect(isRowImportable(err!, t)).toBe(false)
  })

  it("tuzatishlar: faqat o'zgargan maydonlar, chiqarilgan qatorlar tushmaydi", () => {
    const rows = toRowStates([item(1), bad, item(4)])
    rows[1]!.item.answer = { optionId: 'a' }
    rows[2]!.item.points = 3
    rows[2]!.excluded = true
    expect(buildOverrides(rows)).toEqual([{ row: 2, answer: { optionId: 'a' } }])
    rows[2]!.excluded = false
    expect(buildOverrides(rows)).toContainEqual({ row: 4, points: 3 })
    expect(buildOverrides(toRowStates([item(1)]))).toEqual([])
  })

  it("tur almashtirish javobni moslaydi; short da javob bo'sh bo'lsa xato", () => {
    const [r] = toRowStates([item(1)])
    r!.item = changeType(r!.item, 'multi')
    expect(r!.item.answer).toEqual({ optionIds: ['b'], partialCredit: false })
    r!.item = changeType(r!.item, 'short')
    expect(r!.item.answer).toEqual({ acceptedAnswers: [] })
    expect(rowErrors(r!, t).join(' ')).toContain(uz.exams.errors.acceptedMin)
    const o = buildOverrides([r!])[0]!
    expect(o).toMatchObject({ type: 'short', answer: { acceptedAnswers: [] } })
  })
})

describe('QuestionImportView: nishon mavzu', () => {
  it("mavzu sarlavhada ko'rsatiladi; fan/mavzu e'tiborsiz qolishi haqida izoh; fan tanlash maydoni yo'q", async () => {
    const { w } = await mountView()
    expect(api.getTopic).toHaveBeenCalledWith('topic1')
    expect(w.get('[data-testid="import-target"]').text()).toContain('Matematika › Kasrlar')
    await w.get('[data-testid="kind-word"]').trigger('click')
    expect(w.get('[data-testid="import-ignored-note"]').text()).toContain('Fan va Mavzu')
    expect(w.find('[data-testid="default-subject"]').exists()).toBe(false)
  })

  it("topicId yo'q yoki mavzu topilmasa: yuklash ochilmaydi, bankka havola", async () => {
    const a = await mountView('')
    expect(a.w.find('[data-testid="import-no-target"]').exists()).toBe(true)
    expect(a.w.find('[data-testid="import-upload"]').exists()).toBe(false)
    api.getTopic.mockRejectedValue(new Error('404'))
    const b = await mountView('?topicId=x')
    expect(b.w.find('[data-testid="import-no-target"]').exists()).toBe(true)
  })
})

describe('QuestionImportView: yuklash, oldindan ko`rish, import', () => {
  it("qadam 1: shablon yuklab olish, noto'g'ri kengaytma serverga bormaydi, Word/Excel tabi", async () => {
    const { w } = await mountView()
    expect(w.find('[data-testid="import-upload"]').exists()).toBe(true)
    // Bankda asosiy usul: "Matnni joylash"; fayl usullari yonida
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(true)
    expect(w.find('[data-testid="format-help"]').exists()).toBe(false)
    await w.get('[data-testid="kind-word"]').trigger('click')
    expect(w.find('[data-testid="paste-root"]').exists()).toBe(false)
    expect(w.get('[data-testid="format-help"]').text()).toContain('*B)')
    await w.get('[data-testid="kind-excel"]').trigger('click')
    expect(w.get('[data-testid="format-help"]').text()).toContain('A,C')
    await w.get('[data-testid="download-template"]').trigger('click')
    expect(api.downloadTemplate).toHaveBeenCalledWith('excel')
    expect(w.get('[data-testid="import-analyze"]').attributes('disabled')).toBeDefined()
    const input = w.get('[data-testid="import-file"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'q.docx')],
      configurable: true,
    })
    await input.trigger('change')
    expect(w.get('[data-testid="import-analyze"]').attributes('disabled')).toBeDefined()
    expect(api.importPreview).not.toHaveBeenCalled()
  })

  it("qadam 2: qatorlar, xato va ogohlantirishlar ko'rinadi; xatoli qator ochiq turadi", async () => {
    api.importPreview.mockResolvedValue(preview([item(1), bad, warned]))
    const { w } = await mountView()
    await upload(w)
    expect(api.importPreview).toHaveBeenCalledWith('excel', expect.any(File), 'topic1')
    const rows = w.findAll('[data-testid="import-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.find('[data-testid="row-ok"]').exists()).toBe(true)
    expect(rows[1]!.get('[data-testid="row-errors"]').text()).toContain(
      "To'g'ri variant tanlanishi kerak",
    )
    expect(rows[1]!.find('[data-testid="row-fix"]').exists()).toBe(true)
    expect(rows[0]!.find('[data-testid="row-fix"]').exists()).toBe(false)
    expect(rows[2]!.get('[data-testid="row-warnings"]').text()).toContain('formulani')
    expect(rows[0]!.find('[data-testid="question-preview"]').exists()).toBe(true)
    expect(w.get('[data-testid="import-preview"]').text()).toContain('tayyor 2, xatoli 1')
  })

  it("qatorni chiqarib tashlash va 'xatolilarni chiqarish'; commit yuborilgan ro'yxat bilan", async () => {
    api.importPreview.mockResolvedValue(preview([item(1), bad, warned]))
    api.importCommit.mockResolvedValue({ created: 1, failed: [], excluded: 2, total: 3 })
    const { w } = await mountView()
    await upload(w)
    await w.findAll('[data-testid="row-exclude"]')[2]!.setValue(true)
    expect(w.get('[data-testid="import-actions"]').text()).toContain('1 ta savol')
    await w.get('[data-testid="exclude-invalid"]').trigger('click')
    expect((w.findAll('[data-testid="row-exclude"]')[1]!.element as HTMLInputElement).checked).toBe(
      true,
    )
    await w.get('[data-testid="import-commit"]').trigger('click')
    await flushPromises()
    expect(api.importCommit).toHaveBeenCalledWith('sess1', {
      exclude: [2, 3],
      overrides: [],
      status: 'draft',
    })
    expect(w.get('[data-testid="done-summary"]').text()).toContain("Qo'shildi: 1")
    expect(w.get('[data-testid="import-done"]').text()).toContain(uz.exams.import.draftNote)
  })

  it("'Darhol faol' belgisi: commit status=active yuboradi va natija izohi o'zgaradi", async () => {
    api.importPreview.mockResolvedValue(preview([item(1)]))
    api.importCommit.mockResolvedValue({ created: 1, failed: [], excluded: 0, total: 1 })
    const { w } = await mountView()
    await upload(w)
    expect(w.get('[data-testid="import-actions"]').text()).toContain('qoralama')
    await w.get('[data-testid="import-active"] input').setValue(true)
    expect(w.get('[data-testid="import-actions"]').text()).toContain('faol holatda')
    await w.get('[data-testid="import-commit"]').trigger('click')
    await flushPromises()
    expect(api.importCommit).toHaveBeenCalledWith('sess1', {
      exclude: [],
      overrides: [],
      status: 'active',
    })
    expect(w.get('[data-testid="done-note"]').text()).toBe(uz.exams.import.activeNote)
  })

  it("xatoni joyida tuzatish: to'g'ri javob tanlansa xato yo'qoladi, tuzatma override sifatida ketadi", async () => {
    api.importPreview.mockResolvedValue(preview([item(1), bad]))
    api.importCommit.mockResolvedValue({ created: 2, failed: [], excluded: 0, total: 2 })
    const { w } = await mountView()
    await upload(w)
    const rows = w.findAll('[data-testid="import-row"]')
    await rows[1]!.findAll('[data-testid="fix-correct"]')[0]!.setValue(true)
    expect(rows[1]!.find('[data-testid="row-bad"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-testid="row-errors"]').exists()).toBe(false)
    expect(w.get('[data-testid="import-actions"]').text()).toContain('2 ta savol')
    await w.get('[data-testid="import-commit"]').trigger('click')
    await flushPromises()
    expect(api.importCommit).toHaveBeenCalledWith('sess1', {
      exclude: [],
      overrides: [{ row: 2, answer: { optionId: 'a' } }],
      status: 'draft',
    })
  })

  it("ball va qiyinlikni qator bo'yicha o'zgartirish override sifatida ketadi; noto'g'ri ball e'tiborsiz", async () => {
    api.importPreview.mockResolvedValue(preview([item(1), item(2)]))
    api.importCommit.mockResolvedValue({ created: 2, failed: [], excluded: 0, total: 2 })
    const { w } = await mountView()
    await upload(w)
    const row = w.findAll('[data-testid="import-row"]')[0]!
    await row.get('[data-testid="row-toggle"]').trigger('click')
    const pts = row.get('[data-testid="fix-points"]')
    await pts.setValue('0')
    await pts.trigger('change')
    await pts.setValue('2.5')
    await pts.trigger('change')
    await row.get('select[data-testid="fix-difficulty"]').setValue('3')
    await w.get('[data-testid="import-commit"]').trigger('click')
    await flushPromises()
    expect(api.importCommit).toHaveBeenCalledWith('sess1', {
      exclude: [],
      overrides: [{ row: 1, difficulty: 3, points: 2.5 }],
      status: 'draft',
    })
  })

  it("barcha savollarga ball: chiqarilganlardan tashqari hammasiga qo'llanadi (vergul ham)", async () => {
    api.importPreview.mockResolvedValue(preview([item(1), item(2), item(3)]))
    api.importCommit.mockResolvedValue({ created: 2, failed: [], excluded: 1, total: 3 })
    const { w } = await mountView()
    await upload(w)
    const apply = w.get('[data-testid="bulk-points-apply"]')
    expect(apply.attributes('disabled')).toBeDefined()
    await w.findAll('[data-testid="row-exclude"]')[2]!.setValue(true)
    await w.get('[data-testid="bulk-points-input"]').setValue('2,5')
    expect(apply.attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="bulk-points"]').trigger('submit')
    await w.get('[data-testid="import-commit"]').trigger('click')
    await flushPromises()
    expect(api.importCommit).toHaveBeenCalledWith('sess1', {
      exclude: [3],
      overrides: [
        { row: 1, points: 2.5 },
        { row: 2, points: 2.5 },
      ],
      status: 'draft',
    })
  })

  it("to'g'ri javob yo'q qator: javob tanlansa tayyor bo'ladi", async () => {
    const noKey = item(5, {
      answer: {},
      errors: ["To'g'ri javob: To'g'ri variant tanlanishi kerak"],
    })
    api.importPreview.mockResolvedValue(preview([noKey]))
    const { w } = await mountView()
    await upload(w)
    const row = w.get('[data-testid="import-row"]')
    expect(row.find('[data-testid="row-bad"]').exists()).toBe(true)
    await row.findAll('[data-testid="fix-correct"]')[1]!.setValue(true)
    expect(row.find('[data-testid="row-bad"]').exists()).toBe(false)
    expect(row.find('[data-testid="row-ok"]').exists()).toBe(true)
  })

  it("serverdagi 'band' (429) xabari ko'rsatiladi va qadam o'zgarmaydi", async () => {
    const { ApiError } = await import('@/api/errors')
    api.importPreview.mockRejectedValue(
      new ApiError('RATE_LIMITED', "Import band, keyinroq urinib ko'ring", 429),
    )
    const { w } = await mountView()
    await upload(w)
    expect(w.find('[data-testid="import-upload"]').exists()).toBe(true)
    expect(w.find('[data-testid="import-preview"]').exists()).toBe(false)
  })

  it("xatoli qator chiqarilmagan bo'lsa tasdiq so'raladi; tasdiqlansa to'g'rilari yuboriladi, natijada xatolilar ro'yxati", async () => {
    api.importPreview.mockResolvedValue(preview([item(1), bad], 'word'))
    api.importCommit.mockResolvedValue({
      created: 1,
      failed: [{ row: 2, errors: ['Fan topilmadi'] }],
      excluded: 0,
      total: 2,
    })
    const { w } = await mountView()
    await upload(w, 'q.docx')
    const { state, settle } = useConfirm()
    await w.get('[data-testid="import-commit"]').trigger('click')
    await flushPromises()
    expect(state.open).toBe(true)
    expect(api.importCommit).not.toHaveBeenCalled()
    settle(true)
    await flushPromises()
    expect(api.importCommit).toHaveBeenCalledTimes(1)
    expect(w.get('[data-testid="done-failed"]').text()).toContain('Fan topilmadi')
    expect(w.get('[data-testid="done-failed"]').text()).toContain('2-savol')
    await w.get('[data-testid="to-bank"]').trigger('click')
  })
})
