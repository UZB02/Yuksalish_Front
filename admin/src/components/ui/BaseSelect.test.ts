import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { normalizeSearch } from '@/utils/searchText'
import BaseSelect from './BaseSelect.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const many = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Variant ${i}` }))
const uzbek = [
  { value: 'a', label: 'Oʻzbek tili' },
  { value: 'b', label: 'Matematika' },
  { value: 'c', label: "O'qish" },
  { value: 'd', label: 'Fizika', disabled: true },
  { value: 'e', label: 'Kimyo' },
]

let wrapper: VueWrapper | undefined
function make(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  wrapper = mount(BaseSelect, {
    props: props as never,
    attrs,
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  return wrapper
}
const panel = () => document.body.querySelector('[data-testid="select-panel"]')
const input = () =>
  document.body.querySelector<HTMLInputElement>('[data-testid="select-panel"] input')!
const optionLabels = () =>
  Array.from(document.body.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim())
async function type(text: string) {
  input().value = text
  input().dispatchEvent(new Event('input'))
  await wrapper!.vm.$nextTick()
}
async function key(k: string) {
  input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  await wrapper!.vm.$nextTick()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('normalizeSearch', () => {
  it('apostrof variantlari va registrni tenglashtiradi', () => {
    for (const v of ["o'", 'o‘', 'o’', 'oʻ', 'oʼ', 'o`']) {
      expect(normalizeSearch(`  ${v.toUpperCase()} `)).toBe("o'")
    }
    expect(normalizeSearch('Café')).toBe('cafe')
  })
})

describe('BaseSelect', () => {
  it("variantlar kam bo'lsa native select", () => {
    const w = make({ modelValue: '', options: many.slice(0, 8) })
    expect(w.find('select').exists()).toBe(true)
    expect(w.find('[role="combobox"]').exists()).toBe(false)
  })

  it('variantlar chegaradan oshsa combobox; searchable va searchThreshold boshqaradi', () => {
    expect(make({ modelValue: '', options: many }).find('[role="combobox"]').exists()).toBe(true)
    wrapper!.unmount()
    expect(make({ options: many, searchable: false }).find('select').exists()).toBe(true)
    wrapper!.unmount()
    expect(
      make({ options: many.slice(0, 3), searchable: true })
        .find('select')
        .exists(),
    ).toBe(false)
    wrapper!.unmount()
    expect(make({ options: many, searchThreshold: 20 }).find('select').exists()).toBe(true)
  })

  it("trigger tanlangan yorliqni ko'rsatadi, bosilganda panel ochiladi", async () => {
    const w = make({ modelValue: 'v3', options: many, label: 'Tanlov' })
    const trigger = w.get('[role="combobox"]')
    expect(trigger.text()).toBe('Variant 3')
    expect(w.get('label').attributes('for')).toBe(trigger.attributes('id'))
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(panel()).not.toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const selected = document.body.querySelector('[role="option"][aria-selected="true"]')
    expect(selected?.textContent?.trim()).toBe('Variant 3')
  })

  it("qidiruv: substring, registr va apostrofga befarq; bo'sh natija xabari", async () => {
    const w = make({ modelValue: '', options: uzbek, searchable: true })
    await w.get('[role="combobox"]').trigger('click')
    await type("o'")
    expect(optionLabels()).toEqual(['Oʻzbek tili', "O'qish"])
    await type('  MATEM ')
    expect(optionLabels()).toEqual(['Matematika'])
    await type('xyz')
    expect(optionLabels()).toEqual([])
    expect(panel()!.textContent).toContain('Hech narsa topilmadi')
  })

  it("klaviatura: o'qlar nofaolni o'tkazib yuboradi, Enter tanlaydi", async () => {
    const w = make({ modelValue: 'c', options: uzbek, searchable: true })
    await w.get('[role="combobox"]').trigger('click')
    // Fizika (d) nofaol: c dan keyingi ArrowDown -> e
    await key('ArrowDown')
    await key('Enter')
    expect(w.emitted('update:modelValue')![0]).toEqual(['e'])
    expect(panel()).toBeNull()
  })

  it('Home/End; Escape yopadi va fokusni qaytaradi', async () => {
    const w = make({ modelValue: '', options: uzbek, searchable: true })
    const trigger = w.get('[role="combobox"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(panel()).not.toBeNull()
    await key('End')
    await key('Enter')
    expect(w.emitted('update:modelValue')![0]).toEqual(['e'])
    await trigger.trigger('keydown', { key: ' ' })
    await key('Escape')
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    expect(w.emitted('update:modelValue')).toHaveLength(1)
  })

  it('harf bosilsa panel shu matn bilan ochiladi', async () => {
    const w = make({ modelValue: '', options: uzbek, searchable: true })
    await w.get('[role="combobox"]').trigger('keydown', { key: 'y' })
    expect(input().value).toBe('y')
    expect(optionLabels()).toEqual(['Kimyo'])
  })

  it("bo'sh variant (placeholder) tanlanadi", async () => {
    const w = make({
      modelValue: 'a',
      options: uzbek,
      placeholder: 'Tayinlanmagan',
      searchable: true,
    })
    await w.get('[role="combobox"]').trigger('click')
    expect(optionLabels()[0]).toBe('Tayinlanmagan')
    ;(document.body.querySelectorAll('[role="option"]')[0] as HTMLElement).click()
    expect(w.emitted('update:modelValue')![0]).toEqual([''])
  })

  it('disabled bo`lsa ochilmaydi; nofaol variant bosilmaydi', async () => {
    const w = make({ modelValue: '', options: uzbek, searchable: true, disabled: true })
    await w.get('[role="combobox"]').trigger('click')
    expect(panel()).toBeNull()
    await w.setProps({ disabled: false })
    await w.get('[role="combobox"]').trigger('click')
    ;(document.body.querySelectorAll('[role="option"]')[3] as HTMLElement).click()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('yopilganda onBlur uzatiladi (vee-validate), ochilish paytida emas', async () => {
    const onBlur = vi.fn()
    const w = make({ modelValue: '', options: uzbek, searchable: true }, { onBlur, name: 'grade' })
    const trigger = w.get('[role="combobox"]')
    expect(trigger.attributes('name')).toBe('grade')
    await trigger.trigger('click')
    await trigger.trigger('blur')
    expect(onBlur).not.toHaveBeenCalled()
    await key('Escape')
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('tashqariga bosilganda yopiladi', async () => {
    const onBlur = vi.fn()
    const w = make({ modelValue: '', options: uzbek, searchable: true }, { onBlur })
    await w.get('[role="combobox"]').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(panel()).toBeNull()
    expect(onBlur).toHaveBeenCalled()
  })
})
