import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import StickySaveBar from './StickySaveBar.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const base = {
  showDiscard: true,
  saving: false,
  canSave: true,
  count: 4,
  saveLabel: "Saqlash (4 ta o'zgarish)",
}

describe('StickySaveBar', () => {
  it('mobilda qisqa, katta ekranda to`liq yozuv; tugmalar qatorga bo`linmaydi', () => {
    const w = mount(StickySaveBar, {
      props: { ...base, message: "Saqlanmagan o'zgarishlar bor" },
      global: { plugins: [i18n] },
    })
    const [discard, save] = w.findAll('button')
    expect(discard!.text()).toBe('Bekor qilish')
    expect(discard!.classes()).toContain('whitespace-nowrap')
    expect(save!.classes()).toContain('whitespace-nowrap')
    expect(save!.find('.sm\\:hidden').text()).toBe('Saqlash (4)')
    expect(save!.find('.hidden.sm\\:inline').text()).toBe("Saqlash (4 ta o'zgarish)")
    expect(w.get('[data-testid="save-bar-message"]').text()).toBe("Saqlanmagan o'zgarishlar bor")
  })

  it('xabar bo`sh bo`lsa ko`rsatilmaydi; discard yashirin; hodisalar chiqadi', async () => {
    const w = mount(StickySaveBar, {
      props: { ...base, message: '', showDiscard: false },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-testid="save-bar-message"]').exists()).toBe(false)
    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(1)
    await buttons[0]!.trigger('click')
    expect(w.emitted('save')).toHaveLength(1)
  })

  it('xato holatida xabar qizil', () => {
    const w = mount(StickySaveBar, {
      props: { ...base, message: '2 ta qatorda xato', danger: true },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-testid="save-bar-message"]').classes()).toContain('text-danger')
  })
})
