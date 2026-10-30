import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { attendanceApi } from '@/api/attendance.api'
import type { AttendanceSheet, AttendanceSheetLesson, AttendanceStatus } from '@/api/types'
import { DEFAULT_ATTENDANCE_SETTINGS } from '@/composables/useAttendanceSheet'
import AttendanceView from './AttendanceView.vue'

vi.mock('@/api/attendance.api', () => ({
  attendanceApi: { sheet: vi.fn(), bulk: vi.fn(), list: vi.fn() },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const present: AttendanceStatus = {
  id: 'present',
  schoolId: null,
  name: 'Keldi',
  shortName: 'K',
  color: '#16a34a',
  category: 'present',
  isDefault: true,
  order: 1,
  isActive: true,
  createdAt: '',
}

const lesson = (over: Partial<AttendanceSheetLesson>): AttendanceSheetLesson => ({
  classId: 'c1',
  date: '2026-10-16',
  lessonNo: 1,
  groupKey: null,
  subjectId: 'math',
  teacherId: 't1',
  room: null,
  source: 'timetable',
  cancelled: false,
  subject: { id: 'math', name: 'Matematika' },
  teacher: { id: 't1', fullName: 'Aliyev Anvar' },
  mine: false,
  ...over,
})

const L1 = lesson({ lessonNo: 1 })
const L2 = lesson({
  lessonNo: 2,
  subjectId: 'phys',
  subject: { id: 'phys', name: 'Fizika' },
  teacher: { id: 't2', fullName: 'Valiyev Vali' },
  mine: true,
})
const L4 = lesson({
  lessonNo: 4,
  subjectId: 'eng',
  subject: { id: 'eng', name: 'Ingliz tili' },
  cancelled: true,
})
const L8 = lesson({
  lessonNo: 8,
  subjectId: 'art',
  subject: { id: 'art', name: 'Chizmachilik' },
  mine: true,
})

/** Server `lessonNo` ga mos `lesson`/`canTake` ni hisoblaydi */
const sheetFor = (over: Partial<AttendanceSheet> = {}): AttendanceSheet => {
  const lessons = over.lessons ?? [L1, L2, L4, L8]
  const lessonNo = over.lessonNo ?? 1
  return {
    class: { id: 'c1', name: '7-A' },
    date: '2026-10-16',
    mode: 'lesson',
    lessonNo,
    lessonsPerDay: 3,
    maxLessonNo: 8,
    timetable: { enforcement: 'suggest', hasTimetable: true, homeroomCanTakeAnyLesson: true },
    lesson: lessons.find((l) => l.lessonNo === lessonNo) ?? null,
    lessons,
    canTake: true,
    cannotTakeReason: null,
    canOverrideSubject: false,
    isWorkingDay: true,
    settings: { ...DEFAULT_ATTENDANCE_SETTINGS, mode: 'lesson', lessonsPerDay: 3 },
    statuses: [present],
    students: [
      { studentId: 's1', fullName: 'Aliyev Ali', studentCode: null, photo: null, record: null },
    ],
    summary: { total: 1, marked: 0, present: 0, late: 0, absentExcused: 0, absentUnexcused: 0 },
    subjectId: null,
    subject: null,
    subjects: [
      { id: 'math', name: 'Matematika', assigned: true },
      { id: 'phys', name: 'Fizika', assigned: true },
      { id: 'eng', name: 'Ingliz tili', assigned: false },
    ],
    ...over,
  }
}

let wrapper: VueWrapper | null = null

async function mountView(url = '/attendance/c1') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/attendance/:id', name: 'attendance-take', component: AttendanceView },
      { path: '/classes/:id', name: 'class-detail', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(AttendanceView, {
    global: { plugins: [pinia, i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

/** sheet() mock: so'ralgan lessonNo bo'yicha javob qaytaradi */
function mockSheet(
  over: Partial<AttendanceSheet> = {},
  perLesson?: (n: number) => Partial<AttendanceSheet>,
) {
  vi.mocked(attendanceApi.sheet).mockImplementation(async (_id, params) =>
    sheetFor({
      ...over,
      lessonNo: params?.lessonNo ?? 1,
      ...(perLesson?.(params?.lessonNo ?? 1) ?? {}),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(attendanceApi.list).mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 1, total: 0, totalPages: 1 },
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

const chipTexts = (w: VueWrapper) =>
  w.findAll('[data-testid="lesson-chip"]').map((c) => c.text().replace(/\s+/g, ' ').trim())

describe('AttendanceView: jadval bo`yicha dars tanlagich', () => {
  it('chiplar jadvaldan: "1 · Matematika · Aliyev", "3 · (bo`sh)", 8-dars lessonsPerDay dan tashqari', async () => {
    mockSheet()
    const w = await mountView()
    const texts = chipTexts(w)
    expect(texts).toHaveLength(8)
    expect(texts[0]).toContain('1 · Matematika · Aliyev')
    expect(texts[2]).toContain("3 · (bo'sh)")
    expect(texts[7]).toContain('8 · Chizmachilik · Aliyev')
    // bekor qilingan dars chizilgan
    expect(w.findAll('[data-testid="lesson-chip"]')[3].classes()).toContain('line-through')
  })

  it('standart tanlov: o`qituvchining birinchi darsi (2), serverga shu dars so`raladi', async () => {
    mockSheet()
    const w = await mountView()
    const pressed = w
      .findAll('[data-testid="lesson-chip"]')
      .map((c) => c.attributes('aria-pressed'))
    expect(pressed[1]).toBe('true')
    expect(pressed[0]).toBe('false')
    const calls = vi.mocked(attendanceApi.sheet).mock.calls
    expect(calls[calls.length - 1][1]).toMatchObject({ lessonNo: 2 })
  })

  it('o`qituvchining darsi bo`lmasa 1-dars', async () => {
    mockSheet({ lessons: [L1, L4] })
    const w = await mountView()
    expect(w.findAll('[data-testid="lesson-chip"]')[0].attributes('aria-pressed')).toBe('true')
  })

  it('jadvalsiz sinf: oddiy raqam chiplari va fan select', async () => {
    mockSheet({
      lessons: [],
      maxLessonNo: 3,
      timetable: { enforcement: 'suggest', hasTimetable: false, homeroomCanTakeAnyLesson: true },
    })
    const w = await mountView()
    expect(chipTexts(w)).toEqual(['1', '2', '3'])
    expect(w.find('[data-testid="subject-field"]').exists()).toBe(true)
    expect(w.find('[data-testid="subject-chip"]').exists()).toBe(false)
  })

  it('?lessonNo= va ?date= so`rovga uzatiladi', async () => {
    mockSheet()
    await mountView('/attendance/c1?date=2026-10-16&lessonNo=8')
    const first = vi.mocked(attendanceApi.sheet).mock.calls[0]
    expect(first[1]).toMatchObject({ date: '2026-10-16', lessonNo: 8 })
  })
})

describe('AttendanceView: aniqlangan fan va ruxsat', () => {
  it('fan faqat o`qish uchun chip, select yo`q; saqlashda subjectId yuborilmaydi', async () => {
    mockSheet()
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    const w = await mountView('/attendance/c1?lessonNo=1')
    const chip = w.find('[data-testid="subject-chip"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('Matematika')
    expect(w.find('[data-testid="subject-field"]').exists()).toBe(false)
    expect(w.find('[data-testid="subject-override"]').exists()).toBe(false)

    await w.find('ul button').trigger('click')
    const save = w.findAll('button').find((b) => b.text().includes('Saqlash'))
    await save!.trigger('click')
    await flushPromises()
    expect(attendanceApi.bulk).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(attendanceApi.bulk).mock.calls[0][0]
    expect(payload.lessonNo).toBe(1)
    expect(payload.subjectId).toBeUndefined()
  })

  it('admin/sinf rahbari: "o`zgartirish" havolasi select ni ochadi; boshqa fan yuboriladi', async () => {
    mockSheet({ canOverrideSubject: true })
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    const w = await mountView('/attendance/c1?lessonNo=1')
    const link = w.find('[data-testid="subject-override"]')
    expect(link.exists()).toBe(true)
    await link.trigger('click')
    expect(w.find('[data-testid="subject-chip"]').exists()).toBe(false)
    const select = w.find('[data-testid="subject-field"] select')
    expect(select.exists()).toBe(true)
    expect((select.element as HTMLSelectElement).value).toBe('math')
    await select.setValue('phys')
    await flushPromises()

    await w.find('ul button').trigger('click')
    const save = w.findAll('button').find((b) => b.text().includes('Saqlash'))
    await save!.trigger('click')
    await flushPromises()
    expect(vi.mocked(attendanceApi.bulk).mock.calls[0][0].subjectId).toBe('phys')
  })

  it('canTake=false: aniq xabar ko`rsatiladi va saqlab bo`lmaydi', async () => {
    mockSheet({
      canTake: false,
      cannotTakeReason: "Bu dars boshqa o'qituvchiga biriktirilgan",
    })
    const w = await mountView('/attendance/c1?lessonNo=1')
    const alert = w.find('[data-testid="cannot-take"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain("boshqa o'qituvchiga")
    await w.find('ul button').trigger('click')
    const save = w.findAll('button').find((b) => b.text().includes('Saqlash'))
    expect(save?.attributes('disabled')).toBeDefined()
    expect(attendanceApi.bulk).not.toHaveBeenCalled()
  })

  it('bo`sh slotda admin: qo`lda fan select ko`rinadi va fan yuboriladi', async () => {
    mockSheet({ canOverrideSubject: true })
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    const w = await mountView('/attendance/c1?lessonNo=3')
    expect(w.find('[data-testid="subject-chip"]').exists()).toBe(false)
    const select = w.find('[data-testid="subject-field"] select')
    await select.setValue('eng')
    await flushPromises()
    await w.find('ul button').trigger('click')
    const save = w.findAll('button').find((b) => b.text().includes('Saqlash'))
    await save!.trigger('click')
    await flushPromises()
    expect(vi.mocked(attendanceApi.bulk).mock.calls[0][0]).toMatchObject({
      lessonNo: 3,
      subjectId: 'eng',
    })
  })
})
