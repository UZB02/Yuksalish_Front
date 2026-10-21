import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { reportsApi } from '@/api/reports.api'
import type { Role, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import ReportsView from './ReportsView.vue'
import ClassReportTab from './ClassReportTab.vue'
import TeachersReportTab from './TeachersReportTab.vue'
import StudentReportTab from './StudentReportTab.vue'
import { ApiError } from '@/api/errors'

vi.mock('@/api/reports.api', () => ({
  reportsApi: {
    class: vi.fn(),
    student: vi.fn(),
    teachers: vi.fn(),
    school: vi.fn(),
    behavior: vi.fn(),
    schools: vi.fn(),
    export: vi.fn(),
  },
}))
vi.mock('@/api/classes.api', () => ({
  classesApi: {
    list: vi.fn(async () => ({
      items: [{ id: 'c1', name: '7-A' }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })),
  },
}))
vi.mock('@/api/academicYears.api', () => ({
  academicYearsApi: {
    list: vi.fn(async () => ({
      items: [
        {
          id: 'y1',
          name: '2026/27',
          startDate: '2026-09-01',
          endDate: '2027-05-31',
          isActive: true,
          periods: [{ name: '1-chorak', startDate: '2026-09-01', endDate: '2026-10-31' }],
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })),
  },
}))
vi.mock('@/api/students.api', () => ({
  studentsApi: {
    list: vi.fn(async () => ({
      items: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
    })),
  },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const user = (role: Role, permissions: string[], schoolId: string | null = 's1'): User => ({
  id: 'u1',
  fullName: 'U',
  username: 'u',
  role,
  schoolId,
  permissions,
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
})

async function mountView(role: Role, permissions: string[], query: Record<string, string> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', user(role, permissions))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reports', name: 'reports', component: ReportsView },
      { path: '/students/:id', name: 'student-profile', component: { template: '<div/>' } },
    ],
  })
  await router.push({ path: '/reports', query })
  await router.isReady()
  const w = mount(ReportsView, { global: { plugins: [pinia, i18n, router] } })
  await flushPromises()
  return { w, router }
}

const classReport = {
  meta: {},
  class: { id: 'c1', name: '7-A', grade: 7, homeroomTeacher: { id: 't', fullName: 'Karimova N.' } },
  summary: {
    students: 2,
    ratedStudents: 2,
    avgScore: 88.5,
    daysScored: 5,
    scoresCount: 10,
    attendanceRate: 92.5,
    penaltyTotal: 3,
  },
  students: [
    {
      studentId: 's1',
      fullName: 'Aliyev Vali',
      studentCode: null,
      rank: 12,
      classRank: 1,
      ratingScore: 90,
      avgScore: 91,
      minScore: 80,
      maxScore: 100,
      daysCount: 5,
      scoresCount: 5,
      attendance: {
        present: 5,
        late: 0,
        absentExcused: 0,
        absentUnexcused: 0,
        total: 5,
        rate: 100,
      },
      penalty: 0,
      topBehavior: { name: 'Faol', count: 3 },
    },
    {
      studentId: 's2',
      fullName: 'Botirov Sher',
      studentCode: null,
      rank: null,
      classRank: null,
      ratingScore: 80,
      avgScore: 85,
      minScore: 70,
      maxScore: 95,
      daysCount: 5,
      scoresCount: 5,
      attendance: { present: 3, late: 0, absentExcused: 0, absentUnexcused: 2, total: 5, rate: 60 },
      penalty: 3,
      topBehavior: null,
    },
  ],
  behaviorDistribution: [
    { behaviorTypeId: 'b1', name: 'Faol', kind: 'positive', color: '#16a34a', count: 3 },
  ],
}

describe("ReportsView: ruxsat bo'yicha tablar", () => {
  beforeEach(() => vi.clearAllMocks())

  it("o'qituvchi (reports.view) faqat Sinf va O'quvchi tablarini ko'radi", async () => {
    const { w } = await mountView('teacher', ['reports.view'])
    expect(w.findAll('[role="tab"]').map((t) => t.attributes('data-tab'))).toEqual([
      'class',
      'student',
    ])
  })

  it("maktab admini 5 ta tab, Maktablar yo'q", async () => {
    const { w } = await mountView('school_admin', ['reports.view'])
    expect(w.findAll('[role="tab"]').map((t) => t.attributes('data-tab'))).toEqual([
      'class',
      'student',
      'teachers',
      'school',
      'behavior',
    ])
  })

  it("faqat superadmin Maktablar tabini ko'radi", async () => {
    const { w } = await mountView('superadmin', [])
    const tabs = w.findAll('[role="tab"]').map((t) => t.attributes('data-tab'))
    expect(tabs).toContain('schools')
    expect(tabs).toHaveLength(6)
  })

  it("reports.export yo'q: eksport tugmalari yo'q; bor: ko'rinadi", async () => {
    const without = await mountView('school_admin', ['reports.view'])
    expect(without.w.find('[data-testid="export-xlsx"]').exists()).toBe(false)
    const withExp = await mountView('school_admin', ['reports.view', 'reports.export'])
    expect(withExp.w.find('[data-testid="export-xlsx"]').exists()).toBe(true)
    expect(withExp.w.find('[data-testid="export-pdf"]').exists()).toBe(true)
  })

  it("URL query dagi tab ruxsat etilmagan bo'lsa birinchi tabga qaytadi", async () => {
    const { w } = await mountView('teacher', ['reports.view'], { tab: 'schools' })
    expect(w.find('[data-tab="class"]').attributes('aria-selected')).toBe('true')
  })
})

describe("ReportsView: filtr -> so'rov -> holat", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sinf tanlanmaguncha so'rov yuborilmaydi; URL dagi sinf bilan so'raydi va jadvalni chizadi", async () => {
    vi.mocked(reportsApi.class).mockResolvedValue(classReport as never)
    const { w } = await mountView('school_admin', ['reports.view'], { tab: 'class' })
    expect(reportsApi.class).not.toHaveBeenCalled()
    expect(w.find('[data-testid="report-idle"]').exists()).toBe(true)

    const shared = await mountView('school_admin', ['reports.view'], {
      tab: 'class',
      classId: 'c1',
    })
    expect(reportsApi.class).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(reportsApi.class).mock.calls[0]![0]
    expect(arg.classId).toBe('c1')
    expect(arg.from).toMatch(/^\d{4}-\d{2}-01$/) // standart: joriy oy boshidan
    expect(shared.w.text()).toContain('Aliyev Vali')
    expect(shared.w.text()).toContain('Botirov Sher')
    expect(shared.w.find('[data-stat="attendance"]').text()).toContain('92.5%')
  })

  it("davr tezkor tanlovi URL ga yoziladi va qayta so'raydi", async () => {
    vi.mocked(reportsApi.class).mockResolvedValue(classReport as never)
    const { w, router } = await mountView('school_admin', ['reports.view'], {
      tab: 'class',
      classId: 'c1',
    })
    await w.find('[data-preset="week"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.preset).toBe('week')
    expect(vi.mocked(reportsApi.class).mock.calls.length).toBeGreaterThanOrEqual(2)
    const last = vi.mocked(reportsApi.class).mock.calls.at(-1)![0]
    expect(last.from <= last.to).toBe(true)
  })

  it("maxsus davr 366 kundan oshsa so'rov yuborilmaydi va xato ko'rinadi", async () => {
    vi.mocked(reportsApi.class).mockResolvedValue(classReport as never)
    const { w } = await mountView('school_admin', ['reports.view'], {
      tab: 'class',
      classId: 'c1',
      from: '2020-01-01',
      to: '2021-06-01',
    })
    expect(w.find('[data-testid="period-error"]').text()).toContain('366')
    expect(reportsApi.class).not.toHaveBeenCalled()
  })

  it('eksport: tanlangan davr va filtr bilan reportsApi.export chaqiriladi', async () => {
    vi.mocked(reportsApi.class).mockResolvedValue(classReport as never)
    vi.mocked(reportsApi.export).mockResolvedValue('sinf.xlsx')
    const { w } = await mountView('school_admin', ['reports.view', 'reports.export'], {
      tab: 'class',
      classId: 'c1',
    })
    await w.find('[data-testid="export-xlsx"]').trigger('click')
    await flushPromises()
    expect(reportsApi.export).toHaveBeenCalledTimes(1)
    const [type, format, params, studentId] = vi.mocked(reportsApi.export).mock.calls[0]!
    expect([type, format, studentId]).toEqual(['class', 'xlsx', undefined])
    expect(params).toMatchObject({ classId: 'c1' })
  })

  it("eksport sinf tanlanmagan bo'lsa bloklangan", async () => {
    const { w } = await mountView('school_admin', ['reports.view', 'reports.export'], {
      tab: 'class',
    })
    expect(w.find('[data-testid="export-pdf"]').attributes('disabled')).toBeDefined()
  })
})

describe("hisobot tablari: bo'sh va xato holatlar", () => {
  const global = {
    plugins: [
      i18n,
      createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/s/:id', name: 'student-profile', component: { template: '<div/>' } }],
      }),
    ],
  }
  beforeEach(() => vi.clearAllMocks())

  it('sinf hisoboti: Sinfda/Maktabda ustunlari, null -> em dash, ikkalasida saralash', async () => {
    vi.mocked(reportsApi.class).mockResolvedValue(classReport as never)
    const w = mount(ClassReportTab, {
      props: { from: '2026-10-01', to: '2026-10-17', classId: 'c1' },
      global,
    })
    await flushPromises()
    const heads = w.findAll('th').map((h) => h.text())
    expect(heads).toContain('Sinfda')
    expect(heads).toContain('Maktabda')
    const rowCells = (i: number) =>
      w
        .findAll('tbody tr')
        [i]!.findAll('td')
        .map((c) => c.text())
    expect(rowCells(0)[1]).toBe('12') // Maktabda
    expect(rowCells(1).slice(0, 2)).toEqual(['—', '—'])
    // Maktabda bo'yicha saralash: null har doim oxirida
    const schoolHead = w.findAll('th button').find((b) => b.text() === 'Maktabda')!
    await schoolHead.trigger('click')
    await schoolHead.trigger('click')
    expect(w.findAll('tbody tr')[0]!.text()).toContain('Aliyev Vali')
    expect(w.findAll('tbody tr')[1]!.text()).toContain('Botirov Sher')
  })

  it("o'quvchi hisoboti: Sinfda va Maktabda o'rin kartalari", async () => {
    vi.mocked(reportsApi.student).mockResolvedValue({
      meta: {},
      student: {
        id: 's1',
        fullName: 'Aliyev Vali',
        studentCode: null,
        class: { id: 'c1', name: '7-A' },
      },
      score: {
        avgScore: 90,
        minScore: 80,
        maxScore: 100,
        daysCount: 3,
        scoresCount: 3,
        rank: 20,
        classRank: 3,
        ratingScore: 88,
        ratedStudentsInClass: 10,
      },
      trend: [],
      behaviorDistribution: [],
      attendance: {
        total: 0,
        present: 0,
        late: 0,
        absentExcused: 0,
        absentUnexcused: 0,
        rate: null,
        penalty: 0,
        days: [],
      },
      entries: [],
    } as never)
    const w = mount(StudentReportTab, {
      props: { from: '2026-10-01', to: '2026-10-17', studentId: 's1' },
      global,
    })
    await flushPromises()
    expect(w.find('[data-stat="classRank"]').text()).toContain('3')
    expect(w.find('[data-stat="classRank"]').text()).toContain('10 dan')
    expect(w.find('[data-stat="rank"]').text()).toContain('20')
    vi.mocked(reportsApi.student).mockResolvedValue({
      ...(await reportsApi.student('s1', { from: '', to: '' })),
      score: {
        avgScore: 1,
        minScore: 1,
        maxScore: 1,
        daysCount: 1,
        scoresCount: 1,
        rank: null,
        classRank: null,
        ratingScore: null,
        ratedStudentsInClass: 4,
      },
    } as never)
    const w2 = mount(StudentReportTab, {
      props: { from: '2026-10-01', to: '2026-10-17', studentId: 's2' },
      global,
    })
    await flushPromises()
    expect(w2.find('[data-stat="classRank"]').text()).toContain('—')
    expect(w2.find('[data-stat="rank"]').text()).toContain('—')
  })

  it("sinf hisoboti: o'quvchilar yo'q -> bo'sh holat", async () => {
    vi.mocked(reportsApi.class).mockResolvedValue({ ...classReport, students: [] } as never)
    const w = mount(ClassReportTab, {
      props: { from: '2026-10-01', to: '2026-10-17', classId: 'c1' },
      global,
    })
    await flushPromises()
    expect(w.find('[data-testid="report-empty"]').text()).toContain("Bu davrda ma'lumot yo'q")
  })

  it('sinf hisoboti: server xatosi -> xato holati va qayta urinish', async () => {
    vi.mocked(reportsApi.class)
      .mockRejectedValueOnce(new ApiError('INTERNAL', 'x', 500))
      .mockResolvedValue(classReport as never)
    const w = mount(ClassReportTab, {
      props: { from: '2026-10-01', to: '2026-10-17', classId: 'c1' },
      global,
    })
    await flushPromises()
    expect(w.find('[data-testid="report-error"]').exists()).toBe(true)
    await w.find('[data-testid="report-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="report-error"]').exists()).toBe(false)
    expect(w.text()).toContain('Aliyev Vali')
  })

  it("o'qituvchilar faolligi: qamrov ranglari (<20 qizil, <50 sariq, >=50 yashil)", async () => {
    const mk = (id: string, rate: number | null) => ({
      teacherId: id,
      fullName: `T${id}`,
      username: `t${id}`,
      isActive: true,
      classes: [{ id: 'c1', name: '7-A' }],
      scoresCount: 10,
      daysActive: 3,
      studentsScored: 20,
      attendanceUnits: 5,
      attendanceDays: 3,
      lastActivityAt: null,
      coverage: { expectedClassDays: 10, scoredClassDays: 1, rate },
    })
    vi.mocked(reportsApi.teachers).mockResolvedValue({
      meta: {},
      teachers: [mk('1', 10), mk('2', 35), mk('3', 80), mk('4', null)],
    } as never)
    const w = mount(TeachersReportTab, {
      props: { from: '2026-10-01', to: '2026-10-17', classId: '' },
      global,
    })
    await flushPromises()
    const tones = w.findAll('[data-testid="coverage"]').map((c) => c.attributes('data-tone'))
    expect(tones.sort()).toEqual(['danger', 'neutral', 'success', 'warning'])
    // Sinf filtri bo'sh bo'lsa parametrga kirmaydi
    expect(vi.mocked(reportsApi.teachers).mock.calls[0]![0].classId).toBeUndefined()
  })
})
