import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { DEFAULT_PUBLIC } from '@/utils/publicForm'
import PublicFields from './PublicFields.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const mountIt = (over = {}) =>
  mount(PublicFields, {
    props: { modelValue: { ...DEFAULT_PUBLIC, ...over }, errors: {} },
    global: { plugins: [i18n] },
  })

describe('PublicFields: showPhotos', () => {
  it("standart o'chiq; yoqilmaganda ogohlantirish ko'rinmaydi", () => {
    expect(DEFAULT_PUBLIC.showPhotos).toBe(false)
    const w = mountIt()
    expect(w.text()).toContain("O'quvchi rasmlari")
    expect(w.find('[data-testid="photos-warning"]').exists()).toBe(false)
  })

  it('almashtirgich showPhotos ni yoqadi (boshqa maydonlar saqlanadi)', async () => {
    const w = mountIt()
    const row = w.findAll('[role="switch"]')
    // showPhotos - ketma-ketlikdagi oxirgi almashtirgich
    await row[row.length - 1]!.trigger('click')
    const emitted = w.emitted('update:modelValue')!.at(-1)![0] as typeof DEFAULT_PUBLIC
    expect(emitted.showPhotos).toBe(true)
    expect(emitted.showTrend).toBe(DEFAULT_PUBLIC.showTrend)
  })

  it("yoqilganda bolalar maxfiyligi haqida ogohlantirish ko'rinadi", () => {
    const w = mountIt({ showPhotos: true })
    const warn = w.get('[data-testid="photos-warning"]').text()
    expect(warn).toContain('ota-onalarning')
    expect(warn).toContain('roziligini')
  })
})
