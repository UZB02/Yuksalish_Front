import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { studentsApi } from '@/api/students.api'
import { scoresApi } from '@/api/scores.api'
import { useAuthStore } from '@/stores/auth'
import type { Student, StudentScoreSummary } from '@/api/types'
import StudentProfileView from './StudentProfileView.vue'

vi.mock('@/api/students.api', () => ({
  studentsApi: { get: vi.fn(), setPhoto: vi.fn(), removePhoto: vi.fn() },
}))
vi.mock('@/api/scores.api', () => ({ scoresApi: { studentSummary: vi.fn() } }))
vi.mock('@/api/academic-years.api', () => ({
  academicYearsApi: { list: vi.fn().mockResolvedValue({ items: [] }) },
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 's1' } }) }))
vi.mock('@/components/grading/StudentGradesSection.vue', () => ({
  default: { template: '<div data-testid="student-grades" />' },
}))
vi.mock('@/components/attendance/StudentAttendanceSection.vue', () => ({
  default: { template: '<div data-testid="attendance-section" />' },
}))

const student: Student = {
  id: 's1',
  fullName: 'Aliyev Vali',
  studentCode: 'ST-001',
  birthDate: '2012-03-05T00:00:00.000Z',
  gender: 'male',
  classId: 'c1',
  class: { id: 'c1', name: '7-A' },
  parentPhone: null,
  photoUrl: null,
  status: 'active',
  createdAt: '',
}

const summary = {
  average: 4.5,
  daysCount: 3,
  scoresCount: 7,
  trend: [],
  byBehaviorType: [],
  recent: [],
} as unknown as StudentScoreSummary

async function mountAs(permissions: string[], st: Student = student) {
  setActivePinia(createPinia())
  useAuthStore().setSession('tok', {
    id: 'u',
    fullName: 'U',
    username: 'u',
    role: 'admin',
    schoolId: 's',
    permissions,
    isActive: true,
    lastLoginAt: null,
    createdAt: '',
  } as never)
  vi.mocked(studentsApi.get).mockResolvedValue(st)
  vi.mocked(scoresApi.studentSummary).mockResolvedValue(summary)
  const w = mount(StudentProfileView, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
  await flushPromises()
  return w
}

describe('StudentProfileView header', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ism, holat, avatar harflari va meta qatorni ko`rsatadi', async () => {
    const w = await mountAs(['students.view'])
    const header = w.get('[data-testid="profile-header"]')
    expect(header.get('h1').text()).toBe('Aliyev Vali')
    expect(header.text()).toContain('AV')
    const meta = w.get('[data-testid="profile-meta"]').text()
    expect(meta).toContain('7-A')
    expect(meta).toContain('ST-001')
    expect(w.get('[data-testid="profile-stats"]').text()).toContain('4.5')
  })

  it('hisobot tugmalari faqat reports.export huquqi bilan chiqadi', async () => {
    const without = await mountAs(['students.view'])
    expect(without.find('[data-testid="profile-export"]').exists()).toBe(false)

    const withExport = await mountAs(['students.view', 'reports.export'])
    expect(withExport.get('[data-testid="profile-export"]').findAll('button')).toHaveLength(2)
  })

  it('rasm bor: avatar <img>; rasm boshqaruvi faqat students.manage bilan', async () => {
    const w0 = await mountAs(['students.view'])
    expect(w0.find('[data-testid="photo-edit"]').exists()).toBe(false)
    expect(w0.find('[data-testid="profile-header"] img').exists()).toBe(false)

    const w1 = await mountAs(['students.view', 'students.manage'], {
      ...student,
      photo: '/api/v1/photos/p1?exp=1&sig=s',
    })
    expect(w1.get('[data-testid="profile-header"] img').attributes('src')).toContain('/photos/p1')
    expect(w1.get('[data-testid="photo-edit"]').attributes('aria-label')).toBe(
      "Rasmni o'zgartirish",
    )
  })
})
