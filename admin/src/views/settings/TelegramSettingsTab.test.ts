import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type { TelegramConfig } from '@/api/types'
import { visibleSettingsTabs } from '@/utils/settingsTabs'
import TelegramSettingsTab from './TelegramSettingsTab.vue'

const api = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
}))
vi.mock('@/api/telegram.api', () => ({ telegramApi: api }))
const confirmFn = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: confirmFn }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const empty: TelegramConfig = {
  configured: false,
  source: null,
  enabled: false,
  tokenLast4: null,
  botUsername: null,
  botName: null,
  status: 'stopped',
  lastError: null,
  updatedAt: null,
}
const running: TelegramConfig = {
  ...empty,
  configured: true,
  source: 'db',
  enabled: true,
  tokenLast4: 'x9Zq',
  botUsername: 'yuksalish_bot',
  botName: 'Yuksalish',
  status: 'running',
}

async function mountTab(cfg: TelegramConfig) {
  api.getConfig.mockResolvedValue(cfg)
  const w = mount(TelegramSettingsTab, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})

describe('Telegram bot tabi', () => {
  it('faqat superadmin tabni koradi', () => {
    expect(visibleSettingsTabs(true, () => false)).toContain('telegram')
    expect(visibleSettingsTabs(false, () => true)).not.toContain('telegram')
    expect(visibleSettingsTabs(false, () => true, true)).not.toContain('telegram')
  })

  it('holat, bot havolasi va token placeholder korsatiladi', async () => {
    const w = await mountTab(running)
    expect(w.get('[data-testid="telegram-status-badge"]').text()).toBe(uz.telegram.settings.running)
    expect(w.get('[data-testid="telegram-bot-link"]').attributes('href')).toBe(
      'https://t.me/yuksalish_bot',
    )
    expect(w.get('input').attributes('placeholder')).toBe('••••••x9Zq')
    expect((w.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('xato holati va env manbasi', async () => {
    const w = await mountTab({
      ...running,
      source: 'env',
      status: 'error',
      lastError: 'Unauthorized',
    })
    expect(w.get('[data-testid="telegram-last-error"]').text()).toBe('Unauthorized')
    expect(w.get('[data-testid="telegram-env"]').text()).toBe(uz.telegram.settings.sourceEnv)
    expect(w.find('[data-testid="telegram-delete"]').exists()).toBe(false)
  })

  it('tokenni saqlaydi va muvaffaqiyat xabarini chiqaradi', async () => {
    const w = await mountTab(empty)
    api.updateConfig.mockResolvedValue(running)
    await w.get('input').setValue(' 123:ABC ')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateConfig).toHaveBeenCalledWith({ token: '123:ABC' })
    expect(toast.success).toHaveBeenCalledWith('✓ @yuksalish_bot ulandi')
    expect((w.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('bosh tokenni yubormaydi', async () => {
    const w = await mountTab(empty)
    await w.get('form').trigger('submit')
    expect(api.updateConfig).not.toHaveBeenCalled()
    expect(w.text()).toContain(uz.telegram.settings.tokenRequired)
  })

  it('422 xatosi maydonda korinadi', async () => {
    const w = await mountTab(empty)
    api.updateConfig.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'x', 422, [{ path: 'token', message: 'Token yaroqsiz' }]),
    )
    await w.get('input').setValue('bad')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Token yaroqsiz')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('yoqish/ochirish kaliti enabled yuboradi', async () => {
    const w = await mountTab(running)
    api.updateConfig.mockResolvedValue({ ...running, enabled: false, status: 'stopped' })
    await w.get('[role="switch"]').trigger('click')
    await flushPromises()
    expect(api.updateConfig).toHaveBeenCalledWith({ enabled: false })
    expect(w.get('[data-testid="telegram-status-badge"]').text()).toBe(uz.telegram.settings.stopped)
  })

  it('tokenni ochirish tasdiqlanadi', async () => {
    const w = await mountTab(running)
    confirmFn.mockResolvedValueOnce(false)
    await w.get('[data-testid="telegram-delete"]').trigger('click')
    await flushPromises()
    expect(api.deleteConfig).not.toHaveBeenCalled()

    confirmFn.mockResolvedValueOnce(true)
    api.deleteConfig.mockResolvedValue(empty)
    await w.get('[data-testid="telegram-delete"]').trigger('click')
    await flushPromises()
    expect(confirmFn).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }))
    expect(api.deleteConfig).toHaveBeenCalledTimes(1)
    expect(w.get('[data-testid="telegram-status-badge"]').text()).toBe(
      uz.telegram.settings.notConfigured,
    )
  })

  it('qollanma korinadi', async () => {
    const w = await mountTab(empty)
    expect(w.get('[data-testid="telegram-guide"]').text()).toContain('@BotFather')
    expect(w.findAll('[data-testid="telegram-guide"] li')).toHaveLength(6)
  })
})
