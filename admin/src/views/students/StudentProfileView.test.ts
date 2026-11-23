import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { studentsApi } from '@/api/students.api'
import { scoresApi } from '@/api/scores.api'
import { useAuthStore } from '@/stores/auth'
import type { ProfileExamResults } from '@/api/types'
import type { Student, StudentScoreSummary } from '@/api/types'
import StudentProfileView from './StudentProfileView.vue'

vi.mock('@/api/students.api', () => ({
  studentsApi: { get: vi.fn(), setPhoto: vi.fn(), removePhoto: vi.fn(), examResults: vi.fn() },
}))
let examsOn = false
vi.mock('@/stores/features', () => ({
  useFeaturesStore: () => ({ isEnabled: () => examsOn }),
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

async function mountAs(permissions: string[], st: Student = student, exams = false) {
  setActivePinia(createPinia())
  examsOn = exams
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

describe('StudentProfileView: "Imtihonlar" bo`limi', () => {
  const results: ProfileExamResults = {
    items: [
      {
        sessionId: 'e1',
        title: 'DTM sinov',
        heldAt: '2026-11-25T04:00:00.000Z',
        closedAt: '2026-11-25T07:00:00.000Z',
        subjects: ['Matematika', 'Ona tili'],
        scoringMode: 'coefficient',
        passPercent: 60,
        earned: 42,
        max: 60,
        percent: 70,
        passed: true,
        essayPending: 0,
        blocks: [
          {
            id: 'b1',
            title: 'Matematika',
            subjectName: 'Matematika',
            coefficient: 3.1,
            earned: 30,
            max: 40,
            percent: 75,
          },
          {
            id: 'b2',
            title: 'Ona tili',
            subjectName: 'Ona tili',
            coefficient: 2.1,
            earned: 12,
            max: 20,
            percent: 60,
          },
        ],
        examDeleted: false,
      },
    ],
    summary: { count: 1, averagePercent: 70, passedCount: 1 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(studentsApi.examResults).mockResolvedValue(results)
  })

  it('imtihon moduli yoqilgan maktabda bo`lim ko`rinadi: nom, jami, foiz, fan ballari, o`tdi belgisi', async () => {
    const w = await mountAs(['students.view'], student, true)
    expect(studentsApi.examResults).toHaveBeenCalledWith('s1')
    const sec = w.get('[data-testid="profile-exams"]')
    expect(sec.get('[data-testid="exam-title"]').text()).toBe('DTM sinov')
    expect(sec.get('[data-testid="exam-total"]').text()).toBe('42 / 60 · 70%')
    expect(sec.get('[data-testid="exam-passed"]').text()).toBe("O'tdi")
    expect(sec.get('[data-testid="exam-blocks"]').text()).toContain('Matematika')
    expect(sec.get('[data-testid="exam-blocks"]').text()).toContain('30/40')
    expect(sec.get('[data-testid="exams-summary"]').text()).toContain('1 ta imtihon')
    // imtihon natijalarini ko'rish huquqi yo'q: batafsil havola yo'q
    expect(sec.find('[data-testid="exam-detail"]').exists()).toBe(false)
  })

  it('nazoratchi to`xtatgan imtihon: sabab belgisi ko`rinadi', async () => {
    vi.mocked(studentsApi.examResults).mockResolvedValue({
      ...results,
      items: [{ ...results.items[0]!, terminated: { reason: 'Ko‘chirdi' } }],
    })
    const w = await mountAs(['students.view'], student, true)
    expect(w.get('[data-testid="exam-terminated"]').text()).toBe("Nazoratchi to'xtatgan: Ko‘chirdi")
  })

  it('imtihon moduli o`chiq bo`lsa bo`lim ham, so`rov ham yo`q', async () => {
    const w = await mountAs(['students.view'], student, false)
    expect(w.find('[data-testid="profile-exams"]').exists()).toBe(false)
    expect(studentsApi.examResults).not.toHaveBeenCalled()
  })

  it('batafsil havola faqat exams.manage/exams.questions huquqi va o`chirilmagan imtihonda; o`tmadi belgisi; bo`sh holat; xato', async () => {
    const failed = {
      ...results,
      items: [
        { ...results.items[0]!, passed: false, percent: 40 },
        { ...results.items[0]!, sessionId: 'e2', title: 'Eski imtihon', examDeleted: true },
      ],
    }
    vi.mocked(studentsApi.examResults).mockResolvedValue(failed)
    const w = await mountAs(['students.view', 'exams.manage'], student, true)
    const rows = w.findAll('[data-testid^="exam-result-"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('[data-testid="exam-passed"]').text()).toBe("O'tmadi")
    expect(rows[0]!.find('[data-testid="exam-detail"]').exists()).toBe(true)
    expect(rows[1]!.find('[data-testid="exam-detail"]').exists()).toBe(false)
    expect(rows[1]!.text()).toContain("Imtihon o'chirilgan")
    vi.mocked(studentsApi.examResults).mockResolvedValue({
      items: [],
      summary: { count: 0, averagePercent: null, passedCount: 0 },
    })
    const empty = await mountAs(['students.view'], student, true)
    expect(empty.find('[data-testid="exams-empty"]').exists()).toBe(true)
    vi.mocked(studentsApi.examResults).mockRejectedValue(new Error('x'))
    const bad = await mountAs(['students.view'], student, true)
    expect(bad.find('[data-testid="exams-error"]').exists()).toBe(true)
  })
})
