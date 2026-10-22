import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { __resetBodyLock } from '@/composables/useBodyLock'
import BaseModal from './BaseModal.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mountModal = (props: { open: boolean; layer?: 'default' | 'top'; title?: string }) =>
  mount(BaseModal, {
    props: { title: 'Sarlavha', ...props },
    slots: { default: '<p>Matn</p>' },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

afterEach(() => {
  document.body.innerHTML = ''
  __resetBodyLock()
})

describe('BaseModal qatlami va scroll bloki', () => {
  it('layer="top" boshqa modallar ustida (z-[60]), oddiy modal z-50', () => {
    const base = mountModal({ open: true })
    const top = mountModal({ open: true, layer: 'top', title: 'Tasdiq' })
    const overlays = Array.from(document.body.querySelectorAll<HTMLElement>('.fixed.inset-0'))
    expect(overlays.some((el) => el.classList.contains('z-50'))).toBe(true)
    expect(overlays.some((el) => el.classList.contains('z-[60]'))).toBe(true)
    base.unmount()
    top.unmount()
  })

  it('ichki modal yopilganda tashqi modal ochiq bo`lsa scroll qaytmaydi', async () => {
    const outer = mountModal({ open: true })
    const inner = mountModal({ open: true, layer: 'top' })
    expect(document.body.style.overflow).toBe('hidden')
    await inner.setProps({ open: false })
    expect(document.body.style.overflow).toBe('hidden')
    await outer.setProps({ open: false })
    expect(document.body.style.overflow).toBe('')
    outer.unmount()
    inner.unmount()
  })
})
