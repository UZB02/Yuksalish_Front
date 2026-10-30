import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { Branding } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useBrandingStore } from '@/stores/branding'
import BrandingSettingsTab from './BrandingSettingsTab.vue'
import SchoolLogoTab from './SchoolLogoTab.vue'

const api = vi.hoisted(() => ({
  update: vi.fn(),
  uploadLogo: vi.fn(),
  deleteLogo: vi.fn(),
  get: vi.fn(),
}))
vi.mock('@/api/branding.api', () => ({ brandingApi: api }))
const schools = vi.hoisted(() => ({ get: vi.fn(), uploadLogo: vi.fn(), deleteLogo: vi.fn() }))
vi.mock('@/api/schools.api', () => ({ schoolsApi: schools }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const base: Branding = {
  appName: 'Yuksalish EDU',
  shortName: 'Yuksalish EDU',
  logoUrl: null,
  icons: null,
  version: 'v0',
}
const withLogo: Branding = {
  ...base,
  logoUrl: '/api/v1/branding/logo/logo?v=2',
  icons: {
    favicon: '/api/v1/branding/logo/favicon?v=2',
    icon192: '/api/v1/branding/logo/icon192?v=2',
    icon512: '/api/v1/branding/logo/icon512?v=2',
    maskable512: '/api/v1/branding/logo/maskable512?v=2',
    apple180: '/api/v1/branding/logo/apple180?v=2',
  },
  version: 'v2',
}

const png = () => new File(['x'], 'l.png', { type: 'image/png' })

async function choose(w: ReturnType<typeof mount>, f: File) {
  const input = w.get('[data-testid="logo-input"]')
  Object.defineProperty(input.element, 'files', { value: [f], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('Brending tabi', () => {
  it('nomni validatsiya qiladi va saqlaydi', async () => {
    useBrandingStore().set(base)
    api.update.mockResolvedValue({ ...base, appName: 'Maktab Pro', shortName: 'MPro' })
    const w = mount(BrandingSettingsTab, { global: { plugins: [i18n] } })
    await w.get('[data-testid="branding-app-name"]').setValue('')
    await w.get('form').trigger('submit')
    expect(api.update).not.toHaveBeenCalled()
    expect(w.text()).toContain(uz.branding.errors.appName)

    await w.get('[data-testid="branding-app-name"]').setValue('Maktab Pro')
    await w.get('[data-testid="branding-short-name"]').setValue('MPro')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith({ appName: 'Maktab Pro', shortName: 'MPro' })
    expect(useBrandingStore().appName).toBe('Maktab Pro')
    expect(w.text()).toContain(uz.branding.note)
  })

  it('logo yuklash store ni yangilaydi va ikonka korinishini chiqaradi', async () => {
    useBrandingStore().set(base)
    api.uploadLogo.mockResolvedValue(withLogo)
    const w = mount(BrandingSettingsTab, { global: { plugins: [i18n] } })
    expect(w.find('[data-testid="branding-icon-preview"]').exists()).toBe(false)
    await choose(w, png())
    expect(api.uploadLogo).toHaveBeenCalled()
    expect(useBrandingStore().logoSrc).toContain('logo?v=2')
    expect(w.find('[data-testid="branding-icon-preview"]').exists()).toBe(true)
  })

  it('SVG rad etiladi', async () => {
    useBrandingStore().set(base)
    const w = mount(BrandingSettingsTab, { global: { plugins: [i18n] } })
    await choose(w, new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))
    expect(api.uploadLogo).not.toHaveBeenCalled()
    expect(w.get('[data-testid="logo-error"]').text()).toBe(uz.logo.errors.type)
  })
})

describe('Maktab logosi tabi (maktab admini)', () => {
  const school = {
    id: 's1',
    name: '1-maktab',
    slug: 'm1',
    address: null,
    phone: null,
    logoUrl: null,
    isActive: true,
    createdAt: '',
  }

  it('yuklaydi va logo korinadi', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'u', schoolId: 's1', role: 'school_admin' } as never
    schools.get.mockResolvedValue(school)
    schools.uploadLogo.mockResolvedValue({
      ...school,
      logoUrl: '/api/v1/branding/schools/s1/logo?v=h',
      hasUploadedLogo: true,
    })
    const w = mount(SchoolLogoTab, { global: { plugins: [i18n] } })
    await flushPromises()
    await choose(w, png())
    expect(schools.uploadLogo).toHaveBeenCalledWith('s1', expect.any(File))
    expect(w.get('[data-testid="logo-preview"]').attributes('src')).toContain('/schools/s1/logo')
    expect(w.find('[data-testid="logo-remove"]').exists()).toBe(true)
  })
})
