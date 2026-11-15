import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { NAV_ITEMS } from '@/constants/navigation'
import type { Role, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import AppSidebar from './AppSidebar.vue'

const getSettings = vi.fn()
vi.mock('@/api/settings.api', () => ({
  settingsApi: { get: (...a: unknown[]) => getSettings(...a) },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

function stubMedia() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
}

async function mountSidebar(
  role: Role,
  permissions: string[],
  opts: { schoolId?: string | null } = {},
) {
  stubMedia()
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.setSession('t', {
    id: 'u1',
    role,
    schoolId: opts.schoolId === undefined ? 's1' : opts.schoolId,
    permissions,
  } as unknown as User)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...NAV_ITEMS.map((i) => ({ path: `/${i.name}`, name: i.name, component: empty })),
      { path: '/dashboard', name: 'dashboard', component: empty },
      { path: '/exams/questions/:id/edit', name: 'exam-question-edit', component: empty },
      { path: '/classes/:id', name: 'class-detail', component: empty },
      { path: '/profile', name: 'profile', component: empty },
    ],
  })
  await router.push('/dashboard')
  await router.isReady()
  const w = mount(AppSidebar, { global: { plugins: [pinia, i18n, router] } })
  await flushPromises()
  return { w, pinia }
}

const examsLink = (w: Awaited<ReturnType<typeof mountSidebar>>['w']) =>
  w.findAll('a').find((a) => a.text() === uz.nav.examQuestions)

const resp = (enabled: boolean) => ({
  effective: { enabled, teachersCanCreateQuizzes: true, candidateRetentionDays: 365 },
  global: {},
  override: null,
})

describe('Sidebar: "Savollar banki" faqat imtihon moduli yoqilgan maktabda', () => {
  beforeEach(() => getSettings.mockReset())
  afterEach(() => vi.unstubAllGlobals())

  it("modul o'chiq: o'qituvchiga (exams.questions doim bor) ham, ma'muriyatga ham ko'rinmaydi", async () => {
    getSettings.mockResolvedValue(resp(false))
    const t = await mountSidebar('teacher', ['dashboard.view', 'students.view', 'exams.questions'])
    expect(examsLink(t.w)).toBeUndefined()
    const a = await mountSidebar('school_admin', ['dashboard.view', 'exams.manage'])
    expect(examsLink(a.w)).toBeUndefined()
  })

  it("modul yoqilgan: exams.questions yoki exams.manage bor foydalanuvchiga ko'rinadi", async () => {
    getSettings.mockResolvedValue(resp(true))
    const t = await mountSidebar('teacher', ['dashboard.view', 'students.view', 'exams.questions'])
    expect(examsLink(t.w)).toBeDefined()
    const a = await mountSidebar('school_admin', ['dashboard.view', 'exams.manage'])
    expect(examsLink(a.w)).toBeDefined()
    expect(getSettings).toHaveBeenCalledWith('exams', undefined)
  })

  it("modul yoqilgan, ammo ruxsat yo'q: ko'rinmaydi", async () => {
    getSettings.mockResolvedValue(resp(true))
    const { w } = await mountSidebar('school_admin', ['dashboard.view', 'students.view'])
    expect(examsLink(w)).toBeUndefined()
  })

  it('superadmin: maktab tanlanmaguncha yashirin, yoqilgan maktab tanlansa ko`rinadi', async () => {
    getSettings.mockImplementation((_k: string, sid?: string) =>
      Promise.resolve(resp(sid === 'S1')),
    )
    const { w } = await mountSidebar('superadmin', [], { schoolId: null })
    expect(examsLink(w)).toBeUndefined()
    useSchoolContextStore().select('S1')
    await flushPromises()
    expect(examsLink(w)).toBeDefined()
    useSchoolContextStore().select('S2')
    await flushPromises()
    expect(examsLink(w)).toBeUndefined()
  })
})
