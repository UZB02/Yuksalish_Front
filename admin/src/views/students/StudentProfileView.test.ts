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

vi.mock('@/api/students.api', () => ({ studentsApi: { get: vi.fn() } }))
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

async function mountAs(permissions: string[]) {
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
  vi.mocked(studentsApi.get).mockResolvedValue(student)
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
})
