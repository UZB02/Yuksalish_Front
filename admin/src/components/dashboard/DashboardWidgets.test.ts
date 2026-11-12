import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { dashboardApi } from '@/api/dashboard.api'
import type { AttendanceTrend, AttentionStudents, UnscoredClasses } from '@/api/types'
import AttendanceTrendCard from './AttendanceTrendCard.vue'
import AttentionStudentsCard from './AttentionStudentsCard.vue'
import UnscoredClassesCard from './UnscoredClassesCard.vue'

vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: {
    unscoredClasses: vi.fn(),
    attentionStudents: vi.fn(),
    attendanceTrend: vi.fn(),
  },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/classes/:id/scoring', name: 'class-scoring', component: stub },
    { path: '/students/:id', name: 'student-profile', component: stub },
  ],
})

let wrapper: VueWrapper | null = null
async function mountCard(c: object) {
  await router.push('/')
  await router.isReady()
  wrapper = mount(c, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

const unscored = (over: Partial<UnscoredClasses> = {}): UnscoredClasses => ({
  date: '2026-11-12',
  scope: 'school',
  workingDay: true,
  totalClasses: 2,
  classes: [
    {
      classId: 'c6',
      className: '6-A',
      homeroomTeacher: null,
      graded: 0,
      total: 20,
    },
    {
      classId: 'c5',
      className: '5-A',
      homeroomTeacher: { id: 't1', fullName: 'Aliyev Vali' },
      graded: 10,
      total: 20,
    },
  ],
  ...over,
})

describe('UnscoredClassesCard', () => {
  it('qatorlar, sinf rahbari yo`q ogohlantirishi va sinf baholash havolasi', async () => {
    vi.mocked(dashboardApi.unscoredClasses).mockResolvedValue(unscored())
    const w = await mountCard(UnscoredClassesCard)
    const rows = w.findAll('[data-testid="unscored-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('6-A')
    expect(rows[0]!.get('[data-testid="no-homeroom"]').text()).toBe('Sinf rahbari biriktirilmagan')
    expect(rows[1]!.text()).toContain('Sinf rahbari: Aliyev Vali')
    expect(rows[1]!.text()).toContain('10 / 20')
    expect(rows[1]!.get('a').attributes('href')).toBe('/classes/c5/scoring')
    expect(w.find('[data-testid="grade-button"]').exists()).toBe(false)
  })

  it('10 tadan ko`p bo`lsa "Hammasini ko`rish" bilan ochiladi', async () => {
    const classes = Array.from({ length: 13 }, (_, i) => ({
      classId: `c${i}`,
      className: `${i + 1}-A`,
      homeroomTeacher: null,
      graded: 0,
      total: 10,
    }))
    vi.mocked(dashboardApi.unscoredClasses).mockResolvedValue(unscored({ classes }))
    const w = await mountCard(UnscoredClassesCard)
    expect(w.findAll('[data-testid="unscored-row"]')).toHaveLength(10)
    await w.get('[data-testid="unscored-toggle"]').trigger('click')
    expect(w.findAll('[data-testid="unscored-row"]')).toHaveLength(13)
  })

  it('hammasi baholangan / dars kuni emas holatlari', async () => {
    vi.mocked(dashboardApi.unscoredClasses).mockResolvedValue(unscored({ classes: [] }))
    let w = await mountCard(UnscoredClassesCard)
    expect(w.get('[data-testid="widget-empty"]').text()).toBe('Barcha sinflar baholandi ✅')
    w.unmount()
    vi.mocked(dashboardApi.unscoredClasses).mockResolvedValue(
      unscored({ workingDay: false, classes: [] }),
    )
    w = await mountCard(UnscoredClassesCard)
    expect(w.get('[data-testid="widget-not-working"]').text()).toBe('Bugun dars kuni emas')
  })

  it("o'qituvchi: 'Baholash' tugmasi", async () => {
    vi.mocked(dashboardApi.unscoredClasses).mockResolvedValue(
      unscored({ scope: 'homeroom', classes: [unscored().classes[1]!] }),
    )
    const w = await mountCard(UnscoredClassesCard)
    expect(w.get('[data-testid="grade-button"]').text()).toBe('Baholash')
    expect(w.get('[data-testid="grade-button"]').attributes('href')).toBe('/classes/c5/scoring')
  })

  it('xato va qayta urinish', async () => {
    vi.mocked(dashboardApi.unscoredClasses).mockRejectedValueOnce(new Error('x'))
    const w = await mountCard(UnscoredClassesCard)
    expect(w.find('[data-testid="widget-error"]').exists()).toBe(true)
    vi.mocked(dashboardApi.unscoredClasses).mockResolvedValueOnce(unscored())
    await w.get('[data-testid="widget-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="unscored-row"]')).toHaveLength(2)
  })
})

const attention = (over: Partial<AttentionStudents> = {}): AttentionStudents => ({
  current: { from: '2026-11-06', to: '2026-11-12' },
  previous: { from: '2026-10-30', to: '2026-11-05' },
  total: 12,
  students: [
    {
      studentId: 's1',
      fullName: 'Aliyev Ali',
      classId: 'c5',
      className: '5-A',
      reasons: [
        { type: 'drop', from: 92, to: 71, delta: -21 },
        { type: 'negative', count: 3 },
        { type: 'unexcused', days: 2 },
      ],
    },
  ],
  ...over,
})

describe('AttentionStudentsCard', () => {
  it('sabab chiplari, profil havolasi va "yana N ta"', async () => {
    vi.mocked(dashboardApi.attentionStudents).mockResolvedValue(attention())
    const w = await mountCard(AttentionStudentsCard)
    const row = w.get('[data-testid="attention-row"]')
    expect(row.text()).toContain('Aliyev Ali')
    expect(row.text()).toContain('5-A')
    expect(row.get('a').attributes('href')).toBe('/students/s1')
    expect(row.findAll('[data-testid="attention-reason"]').map((r) => r.text())).toEqual([
      'Ball 92 → 71 (−21)',
      '3 ta salbiy xulq',
      "2 kun sababsiz yo'q",
    ])
    expect(w.text()).toContain('Yana 11 ta')
  })

  it('bo`sh holat', async () => {
    vi.mocked(dashboardApi.attentionStudents).mockResolvedValue(
      attention({ students: [], total: 0 }),
    )
    const w = await mountCard(AttentionStudentsCard)
    expect(w.get('[data-testid="widget-empty"]').text()).toBe(
      "Hozircha e'tibor talab qiladigan o'quvchi yo'q",
    )
  })

  it('xato holati', async () => {
    vi.mocked(dashboardApi.attentionStudents).mockRejectedValue(new Error('x'))
    const w = await mountCard(AttentionStudentsCard)
    expect(w.find('[data-testid="widget-error"]').exists()).toBe(true)
  })
})

const trend = (over: Partial<AttendanceTrend> = {}): AttendanceTrend => ({
  from: '2026-10-14',
  to: '2026-11-12',
  average: 91.5,
  days: [
    {
      date: '2026-11-10',
      rate: 95,
      present: 90,
      late: 5,
      partial: 0,
      absentExcused: 3,
      absentUnexcused: 2,
      total: 100,
    },
    {
      date: '2026-11-12',
      rate: 88,
      present: 80,
      late: 8,
      partial: 2,
      absentExcused: 5,
      absentUnexcused: 5,
      total: 100,
    },
  ],
  ...over,
})

describe('AttendanceTrendCard', () => {
  it('faqat ma`lumotli kunlar uchun ustun; o`rtacha qiymat va chizig`i', async () => {
    vi.mocked(dashboardApi.attendanceTrend).mockResolvedValue(trend())
    const w = await mountCard(AttendanceTrendCard)
    expect(w.findAll('[data-testid="trend-bar"]')).toHaveLength(2)
    expect(w.findAll('[data-testid="trend-hit"]')).toHaveLength(2)
    expect(w.get('[data-testid="trend-average"]').text()).toBe("O'rtacha: 91.5%")
    expect(w.find('[data-testid="trend-avg-line"]').exists()).toBe(true)
  })

  it('hover: sana, foiz va sonlar', async () => {
    vi.mocked(dashboardApi.attendanceTrend).mockResolvedValue(trend())
    const w = await mountCard(AttendanceTrendCard)
    expect(w.find('[data-testid="trend-tooltip"]').exists()).toBe(false)
    await w.findAll('[data-testid="trend-hit"]')[1]!.trigger('pointerenter')
    const tip = w.get('[data-testid="trend-tooltip"]')
    expect(tip.text()).toContain('12-noyabr')
    expect(tip.text()).toContain('88%')
    expect(tip.text()).toContain('Keldi')
    expect(tip.text()).toContain('Qisman')
    expect(tip.text()).toContain('Sababsiz')
  })

  it('bo`sh va xato holatlari', async () => {
    vi.mocked(dashboardApi.attendanceTrend).mockResolvedValueOnce(
      trend({ days: [], average: null }),
    )
    let w = await mountCard(AttendanceTrendCard)
    expect(w.get('[data-testid="widget-empty"]').text()).toBe('Oxirgi 30 kunda davomat olinmagan')
    w.unmount()
    vi.mocked(dashboardApi.attendanceTrend).mockRejectedValueOnce(new Error('x'))
    w = await mountCard(AttendanceTrendCard)
    expect(w.find('[data-testid="widget-error"]').exists()).toBe(true)
    vi.mocked(dashboardApi.attendanceTrend).mockResolvedValueOnce(trend())
    await w.get('[data-testid="widget-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="trend-bar"]')).toHaveLength(2)
  })
})
