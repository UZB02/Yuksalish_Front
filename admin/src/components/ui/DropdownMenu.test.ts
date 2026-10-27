import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DropdownMenu from './DropdownMenu.vue'

const items = [
  { key: 'a', label: 'Birinchi' },
  { key: 'b', label: 'Ikkinchi' },
  { key: 'c', label: 'Xavfli', danger: true, separator: true },
]

let wrapper: ReturnType<typeof mountMenu> | null = null
function mountMenu() {
  return mount(DropdownMenu, {
    props: { items, label: 'Boshqa amallar' },
    attachTo: document.body,
  })
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})
const panel = () => document.body.querySelector('[data-testid="menu-panel"]')
const menuItems = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const key = (el: Element, k: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('DropdownMenu', () => {
  it('tugma aria atributlari bilan ochiladi va menyu body ga teleport qilinadi', async () => {
    wrapper = mountMenu()
    const btn = wrapper.get('button')
    expect(btn.attributes('aria-haspopup')).toBe('menu')
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()

    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(panel()?.getAttribute('role')).toBe('menu')
    expect(menuItems()).toHaveLength(3)
    expect(wrapper.element.contains(panel())).toBe(false)
  })

  it('element tanlansa select chiqadi va menyu yopiladi', async () => {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    menuItems()[1]!.click()
    await tick()
    expect(wrapper.emitted('select')).toEqual([['b']])
    expect(panel()).toBeNull()
  })

  it('klaviatura: strelkalar/Home/End fokusni siljitadi, Escape yopadi va fokusni qaytaradi', async () => {
    wrapper = mountMenu()
    const btn = wrapper.get('button')
    await btn.trigger('keydown', { key: 'ArrowDown' })
    await tick()
    const els = menuItems()
    expect(document.activeElement).toBe(els[0])

    key(els[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(els[1])
    key(els[1]!, 'End')
    expect(document.activeElement).toBe(els[2])
    key(els[2]!, 'ArrowDown')
    expect(document.activeElement).toBe(els[0])
    key(els[0]!, 'ArrowUp')
    expect(document.activeElement).toBe(els[2])

    key(document.body, 'Escape')
    await tick()
    expect(panel()).toBeNull()
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(btn.element)
  })

  it('tashqariga bosilganda yopiladi', async () => {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    expect(panel()).not.toBeNull()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await tick()
    expect(panel()).toBeNull()
  })

  it('xavfli element qizil rangda', async () => {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    expect(menuItems()[2]!.className).toContain('text-danger')
  })
})
