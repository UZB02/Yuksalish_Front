import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { TimetableAttendanceSettings } from '@/api/types'
import { DEFAULT_TIMETABLE_FORM, validateTimetableSettings } from '@/utils/timetableForm'
import { formatSetting } from '@/utils/settingsFormat'
import TimetableFields from './TimetableFields.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mountFields = (value: TimetableAttendanceSettings) =>
  mount(TimetableFields, {
    props: { modelValue: value, errors: {} },
    global: { plugins: [i18n] },
  })

describe('Dars jadvali sozlamalari', () => {
  it('standart qiymatlar: Tavsiya, sinf rahbari yoqilgan; jadvalsiz sinf maydoni yashirin', () => {
    expect(DEFAULT_TIMETABLE_FORM).toEqual({
      enforcement: 'suggest',
      homeroomCanTakeAnyLesson: true,
      strictNoTimetable: 'manual',
    })
    const w = mountFields(DEFAULT_TIMETABLE_FORM)
    const options = w.findAll('[data-testid="enforcement-option"]')
    expect(options.map((o) => o.text())).toEqual(["O'chiq", 'Tavsiya', "Qat'iy"])
    expect(options[1].attributes('aria-checked')).toBe('true')
    expect(w.find('[data-testid="enforcement-help"]').text()).toContain('fan avtomatik')
    expect(w.find('[data-testid="no-timetable-option"]').exists()).toBe(false)
    expect(w.text()).toContain('Sinf rahbari istalgan darsga davomat oladi')
  })

  it('rejim tanlash va strict da qo`shimcha maydon', async () => {
    const w = mountFields(DEFAULT_TIMETABLE_FORM)
    await w.findAll('[data-testid="enforcement-option"]')[2].trigger('click')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ enforcement: 'strict' })

    const strict = mountFields({ ...DEFAULT_TIMETABLE_FORM, enforcement: 'strict' })
    const no = strict.findAll('[data-testid="no-timetable-option"]')
    expect(no).toHaveLength(2)
    await no[1].trigger('click')
    expect(strict.emitted('update:modelValue')?.[0][0]).toMatchObject({
      strictNoTimetable: 'block',
    })
  })

  it('sinf rahbari kaliti o`zgaradi, validatsiya va format', async () => {
    const w = mountFields(DEFAULT_TIMETABLE_FORM)
    await w.find('[data-testid="homeroom-switch"] button').trigger('click')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({
      homeroomCanTakeAnyLesson: false,
    })
    const t = (k: string) => k
    expect(validateTimetableSettings(DEFAULT_TIMETABLE_FORM, t)).toEqual({})
    expect(
      validateTimetableSettings({ ...DEFAULT_TIMETABLE_FORM, enforcement: 'x' as never }, t)
        .enforcement,
    ).toBeTruthy()
    const tr = (k: string, p?: Record<string, unknown>) => i18n.global.t(k, p ?? {})
    expect(formatSetting(tr, 'enforcement', 'strict')).toBe("Qat'iy")
    expect(formatSetting(tr, 'strictNoTimetable', 'block')).toBe('Bloklanadi')
    expect(formatSetting(tr, 'homeroomCanTakeAnyLesson', true)).toBe('Ha')
  })
})
