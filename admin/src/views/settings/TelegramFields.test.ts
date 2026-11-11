import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { TelegramMessageSettings } from '@/api/types'
import {
  DEFAULT_TELEGRAM_FORM,
  toggleWorkday,
  validateTelegramSettings,
} from '@/utils/telegramForm'
import TelegramFields from './TelegramFields.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mountFields = (value: TelegramMessageSettings, errors = {}) =>
  mount(TelegramFields, { props: { modelValue: value, errors }, global: { plugins: [i18n] } })
const input = (w: ReturnType<typeof mountFields>, k: string) =>
  w.get(`[data-testid="time-${k}"]`).element as HTMLInputElement

describe('TelegramFields', () => {
  it('samarali qiymatlarni korsatadi (standart: avtomatik ish kunlari)', () => {
    const w = mountFields(DEFAULT_TELEGRAM_FORM)
    expect(input(w, 'morningTime').value).toBe('07:30')
    expect(input(w, 'dailyReportTime').value).toBe('16:00')
    expect(input(w, 'weeklyReportTime').value).toBe('17:00')
    expect(w.get('[data-testid="workdays-auto"]').attributes('aria-checked')).toBe('true')
    expect(w.findAll('[data-testid="workday"]')).toHaveLength(0)
    expect((w.get('[data-testid="weekly-day"]').element as HTMLSelectElement).value).toBe('auto')
    expect(w.get('[data-testid="notify-substitutions"] button').attributes('aria-checked')).toBe(
      'true',
    )
  })

  it('qolda rejimiga otganda 7 ta kun chipi chiqadi', async () => {
    const w = mountFields(DEFAULT_TELEGRAM_FORM)
    await w.get('[data-testid="workdays-manual"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ workdays: [1, 2, 3, 4, 5] })

    const m = mountFields({ ...DEFAULT_TELEGRAM_FORM, workdays: [1, 2, 3] })
    const chips = m.findAll('[data-testid="workday"]')
    expect(chips.map((c) => c.text())).toEqual(['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'])
    await chips[5].trigger('click')
    expect(m.emitted('update:modelValue')?.[0][0]).toMatchObject({ workdays: [1, 2, 3, 6] })
    await m.get('[data-testid="workdays-auto"]').trigger('click')
    expect(m.emitted('update:modelValue')?.[1][0]).toMatchObject({ workdays: null })
  })

  it('haftalik hisobot kunlari qolda ish kunlari bilan cheklanadi', () => {
    const w = mountFields({ ...DEFAULT_TELEGRAM_FORM, workdays: [1, 2, 3, 4, 5] })
    const opts = w.findAll('[data-testid="weekly-day"] option')
    expect(opts).toHaveLength(8)
    expect(opts[0].text()).toBe('Avtomatik (oxirgi ish kuni)')
    const disabled = opts.filter((o) => o.attributes('disabled') !== undefined).map((o) => o.text())
    expect(disabled).toEqual(['Shanba', 'Yakshanba'])
    const auto = mountFields(DEFAULT_TELEGRAM_FORM)
    const anyDisabled = auto
      .findAll('[data-testid="weekly-day"] option')
      .some((o) => o.attributes('disabled') !== undefined)
    expect(anyDisabled).toBe(false)
  })

  it('kun tanlansa raqam, avtomatik tanlansa null chiqadi', async () => {
    const w = mountFields(DEFAULT_TELEGRAM_FORM)
    await w.get('[data-testid="weekly-day"]').setValue('5')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ weeklyReportDay: 5 })
    const x = mountFields({ ...DEFAULT_TELEGRAM_FORM, weeklyReportDay: 5 })
    await x.get('[data-testid="weekly-day"]').setValue('auto')
    expect(x.emitted('update:modelValue')?.[0][0]).toMatchObject({ weeklyReportDay: null })
  })

  it('ochirilgan xabar turida vaqt maydoni bloklanadi', async () => {
    const w = mountFields({
      ...DEFAULT_TELEGRAM_FORM,
      notify: { ...DEFAULT_TELEGRAM_FORM.notify, morningSchedule: false, weeklyReport: false },
    })
    expect(input(w, 'morningTime').disabled).toBe(true)
    expect(input(w, 'weeklyReportTime').disabled).toBe(true)
    expect(input(w, 'dailyReportTime').disabled).toBe(false)
    await w.get('[data-testid="notify-dailyReport"] button').trigger('click')
    const out = w.emitted('update:modelValue')?.[0][0] as TelegramMessageSettings
    expect(out.notify).toEqual({
      morningSchedule: false,
      substitutions: true,
      timetableChanges: true,
      dailyReport: false,
      weeklyReport: false,
      ratingResults: true,
    })
  })

  it('vaqt va ism-familiya kaliti ozgaradi, xato matni korinadi', async () => {
    const w = mountFields(DEFAULT_TELEGRAM_FORM, { morningTime: 'Xato vaqt' })
    expect(w.text()).toContain('Xato vaqt')
    await w.get('[data-testid="time-dailyReportTime"]').setValue('15:45')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ dailyReportTime: '15:45' })
    await w.get('[data-testid="absent-names"] button').trigger('click')
    expect(w.emitted('update:modelValue')?.[1][0]).toMatchObject({ dailyReportAbsentNames: false })
  })

  it('validatsiya server qoidalariga mos', () => {
    const t = (k: string) => k
    const base = DEFAULT_TELEGRAM_FORM
    expect(validateTelegramSettings(base, t)).toEqual({})
    expect(validateTelegramSettings({ ...base, morningTime: '7:30' }, t)).toHaveProperty(
      'morningTime',
    )
    expect(validateTelegramSettings({ ...base, dailyReportTime: '24:00' }, t)).toHaveProperty(
      'dailyReportTime',
    )
    expect(validateTelegramSettings({ ...base, workdays: [] }, t)).toHaveProperty('workdays')
    expect(
      validateTelegramSettings({ ...base, workdays: [1, 2], weeklyReportDay: 5 }, t),
    ).toHaveProperty('weeklyReportDay')
    expect(validateTelegramSettings({ ...base, workdays: null, weeklyReportDay: 7 }, t)).toEqual(
      {},
    )
    expect(toggleWorkday([1, 3], 2)).toEqual([1, 2, 3])
    expect(toggleWorkday([1, 2, 3], 2)).toEqual([1, 3])
  })
})
