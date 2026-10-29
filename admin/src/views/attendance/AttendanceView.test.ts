import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { attendanceApi } from '@/api/attendance.api'
import type { AttendanceSheet, AttendanceStatus } from '@/api/types'
import { DEFAULT_ATTENDANCE_SETTINGS } from '@/composables/useAttendanceSheet'
import { selectOption } from '@/test-utils/selectOption'
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

const sheet = (over: Partial<AttendanceSheet> = {}): AttendanceSheet => ({
  class: { id: 'c1', name: '7-A' },
  date: '2026-10-16',
  mode: 'lesson',
  lessonNo: 1,
  lessonsPerDay: 3,
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
  ],
  ...over,
})

let wrapper: VueWrapper | null = null

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/attendance/:id', name: 'attendance-take', component: AttendanceView },
      { path: '/classes/:id', name: 'class-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/attendance/c1')
  await router.isReady()
  wrapper = mount(AttendanceView, {
    global: { plugins: [pinia, i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
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

describe('AttendanceView: dars fani', () => {
  it('dars rejimida Fan select ko`rinadi, variantlar serverdan; tanlanmaguncha saqlab bo`lmaydi', async () => {
    vi.mocked(attendanceApi.sheet).mockResolvedValue(sheet())
    const w = await mountView()
    const field = w.find('[data-testid="subject-field"]')
    expect(field.exists()).toBe(true)
    const opts = Array.from(field.findAll('option')).map((o) => o.text().trim())
    expect(opts).toEqual(expect.arrayContaining(['Matematika', 'Fizika']))
    expect(opts).not.toContain('Informatika')

    // holat belgilandi, lekin fan yo'q -> saqlash bloklangan va izoh bor
    await w.find('[data-testid="attendance-row"] button, ul button').trigger('click')
    expect(w.text()).toContain(uz.attendance.subjectRequired)
    expect(attendanceApi.bulk).not.toHaveBeenCalled()
  })

  it('bitta variant avtomatik tanlanadi, saqlangan fan oldindan tanlanadi', async () => {
    vi.mocked(attendanceApi.sheet).mockResolvedValue(
      sheet({ subjects: [{ id: 'math', name: 'Matematika', assigned: true }] }),
    )
    let w = await mountView()
    expect(
      (w.find('[data-testid="subject-field"] select').element as HTMLSelectElement).value,
    ).toBe('math')
    w.unmount()

    vi.mocked(attendanceApi.sheet).mockResolvedValue(
      sheet({ subjectId: 'phys', subject: { id: 'phys', name: 'Fizika' } }),
    )
    w = await mountView()
    expect(
      (w.find('[data-testid="subject-field"] select').element as HTMLSelectElement).value,
    ).toBe('phys')
  })

  it('select orqali fan tanlanadi', async () => {
    vi.mocked(attendanceApi.sheet).mockResolvedValue(sheet())
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    const w = await mountView()
    await selectOption(w.find('[data-testid="subject-field"]'), 'Fizika')
    await flushPromises()
    expect(
      (w.find('[data-testid="subject-field"] select').element as HTMLSelectElement).value,
    ).toBe('phys')
  })

  it('biriktirilgan fan yo`q bo`lsa tushuntirish chiqadi; kunlik rejimda select yo`q', async () => {
    vi.mocked(attendanceApi.sheet).mockResolvedValue(sheet({ subjects: [] }))
    let w = await mountView()
    expect(w.find('[data-testid="subject-field"]').text()).toContain(uz.attendance.noSubjects)
    w.unmount()

    vi.mocked(attendanceApi.sheet).mockResolvedValue(
      sheet({
        mode: 'daily',
        lessonNo: null,
        subjects: [],
        settings: { ...DEFAULT_ATTENDANCE_SETTINGS },
      }),
    )
    w = await mountView()
    expect(w.find('[data-testid="subject-field"]').exists()).toBe(false)
  })
})
