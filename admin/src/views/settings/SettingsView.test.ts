import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import type { User } from '@/api/types'
import { useConfirm } from '@/composables/useConfirm'
import { registerDirtySource } from '@/composables/useDirtyRegistry'
import { useAuthStore } from '@/stores/auth'
import SettingsView from './SettingsView.vue'

// Bo'lim tablari alohida testlanadi: bu yerda faqat navigatsiya tekshiriladi
vi.mock('./ScoringSettingsTab.vue', async () => stub('scoring'))
vi.mock('./RatingSettingsTab.vue', async () => stub('rating'))
vi.mock('./PublicSettingsTab.vue', async () => stub('public'))
vi.mock('./AttendanceSettingsTab.vue', async () => stub('attendance'))
vi.mock('./TimetableSettingsTab.vue', async () => stub('timetable'))
vi.mock('./BrandingSettingsTab.vue', async () => stub('branding'))
vi.mock('./SchoolLogoTab.vue', async () => stub('schoolLogo'))
vi.mock('./TelegramSettingsTab.vue', async () => stub('telegram'))

async function stub(name: string) {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ render: () => h('div', { 'data-testid': `tab-${name}` }) }) }
}

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

function setup(role: 'superadmin' | 'school_admin' | 'teacher', permissions: string[] = []) {
  setActivePinia(createPinia())
  useAuthStore().user = { id: 'u1', role, permissions } as unknown as User
}

async function mountAt(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings', component: SettingsView }],
  })
  await router.push(url)
  await router.isReady()
  const w = mount(SettingsView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return { w, router }
}
const groupKeys = (w: ReturnType<typeof mount>) =>
  w.findAll('[data-testid^="settings-group-"]').map((g) => g.attributes('data-testid')!.slice(15))
const itemKeys = (w: ReturnType<typeof mount>) =>
  w.findAll('[data-testid^="settings-nav-"]').map((g) => g.attributes('data-testid')!.slice(13))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SettingsView: yon menyu guruhlari (rollar)', () => {
  it("superadmin: 5 guruh, barcha bo'limlar tartib bilan", async () => {
    setup('superadmin')
    const { w } = await mountAt('/settings')
    expect(groupKeys(w)).toEqual(['grading', 'process', 'publicSite', 'appearance', 'integrations'])
    expect(itemKeys(w)).toEqual([
      'scoring',
      'rating',
      'attendance',
      'timetable',
      'public',
      'branding',
      'telegram',
    ])
    expect(w.get('[data-testid="settings-group-grading"]').text()).toContain(
      uz.settings.groups.grading,
    )
  })

  it("maktab admini: bo'sh guruhlar yashiriladi, maktab logosi ko'rinadi", async () => {
    setup('school_admin', ['attendance.settings'])
    const { w } = await mountAt('/settings')
    expect(groupKeys(w)).toEqual(['process', 'appearance', 'integrations'])
    expect(itemKeys(w)).toEqual(['attendance', 'timetable', 'schoolLogo', 'telegram'])
  })

  it("ruxsatsiz foydalanuvchi: menyu bo'sh", async () => {
    setup('teacher')
    const { w } = await mountAt('/settings')
    expect(groupKeys(w)).toEqual([])
  })
})

describe('SettingsView: ?tab= sinxronizatsiyasi', () => {
  it("?tab=telegram shu bo'limni ochadi va aria-current belgilaydi", async () => {
    setup('superadmin')
    const { w } = await mountAt('/settings?tab=telegram')
    expect(w.find('[data-testid="tab-telegram"]').exists()).toBe(true)
    expect(w.get('[data-testid="settings-nav-telegram"]').attributes('aria-current')).toBe('page')
    expect(w.get('[data-testid="settings-nav-scoring"]').attributes('aria-current')).toBeUndefined()
    expect(w.get('[data-testid="settings-section-title"]').text()).toBe(uz.settings.tabs.telegram)
  })

  it("noma'lum yoki ruxsatsiz tab birinchi bo'limga tushadi", async () => {
    setup('school_admin', ['attendance.settings'])
    const { w } = await mountAt('/settings?tab=scoring')
    expect(w.find('[data-testid="tab-attendance"]').exists()).toBe(true)
  })

  it("bo'lim tanlash ?tab= ni router.replace bilan yangilaydi (tarixsiz)", async () => {
    setup('superadmin')
    const { w, router } = await mountAt('/settings')
    const replace = vi.spyOn(router, 'replace')
    const push = vi.spyOn(router, 'push')
    await w.get('[data-testid="settings-nav-rating"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ query: { tab: 'rating' } })
    expect(push).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.tab).toBe('rating')
    expect(w.find('[data-testid="tab-rating"]').exists()).toBe(true)
  })
})

describe("SettingsView: saqlanmagan o'zgarishlar himoyasi", () => {
  it("o'zgarish bo'lsa almashtirishdan oldin tasdiq so'raydi", async () => {
    setup('superadmin')
    const { w, router } = await mountAt('/settings?tab=scoring')
    const off = registerDirtySource(() => true)
    await w.get('[data-testid="settings-nav-rating"]').trigger('click')
    await flushPromises()
    expect(useConfirm().state.open).toBe(true)
    useConfirm().settle(false)
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('scoring')
    expect(w.find('[data-testid="tab-scoring"]').exists()).toBe(true)

    await w.get('[data-testid="settings-nav-rating"]').trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('rating')
    off()
  })

  it("o'zgarish bo'lmasa tasdiqsiz almashadi", async () => {
    setup('superadmin')
    const { w, router } = await mountAt('/settings?tab=scoring')
    await w.get('[data-testid="settings-nav-telegram"]').trigger('click')
    await flushPromises()
    expect(useConfirm().state.open).toBe(false)
    expect(router.currentRoute.value.query.tab).toBe('telegram')
  })
})
