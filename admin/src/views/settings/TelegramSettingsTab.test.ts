import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import { settingsApi } from '@/api/settings.api'
import type { TelegramMessageSettings, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useSchoolContextStore } from '@/stores/school-context'
import { DEFAULT_TELEGRAM_FORM } from '@/utils/telegramForm'
import { visibleSettingsTabs } from '@/utils/settingsTabs'
import TelegramSettingsTab from './TelegramSettingsTab.vue'

vi.mock('@/api/settings.api', () => ({ settingsApi: { get: vi.fn(), save: vi.fn() } }))
const tg = vi.hoisted(() => ({ getConfig: vi.fn(), me: vi.fn() }))
vi.mock('@/api/telegram.api', () => ({ telegramApi: tg }))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const config = {
  configured: true,
  source: 'db',
  enabled: true,
  tokenLast4: 'abcd',
  botUsername: 'maktab_bot',
  botName: 'Maktab',
  status: 'running',
  lastError: null,
  updatedAt: null,
}

function setup(role: 'superadmin' | 'school_admin' | 'teacher') {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = { id: 'u1', role, permissions: ['attendance.settings'] } as unknown as User
  const ctx = useSchoolContextStore()
  ctx.schools = [{ id: 's1', name: 'Maktab 1', slug: 'm1', isActive: true }] as never
  ctx.loaded = true
  ctx.schoolId = 's1'
}

const respond = (
  global: TelegramMessageSettings,
  override: Partial<TelegramMessageSettings> | null,
) =>
  vi
    .mocked(settingsApi.get)
    .mockImplementation(async () => ({ effective: global, global, override }) as never)

const mountTab = async () => {
  const w = mount(TelegramSettingsTab, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}
const confirmYes = async () => {
  await flushPromises()
  useConfirm().settle(true)
  await flushPromises()
}
/** n-chi "maydonlar" bo'limidagi (global=0, maktab=1) "Saqlash" tugmasi */
const saveBtn = (w: ReturnType<typeof mount>, n: number) =>
  w
    .findAll('section.card')
    .filter((s) => s.find('[data-testid="telegram-fields"]').exists())
    [n].findAll('button')
    .filter((b) => b.text() === uz.common.save)[0]!

beforeEach(() => {
  vi.clearAllMocks()
  tg.getConfig.mockResolvedValue(config)
  tg.me.mockResolvedValue({ available: true, botUsername: 'maktab_bot', linked: false })
  respond(DEFAULT_TELEGRAM_FORM, null)
})

describe('Telegram tab korinishi (rollar)', () => {
  it('superadmin va attendance.settings li maktab admini koradi; boshqalar yoq', () => {
    expect(visibleSettingsTabs(true, () => false)).toContain('telegram')
    expect(visibleSettingsTabs(false, (p) => p === 'attendance.settings', true)).toContain(
      'telegram',
    )
    expect(visibleSettingsTabs(false, (p) => p === 'attendance.settings')).toContain('telegram')
    expect(visibleSettingsTabs(false, () => false, true)).not.toContain('telegram')
    expect(visibleSettingsTabs(false, () => false, false)).not.toContain('telegram')
  })
})

describe('TelegramSettingsTab: ulanish bolimi', () => {
  it('superadmin token bolimini koradi', async () => {
    setup('superadmin')
    const w = await mountTab()
    expect(w.find('[data-testid="telegram-connection"]').exists()).toBe(true)
    expect(w.find('[data-testid="telegram-token"]').exists()).toBe(true)
    expect(tg.me).not.toHaveBeenCalled()
  })

  it('maktab admini faqat oqiladigan holatni koradi (token yoq)', async () => {
    setup('school_admin')
    const w = await mountTab()
    expect(w.find('[data-testid="telegram-connection"]').exists()).toBe(false)
    expect(w.find('[data-testid="telegram-token"]').exists()).toBe(false)
    expect(tg.getConfig).not.toHaveBeenCalled()
    expect(w.get('[data-testid="telegram-readonly-status"]').text()).toContain('@maktab_bot')
  })

  it('bot mavjud bolmasa maktab adminida holat qatori yashirin', async () => {
    setup('school_admin')
    tg.me.mockResolvedValue({ available: false, botUsername: null, linked: false })
    const w = await mountTab()
    expect(w.find('[data-testid="telegram-readonly-status"]').exists()).toBe(false)
    expect(w.find('[data-testid="telegram-fields"]').exists()).toBe(true)
  })
})

describe('TelegramSettingsTab: xabarlar sozlamalari', () => {
  it('maktab admini: notify override tolik obyekt, schoolId siz yuboriladi', async () => {
    setup('school_admin')
    vi.mocked(settingsApi.save).mockResolvedValue({} as never)
    const w = await mountTab()
    expect(settingsApi.get).toHaveBeenCalledWith('telegram', undefined)
    expect(w.findAll('[data-testid="telegram-fields"]')).toHaveLength(1)

    // qatorlar: workdays(0), notify(1), ...
    await w.findAll('input[type="checkbox"]')[1]!.setValue(true)
    await w.get('[data-testid="notify-dailyReport"] button').trigger('click')
    await saveBtn(w, 0).trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledTimes(1)
    expect(vi.mocked(settingsApi.save).mock.calls[0]![1]).toEqual({
      scope: 'school',
      values: {
        notify: {
          morningSchedule: true,
          substitutions: true,
          timetableChanges: true,
          dailyReport: false,
          weeklyReport: true,
        },
      },
    })
  })

  it('maktab override qiymati korsatiladi, tiklash values:null yuboradi', async () => {
    setup('school_admin')
    respond(DEFAULT_TELEGRAM_FORM, { morningTime: '08:15', workdays: [1, 2, 3] })
    vi.mocked(settingsApi.save).mockResolvedValue({} as never)
    const w = await mountTab()
    expect((w.get('[data-testid="time-morningTime"]').element as HTMLInputElement).value).toBe(
      '08:15',
    )
    expect(w.findAll('[data-testid="workday"]')).toHaveLength(7)
    expect(w.text()).toContain(uz.settings.hasOverride)
    const reset = w.findAll('button').find((b) => b.text() === uz.settings.reset)!
    await reset.trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('telegram', { scope: 'school', values: null })
  })

  it('superadmin: global tolik obyekt, maktab uchun schoolId yuboriladi', async () => {
    setup('superadmin')
    vi.mocked(settingsApi.save).mockResolvedValue({
      effective: DEFAULT_TELEGRAM_FORM,
      global: DEFAULT_TELEGRAM_FORM,
      override: null,
    } as never)
    const w = await mountTab()
    expect(w.findAll('[data-testid="telegram-fields"]')).toHaveLength(2)
    await w
      .findAll('[data-testid="telegram-fields"]')[0]!
      .get('[data-testid="time-morningTime"]')
      .setValue('06:45')
    await saveBtn(w, 0).trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('telegram', {
      scope: 'global',
      values: { ...DEFAULT_TELEGRAM_FORM, morningTime: '06:45' },
    })

    vi.mocked(settingsApi.save).mockClear()
    await flushPromises() // global saqlangach maktab bolimi qayta yuklanadi
    const schoolFields = w.findAll('[data-testid="telegram-fields"]')[1]!
    // qatorlar: workdays(0), notify(1), morningTime(2)
    await schoolFields.findAll('input[type="checkbox"]')[2]!.setValue(true)
    await schoolFields.get('[data-testid="time-morningTime"]').setValue('09:00')
    await saveBtn(w, 1).trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('telegram', {
      scope: 'school',
      schoolId: 's1',
      values: { morningTime: '09:00' },
    })
  })

  it('notogri vaqt saqlashni toxtatadi', async () => {
    setup('superadmin')
    const w = await mountTab()
    const f = w.findAll('[data-testid="telegram-fields"]')[0]!
    await f.get('[data-testid="time-dailyReportTime"]').setValue('')
    expect(saveBtn(w, 0).attributes('disabled')).toBeDefined()
    expect(f.text()).toContain(uz.settingsTelegram.errors.time)
  })

  it('server VALIDATION_ERROR (values.morningTime) maydonga boglanadi', async () => {
    setup('school_admin')
    vi.mocked(settingsApi.save).mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'Tekshiruv xatosi', 400, [
        { path: 'values.morningTime', message: 'Server: vaqt notogri' },
      ]),
    )
    const w = await mountTab()
    await w.findAll('input[type="checkbox"]')[2]!.setValue(true)
    await w.get('[data-testid="time-morningTime"]').setValue('08:00')
    await saveBtn(w, 0).trigger('click')
    await confirmYes()
    expect(w.get('[data-testid="telegram-fields"]').text()).toContain('Server: vaqt notogri')
    // maydon ozgartirilganda xato yoqoladi
    await w.get('[data-testid="time-morningTime"]').setValue('08:05')
    expect(w.get('[data-testid="telegram-fields"]').text()).not.toContain('Server: vaqt')
  })
})
