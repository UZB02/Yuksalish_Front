import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { gradesApi } from '@/api/grades.api'
import type { GradeSheet, GradeSheetLesson, GradeSheetStudent } from '@/api/types'
import { todayTashkent } from '@/utils/scoring'
import SubjectGradingPanel from './SubjectGradingPanel.vue'

vi.mock('@/api/grades.api', () => ({
  gradesApi: { assignments: vi.fn(), sheet: vi.fn(), bulk: vi.fn() },
}))
vi.mock('@/api/classes.api', () => ({ classesApi: { list: vi.fn() } }))
vi.mock('@/api/subjects.api', () => ({ subjectsApi: { list: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const TODAY = todayTashkent()

const lesson = (lessonNo: number, over: Partial<GradeSheetLesson> = {}): GradeSheetLesson => ({
  lessonNo,
  teacher: { id: 't1', fullName: 'Karimov K.' },
  cancelled: false,
  room: null,
  mine: true,
  ...over,
})
const student = (id: string): GradeSheetStudent => ({
  studentId: id,
  fullName: `O'quvchi ${id}`,
  studentCode: null,
  grade: null,
  alreadyGraded: false,
})
const sheetOf = (lessonNo: number | null, lessons: GradeSheetLesson[]): GradeSheet => ({
  class: { id: 'c1', name: '8-B' },
  subject: { id: 'eng', name: 'Ingliz tili' },
  date: TODAY,
  lessonNo,
  hasTimetable: lessons.length > 0,
  lessons,
  settings: { editWindowHours: 24, backdateDays: 3 },
  students: [student('1'), student('2')],
})

let wrapper: VueWrapper | null = null

async function mountPanel(query: Record<string, string> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/grading', name: 'grading', component: { template: '<div />' } }],
  })
  await router.push({ path: '/grading', query })
  await router.isReady()
  wrapper = mount(SubjectGradingPanel, { global: { plugins: [pinia, i18n, router] } })
  await flushPromises()
  return wrapper
}

const QUERY = { classId: 'c1', subjectId: 'eng' }

beforeEach(() => {
  vi.mocked(gradesApi.assignments).mockResolvedValue({
    mode: 'assigned',
    assignments: [
      { classId: 'c1', className: '8-B', grade: 8, subjectId: 'eng', subjectName: 'Ingliz tili' },
      { classId: 'c1', className: '8-B', grade: 8, subjectId: 'math', subjectName: 'Matematika' },
    ],
  })
  vi.mocked(gradesApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
})

describe('SubjectGradingPanel: dars tanlagich', () => {
  it('dars yo`q: tanlagich ko`rinmaydi, lessonNo 0 bilan saqlanadi', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf(0, []))
    const w = await mountPanel(QUERY)
    expect(w.find('[data-testid="lesson-picker"]').exists()).toBe(false)
    await w.find('button[role="radio"][data-grade="5"]').trigger('click')
    const save = w.findAll('button').find((b) => b.text().includes('Saqlash'))!
    await save.trigger('click')
    await flushPromises()
    expect(gradesApi.bulk).toHaveBeenCalledWith(expect.objectContaining({ lessonNo: 0 }))
  })

  it('bitta dars: faqat o`qish uchun chip, dars payloadda', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf(2, [lesson(2)]))
    const w = await mountPanel(QUERY)
    const chip = w.find('[data-testid="lesson-chip"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('2-dars')
    expect(chip.text()).toContain('Karimov K.')
    expect(w.find('[data-testid="lesson-picker"] [role="radiogroup"]').exists()).toBe(false)
    await w.find('button[role="radio"][data-grade="4"]').trigger('click')
    const save = w.findAll('button').find((b) => b.text().includes('Saqlash'))!
    await save.trigger('click')
    await flushPromises()
    expect(gradesApi.bulk).toHaveBeenCalledWith(expect.objectContaining({ lessonNo: 2 }))
  })

  const manyLessons = () => {
    const many = [lesson(1), lesson(3)]
    vi.mocked(gradesApi.sheet).mockImplementation(async (_c, _s, _d, lessonNo) =>
      sheetOf(lessonNo ?? null, many),
    )
  }
  const saveBtn = (w: VueWrapper) => w.findAll('button').find((b) => b.text().includes('Saqlash'))!

  it('bir nechta dars: chiplar ko`rinadi, dars tanlanmaguncha saqlab bo`lmaydi', async () => {
    manyLessons()
    const w = await mountPanel(QUERY)
    const chips = w.findAll('[data-testid="lesson-picker"] button[role="radio"]')
    expect(chips.map((c) => c.text())).toEqual([
      expect.stringContaining('1-dars'),
      expect.stringContaining('3-dars'),
    ])
    expect(chips.every((c) => c.attributes('aria-checked') === 'false')).toBe(true)
    expect(w.find('[data-testid="lesson-required"]').exists()).toBe(true)
    await w.find('button[role="radio"][data-grade="5"]').trigger('click')
    expect(saveBtn(w).attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="save-bar-message"]').text()).toContain('darsni tanlang')
  })

  it('dars tanlansa varaq shu dars uchun qayta yuklanadi va payloadda shu dars', async () => {
    manyLessons()
    const w = await mountPanel(QUERY)
    await w.find('[data-lesson="3"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(gradesApi.sheet).mock.calls.at(-1)).toEqual(['c1', 'eng', TODAY, 3])
    expect(w.find('[data-testid="lesson-required"]').exists()).toBe(false)
    expect(w.find('[data-lesson="3"]').attributes('aria-checked')).toBe('true')
    await w.find('button[role="radio"][data-grade="5"]').trigger('click')
    expect(saveBtn(w).attributes('disabled')).toBeUndefined()
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(gradesApi.bulk).toHaveBeenCalledWith(expect.objectContaining({ lessonNo: 3 }))
  })

  it('bekor qilingan dars tanlab bo`lmaydi', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(
      sheetOf(null, [lesson(1), lesson(3, { cancelled: true })]),
    )
    const w = await mountPanel(QUERY)
    expect(w.find('[data-lesson="3"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-lesson="3"]').text()).toContain('bekor qilingan')
  })
})

describe('SubjectGradingPanel: havola parametrlari', () => {
  it('?classId&subjectId&date&lessonNo oldindan tanlanadi va birinchi so`rovda yuboriladi', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf(3, [lesson(1), lesson(3)]))
    await mountPanel({ ...QUERY, date: TODAY, lessonNo: '3' })
    expect(gradesApi.sheet).toHaveBeenCalledTimes(1)
    expect(gradesApi.sheet).toHaveBeenCalledWith('c1', 'eng', TODAY, 3)
  })

  it('subjectId berilmasa va ikki fan bo`lsa fan tanlanmaydi; noto`g`ri subjectId e`tiborsiz', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf(0, []))
    const w = await mountPanel({ classId: 'c1', subjectId: 'nope' })
    expect(gradesApi.sheet).not.toHaveBeenCalled()
    expect(w.find('[data-testid="lesson-picker"]').exists()).toBe(false)
  })

  it('chegaradan tashqari sana e`tiborsiz (bugun ishlatiladi)', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf(0, []))
    await mountPanel({ ...QUERY, date: '2020-01-01' })
    expect(gradesApi.sheet).toHaveBeenCalledWith('c1', 'eng', TODAY, null)
  })
})
