import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import uz from '@/locales/uz.json'
import type { TelegramMe } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import TelegramCard from './TelegramCard.vue'

const api = vi.hoisted(() => ({ me: vi.fn(), createLink: vi.fn(), unlink: vi.fn() }))
vi.mock('@/api/telegram.api', () => ({ telegramApi: api }))
vi.mock('qrcode', () => ({
  default: { toString: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>') },
}))
const confirmFn = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: confirmFn }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/settings', name: 'settings', component: { template: '<div/>' } },
  ],
})

const notLinked: TelegramMe = {
  available: true,
  botUsername: 'b_bot',
  linked: false,
  username: null,
  linkedAt: null,
}
const linked: TelegramMe = {
  ...notLinked,
  linked: true,
  username: 'ali',
  linkedAt: '2026-11-01T10:30:00.000Z',
}

async function mountCard(me: TelegramMe, role: string = 'teacher') {
  api.me.mockResolvedValue(me)
  useAuthStore().user = { id: 'u', role } as never
  const w = mount(TelegramCard, { global: { plugins: [i18n, router] }, attachTo: document.body })
  await flushPromises()
  return w
}

const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Profil: Telegram kartasi', () => {
  it('bot sozlanmagan: oddiy foydalanuvchiga havolasiz eslatma', async () => {
    const w = await mountCard({ ...notLinked, available: false })
    expect(w.get('[data-testid="telegram-na"]').text()).toContain(uz.telegram.card.unavailable)
    expect(w.find('[data-testid="telegram-settings-link"]').exists()).toBe(false)
  })

  it('bot sozlanmagan: superadminga sozlamalarga havola', async () => {
    const w = await mountCard({ ...notLinked, available: false }, 'superadmin')
    expect(w.get('[data-testid="telegram-settings-link"]').attributes('href')).toBe(
      '/settings?tab=telegram',
    )
  })

  it('ulangan holat va uzish (tasdiq bilan)', async () => {
    const w = await mountCard(linked)
    expect(w.get('[data-testid="telegram-linked"]').text()).toContain('@ali')
    confirmFn.mockResolvedValueOnce(false)
    await w.get('[data-testid="telegram-unlink"]').trigger('click')
    await flushPromises()
    expect(api.unlink).not.toHaveBeenCalled()

    confirmFn.mockResolvedValueOnce(true)
    api.unlink.mockResolvedValue(notLinked)
    await w.get('[data-testid="telegram-unlink"]').trigger('click')
    await flushPromises()
    expect(api.unlink).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="telegram-link"]').exists()).toBe(true)
  })

  it('ulash oynasi: havola, QR, sanoq va polling ulanganda yopiladi', async () => {
    const w = await mountCard(notLinked)
    vi.useFakeTimers()
    const exp = new Date(Date.now() + 10 * 60_000).toISOString()
    api.createLink.mockResolvedValue({ url: 'https://t.me/b_bot?start=abc', expiresAt: exp })
    await w.get('[data-testid="telegram-link"]').trigger('click')
    await flushPromises()

    expect(q('telegram-open')?.getAttribute('href')).toBe('https://t.me/b_bot?start=abc')
    expect(q('telegram-qr')).not.toBeNull()
    expect(q('telegram-countdown')?.textContent).toContain('10:00')

    api.me.mockResolvedValue(notLinked)
    api.me.mockClear()
    await vi.advanceTimersByTimeAsync(3000)
    expect(api.me).toHaveBeenCalledTimes(1)
    expect(q('telegram-link-modal')).not.toBeNull()

    api.me.mockResolvedValue(linked)
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(toast.success).toHaveBeenCalledWith(uz.telegram.card.linkedToast)
    expect(q('telegram-link-modal')).toBeNull()
    expect(w.find('[data-testid="telegram-linked"]').exists()).toBe(true)
  })

  it('muddat tugasa "Yangi havola" chiqadi', async () => {
    const w = await mountCard(notLinked)
    vi.useFakeTimers()
    api.createLink.mockResolvedValueOnce({
      url: 'https://t.me/b_bot?start=1',
      expiresAt: new Date(Date.now() + 5000).toISOString(),
    })
    await w.get('[data-testid="telegram-link"]').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(6000)
    expect(q('telegram-expired')).not.toBeNull()

    api.createLink.mockResolvedValueOnce({
      url: 'https://t.me/b_bot?start=2',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    })
    q('telegram-renew')?.click()
    await flushPromises()
    expect(api.createLink).toHaveBeenCalledTimes(2)
    expect(q('telegram-expired')).toBeNull()
    w.unmount()
  })
})
