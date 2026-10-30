import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { gradesApi } from '@/api/grades.api'
import type { SubjectGrade } from '@/api/types'
import MyGradesTable from './MyGradesTable.vue'

vi.mock('@/api/grades.api', () => ({ gradesApi: { list: vi.fn(), remove: vi.fn() } }))
vi.mock('@/api/subjects.api', () => ({
  subjectsApi: { list: vi.fn().mockResolvedValue({ items: [] }) },
}))
vi.mock('@/api/classes.api', () => ({
  classesApi: { list: vi.fn().mockResolvedValue({ items: [], meta: { total: 0 } }) },
}))
vi.mock('@/api/settings.api', () => ({
  settingsApi: { getScoring: vi.fn().mockRejectedValue(new Error('x')) },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const grade = (id: string, lessonNo: number): SubjectGrade => ({
  id,
  studentId: 's1',
  student: { id: 's1', fullName: 'Aliyev Ali' },
  classId: 'c1',
  class: { id: 'c1', name: '8-B' },
  subjectId: 'eng',
  subject: { id: 'eng', name: 'Ingliz tili' },
  teacherId: 't1',
  teacher: { id: 't1', fullName: 'Karimov K.' },
  academicYearId: 'y1',
  value: 5,
  comment: null,
  date: '2026-10-14',
  lessonNo,
  editable: true,
  createdAt: '2026-10-14T07:00:00Z',
  updatedAt: '2026-10-14T07:00:00Z',
})

let wrapper: VueWrapper | null = null
beforeEach(() => {
  vi.mocked(gradesApi.list).mockResolvedValue({
    items: [grade('g1', 1), grade('g2', 3), grade('g3', 0)],
    meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
  } as never)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('MyGradesTable: dars belgisi', () => {
  it('lessonNo > 0 bo`lsa sana yonida "3-dars", 0 bo`lsa belgi yo`q', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/students/:id', name: 'student-profile', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    wrapper = mount(MyGradesTable, {
      props: { isHistory: false },
      global: { plugins: [pinia, i18n, router] },
    })
    await flushPromises()
    const labels = wrapper.findAll('[data-testid="lesson-label"]').map((l) => l.text())
    expect(labels).toEqual(['1-dars', '3-dars'])
    expect(wrapper.text()).toContain('14.10.2026')
  })
})
