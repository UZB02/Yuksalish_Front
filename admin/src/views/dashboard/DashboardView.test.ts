import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { dashboardApi } from '@/api/dashboard.api'
import type { DashboardSummary, Role, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import DashboardView from './DashboardView.vue'

vi.mock('@/api/dashboard.api', () => ({ dashboardApi: { summary: vi.fn() } }))
vi.mock('@/api/attendance.api', () => ({ attendanceApi: { todayProgress: vi.fn() } }))
vi.mock('@/api/scores.api', () => ({ scoresApi: { todayProgress: vi.fn() } }))
vi.mock('@/components/ratings/TopRatings.vue', () => ({ default: { template: '<div />' } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const user = (role: Role): User => ({
  id: 'u1',
  fullName: 'U',
  username: 'u',
  role,
  schoolId: 's1',
  permissions: ['dashboard.view'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
})

let wrapper: VueWrapper | null = null

async function mountWith(summary: DashboardSummary) {
  vi.mocked(dashboardApi.summary).mockResolvedValue(summary)
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', user('school_admin'))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/attendance', name: 'attendance', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(DashboardView, { global: { plugins: [pinia, i18n, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('DashboardView: bugungi davomat', () => {
  const base = { students: 10, classes: 2, teachers: 3, scoresToday: 0 }

  it('Qisman guruhi present / late / partial / absent bilan ko`rsatiladi', async () => {
    const w = await mountWith({
      ...base,
      attendanceToday: {
        present: 5,
        late: 1,
        partial: 2,
        absent: 1,
        total: 10,
        unmarkedClasses: 0,
      },
    })
    const block = w.find('[data-testid="attendance-today"]')
    const labels = block.findAll('dt').map((d) => d.text())
    expect(labels).toEqual(['Keldi', 'Kechikdi', 'Qisman', "Yo'q"])
    expect(block.findAll('dd').map((d) => d.text())).toEqual(['5', '1', '2', '1'])
    expect(block.find('[data-testid="attendance-partial"]').exists()).toBe(true)
  })

  it('eski server (partial yo`q) — 0 ko`rsatiladi', async () => {
    const w = await mountWith({
      ...base,
      attendanceToday: { present: 3, late: 0, absent: 0, total: 3, unmarkedClasses: 0 },
    })
    expect(w.find('[data-testid="attendance-partial"] dd').text()).toBe('0')
  })
})
