import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { timetableApi } from '@/api/timetable.api'
import type { MyTodayLessons, Role, TodayLesson, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import TodayLessons from './TodayLessons.vue'

vi.mock('@/api/timetable.api', () => ({ timetableApi: { myToday: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const user = (role: Role, permissions: string[]): User => ({
  id: 'u1',
  fullName: 'U',
  username: 'u',
  role,
  schoolId: 's1',
  permissions,
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
})

const lesson = (over: Partial<TodayLesson>): TodayLesson => ({
  date: '2026-10-16',
  lessonNo: 1,
  classId: 'c1',
  class: { id: 'c1', name: '2-B' },
  subjectId: 'inf',
  subject: { id: 'inf', name: 'Informatika' },
  room: null,
  source: 'timetable',
  overrideType: null,
  substitute: false,
  cancelled: false,
  status: 'none',
  markedStudents: 0,
  totalStudents: 20,
  ...over,
})

const payload = (over: Partial<MyTodayLessons> = {}): MyTodayLessons => ({
  date: '2026-10-16',
  attendanceMode: 'lesson',
  working: true,
  hasTimetable: true,
  lessons: [],
  ...over,
})

let wrapper: VueWrapper | null = null

async function mountWith(data: MyTodayLessons, perms = ['attendance.take', 'grades.create']) {
  vi.mocked(timetableApi.myToday).mockResolvedValue(data)
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', user('teacher', perms))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/classes/:id/attendance',
        name: 'class-attendance',
        component: { template: '<div />' },
      },
      { path: '/grading', name: 'grading', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(TodayLessons, { global: { plugins: [pinia, i18n, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('TodayLessons', () => {
  it('darslar tartibda, holat belgilari bilan', async () => {
    const w = await mountWith(
      payload({
        lessons: [
          lesson({ lessonNo: 1, status: 'taken', markedStudents: 20 }),
          lesson({
            lessonNo: 3,
            classId: 'c2',
            class: { id: 'c2', name: '7-C' },
            subjectId: 'math',
            subject: { id: 'math', name: 'Matematika' },
            status: 'partial',
            markedStudents: 5,
            substitute: true,
            source: 'override',
          }),
          lesson({ lessonNo: 5, status: 'none' }),
        ],
      }),
    )
    const rows = w.findAll('[data-testid="today-lesson"]')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.find('[data-testid="lesson-no"]').text())).toEqual(['1', '3', '5'])
    expect(rows[0].text()).toContain('2-B · Informatika')
    expect(rows[0].find('[data-testid="lesson-status"]').text()).toContain('Davomat olingan')
    expect(rows[1].find('[data-testid="lesson-status"]').text()).toContain('Qisman')
    expect(rows[1].find('[data-testid="lesson-status"]').text()).toContain('5/20')
    expect(rows[1].find('[data-testid="substitute-badge"]').text()).toBe("O'rinbosar")
    expect(rows[2].find('[data-testid="lesson-status"]').text()).toContain('Olinmagan')
    expect(rows[0].find('[data-testid="substitute-badge"]').exists()).toBe(false)
  })

  it('[Davomat] va [Baho] havolalari sana, dars va fan bilan', async () => {
    const w = await mountWith(payload({ lessons: [lesson({ lessonNo: 3 })] }))
    const att = w.find('[data-testid="lesson-attendance"]')
    expect(att.attributes('href')).toBe('/classes/c1/attendance?date=2026-10-16&lessonNo=3')
    const grade = w.find('[data-testid="lesson-grade"]')
    expect(grade.attributes('href')).toBe('/grading?classId=c1&subjectId=inf&date=2026-10-16')
  })

  it('ruxsat bo`lmagan tugmalar yashiriladi', async () => {
    const w = await mountWith(payload({ lessons: [lesson({})] }), ['attendance.take'])
    expect(w.find('[data-testid="lesson-attendance"]').exists()).toBe(true)
    expect(w.find('[data-testid="lesson-grade"]').exists()).toBe(false)
  })

  it('bekor qilingan dars: tugmasiz', async () => {
    const w = await mountWith(payload({ lessons: [lesson({ cancelled: true })] }))
    expect(w.find('[data-testid="lesson-attendance"]').exists()).toBe(false)
    expect(w.text()).toContain('Bekor qilingan')
  })

  it('bo`sh holatlar: darsi yo`q / jadval yo`q / dam olish kuni', async () => {
    let w = await mountWith(payload())
    expect(w.find('[data-testid="today-empty"]').text()).toBe("Bugun darsingiz yo'q")
    w.unmount()
    w = await mountWith(payload({ hasTimetable: false }))
    expect(w.find('[data-testid="today-no-timetable"]').text()).toBe('Jadval kiritilmagan')
    w.unmount()
    w = await mountWith(payload({ working: false }))
    expect(w.find('[data-testid="today-not-working"]').exists()).toBe(true)
  })

  it('so`rov xato bo`lsa bo`lim ko`rsatilmaydi', async () => {
    vi.mocked(timetableApi.myToday).mockRejectedValue(new Error('x'))
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setSession('tok', user('teacher', []))
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    wrapper = mount(TodayLessons, { global: { plugins: [pinia, i18n, router] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="today-lessons"]').exists()).toBe(false)
  })
})
