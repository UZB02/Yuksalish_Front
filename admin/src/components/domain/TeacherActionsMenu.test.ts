import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { Teacher } from '@/api/types'
import TeacherActionsMenu from './TeacherActionsMenu.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const teacher = { id: 't1', fullName: 'Aliyev Vali', username: 'a', isActive: true } as Teacher

let w: ReturnType<typeof mountIt> | null = null
function mountIt(t: Teacher) {
  return mount(TeacherActionsMenu, {
    props: { teacher: t },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}
afterEach(() => {
  w?.unmount()
  w = null
})
const item = (k: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="menu-item-${k}"]`)!

describe('TeacherActionsMenu', () => {
  it('tugma o`qituvchi ismi bilan nomlanadi, menyuda 4 ta amal bor', async () => {
    w = mountIt(teacher)
    const btn = w.get('button')
    expect(btn.attributes('aria-label')).toBe('Boshqa amallar: Aliyev Vali')
    await btn.trigger('click')
    expect(item('classes').textContent).toContain('Sinflarni biriktirish')
    expect(item('permissions').textContent).toContain('Ruxsatlar')
    expect(item('reset').textContent).toContain('Parolni tiklash')
    expect(item('toggle').textContent).toContain('Nofaol qilish')
    expect(item('toggle').className).toContain('text-danger')
  })

  it.each(['classes', 'permissions', 'reset', 'toggle'])(
    '%s tanlansa mos hodisa o`qituvchi bilan chiqadi',
    async (key) => {
      w = mountIt(teacher)
      await w.get('button').trigger('click')
      item(key).click()
      expect(w.emitted(key)).toEqual([[teacher]])
    },
  )

  it('canDelete=true: "Butunlay o`chirish" (xavfli) bor va delete hodisasini beradi', async () => {
    w = mount(TeacherActionsMenu, {
      props: { teacher, canDelete: true },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await w.get('button').trigger('click')
    expect(item('delete').textContent).toContain("Butunlay o'chirish")
    expect(item('delete').className).toContain('text-danger')
    item('delete').click()
    expect(w.emitted('delete')).toEqual([[teacher]])
  })

  it('canDelete berilmasa "Butunlay o`chirish" ko`rinmaydi (ruxsatsiz)', async () => {
    w = mountIt(teacher)
    await w.get('button').trigger('click')
    expect(item('delete')).toBeNull()
  })

  it('nofaol o`qituvchi: Faollashtirish, xavfli emas', async () => {
    w = mountIt({ ...teacher, isActive: false })
    await w.get('button').trigger('click')
    expect(item('toggle').textContent).toContain('Faollashtirish')
    expect(item('toggle').className).not.toContain('text-danger')
  })
})
