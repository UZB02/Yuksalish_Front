import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { attendanceApi } from '@/api/attendance.api'
import type { AttendanceRecord } from '@/api/types'
import { DEFAULT_ATTENDANCE_SETTINGS } from '@/composables/useAttendanceSheet'
import AttendanceRecordsTab from './AttendanceRecordsTab.vue'

vi.mock('@/api/attendance.api', () => ({
  attendanceApi: { list: vi.fn(), remove: vi.fn(), update: vi.fn() },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const rec = (id: string, lessonNo: number, subject: { id: string; name: string } | null) =>
  ({
    id,
    studentId: 's1',
    student: { id: 's1', fullName: 'Aliyev Ali' },
    classId: 'c1',
    class: { id: 'c1', name: '7-A' },
    date: '2026-10-16',
    lessonNo,
    subjectId: subject?.id ?? null,
    subject,
    statusId: 'st',
    status: { id: 'st', name: 'Keldi', shortName: 'K', color: '#16a34a', category: 'present' },
    minutesLate: null,
    note: null,
    markedBy: { id: 't', fullName: 'Ustoz' },
    updatedBy: { id: 't', fullName: 'Ustoz' },
    editable: false,
    createdAt: '',
    updatedAt: '',
  }) as AttendanceRecord

let wrapper: VueWrapper | null = null
beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('AttendanceRecordsTab: dars fani', () => {
  it('dars raqami yonida fan nomi ko`rsatiladi; fansiz va kunlik yozuvda yo`q', async () => {
    vi.mocked(attendanceApi.list).mockResolvedValue({
      items: [
        rec('1', 1, { id: 'inf', name: 'Informatika' }),
        rec('2', 2, null),
        rec('3', 0, null),
      ],
      meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/students/:id', name: 'student-profile', component: { template: '<div />' } },
      ],
    })
    wrapper = mount(AttendanceRecordsTab, {
      props: {
        classId: 'c1',
        from: '2026-10-01',
        to: '2026-10-31',
        statuses: [],
        settings: { ...DEFAULT_ATTENDANCE_SETTINGS, mode: 'lesson' },
      },
      global: { plugins: [pinia, i18n, router] },
    })
    await flushPromises()
    const subjects = wrapper.findAll('[data-testid="record-subject"]')
    expect(subjects).toHaveLength(1)
    expect(subjects[0]!.text()).toContain('Informatika')
  })
})
