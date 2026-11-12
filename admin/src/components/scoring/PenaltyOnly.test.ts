import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import PenaltyBadge from './PenaltyBadge.vue'
import ScoreSlider from './ScoreSlider.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mountSlider = (modelValue: string, penalty?: number) =>
  mount(ScoreSlider, {
    props: { modelValue, min: 0, max: 100, quick: [100, 90], penalty },
    global: { plugins: [i18n] },
  })
const box = (w: ReturnType<typeof mountSlider>) => w.get('input[type="number"]')

describe('ScoreSlider: faqat jarima qaydi ko`rsatkichi', () => {
  it('ball bo\'sh va jarima > 0: "−20" (tahrirlanmaydigan placeholder), qiymat bo\'sh', () => {
    const b = box(mountSlider('', 20))
    expect(b.attributes('placeholder')).toBe('−20')
    expect(b.attributes('data-penalty-only')).toBe('true')
    expect((b.element as HTMLInputElement).value).toBe('')
    expect(b.classes().join(' ')).toContain('placeholder:text-danger')
  })

  it("ball yozilgan, jarima yo'q yoki 0: oddiy ko'rinish", () => {
    const typed = box(mountSlider('70', 20))
    expect(typed.attributes('placeholder')).toBe('-')
    expect(typed.attributes('data-penalty-only')).toBeUndefined()
    expect(box(mountSlider('', 0)).attributes('placeholder')).toBe('-')
    expect(box(mountSlider('')).attributes('placeholder')).toBe('-')
  })

  it('son yozilganda qiymat yuboriladi, tozalansa bo`sh qiymat (jarima qaytadi)', async () => {
    const w = mountSlider('', 20)
    await box(w).setValue('85')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['85'])
    await w.setProps({ modelValue: '85' })
    expect(box(w).attributes('placeholder')).toBe('-')
    await box(w).setValue('')
    expect(w.emitted('update:modelValue')?.[1]).toEqual([''])
    await w.setProps({ modelValue: '' })
    expect(box(w).attributes('placeholder')).toBe('−20')
  })
})

describe('PenaltyBadge', () => {
  it('jarimani "−N" belgisi sifatida ko`rsatadi; jarima bo`lmasa tire', () => {
    const w = mount(PenaltyBadge, { props: { penalty: 20 }, global: { plugins: [i18n] } })
    expect(w.get('[data-testid="penalty-badge"]').text()).toBe('−20')
    const none = mount(PenaltyBadge, { props: {}, global: { plugins: [i18n] } })
    expect(none.find('[data-testid="penalty-badge"]').exists()).toBe(false)
    expect(none.text()).toBe('-')
  })
})
