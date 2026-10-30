import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Branding } from '@/api/types'
import { BRANDING_CACHE_KEY, useBrandingStore } from './branding'

const get = vi.fn()
vi.mock('@/api/branding.api', () => ({ brandingApi: { get: () => get() } }))

const WITH_LOGO: Branding = {
  appName: 'Maktab Pro',
  shortName: 'MPro',
  logoUrl: '/api/v1/branding/logo/logo?v=1',
  icons: {
    favicon: '/api/v1/branding/logo/favicon?v=1',
    icon192: '/api/v1/branding/logo/icon192?v=1',
    icon512: '/api/v1/branding/logo/icon512?v=1',
    maskable512: '/api/v1/branding/logo/maskable512?v=1',
    apple180: '/api/v1/branding/logo/apple180?v=1',
  },
  version: '1',
}

function setupHead() {
  document.head.innerHTML = `
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />`
}

beforeEach(() => {
  setupHead()
  localStorage.clear()
  get.mockReset()
  document.title = ''
  setActivePinia(createPinia())
})

describe('branding store', () => {
  it('standart: i18n nomi, logo yoq, favicon ozgarmaydi', () => {
    const b = useBrandingStore()
    expect(b.appName).toBe('Intizom reytingi')
    expect(b.logoSrc).toBeNull()
    b.applyDocument()
    expect(document.querySelector('link[rel="icon"]')!.getAttribute('href')).toBe('/favicon.ico')
  })

  it('init: server qiymatini qollaydi, keshga yozadi, favicon va apple-touch-icon almashadi', async () => {
    get.mockResolvedValue(WITH_LOGO)
    const b = useBrandingStore()
    b.setPageTitle('Sinflar')
    await b.init()
    expect(b.appName).toBe('Maktab Pro')
    expect(b.logoSrc).toContain('/branding/logo/logo?v=1')
    expect(document.title).toBe('Sinflar · Maktab Pro')
    expect(document.querySelector('link[rel="icon"]')!.getAttribute('href')).toContain('favicon')
    expect(document.querySelector('link[rel="apple-touch-icon"]')!.getAttribute('href')).toContain(
      'apple180',
    )
    expect(JSON.parse(localStorage.getItem(BRANDING_CACHE_KEY)!).appName).toBe('Maktab Pro')
  })

  it('kesh birinchi chizish uchun ishlatiladi; server xatosida kesh qoladi', async () => {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(WITH_LOGO))
    get.mockRejectedValue(new Error('offline'))
    setActivePinia(createPinia())
    const b = useBrandingStore()
    expect(b.appName).toBe('Maktab Pro')
    await b.init()
    expect(b.appName).toBe('Maktab Pro')
    expect(document.title).toBe('Maktab Pro')
  })

  it('logo ochirilsa asl ikonkalar tiklanadi', () => {
    const b = useBrandingStore()
    b.set(WITH_LOGO)
    b.set({ ...WITH_LOGO, logoUrl: null, icons: null })
    expect(document.querySelector('link[rel="icon"]')!.getAttribute('href')).toBe('/favicon.ico')
    expect(document.querySelector('link[rel="apple-touch-icon"]')!.getAttribute('href')).toBe(
      '/apple-touch-icon-180x180.png',
    )
  })
})
