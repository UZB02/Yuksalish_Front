import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import uz from '@/locales/uz.json'
import { SIDEBAR_COLLAPSED_KEY, useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'dashboard', component: { template: '<div />' } }],
  })
  const w = mount(AppSidebar, { global: { plugins: [pinia, i18n, router] } })
  return { w, ui: useUiStore() }
}

const TOGGLE = '[data-testid="sidebar-collapse-toggle"]'

describe('AppSidebar yig`ish', () => {
  beforeEach(() => localStorage.clear())

  it('standart holatda yoyilgan', () => {
    const { w } = setup()
    const btn = w.get(TOGGLE)
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(btn.attributes('aria-label')).toBe(uz.nav.collapse)
    expect(
      w
        .get('[data-testid="sidebar-brand-label"]')
        .element.parentElement!.classList.value.split(' '),
    ).not.toContain('lg:hidden')
  })

  it('bosilganda yig`iladi, saqlanadi, yorliq yashirinadi', async () => {
    const { w, ui } = setup()
    await w.get(TOGGLE).trigger('click')
    expect(ui.sidebarCollapsed).toBe(true)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1')
    expect(w.get(TOGGLE).attributes('aria-expanded')).toBe('false')
    expect(w.get(TOGGLE).attributes('aria-label')).toBe(uz.nav.expand)
    expect(
      w
        .get('[data-testid="sidebar-brand-label"]')
        .element.parentElement!.classList.value.split(' '),
    ).toContain('lg:hidden')
    await w.get(TOGGLE).trigger('click')
    expect(ui.sidebarCollapsed).toBe(false)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0')
  })

  it('saqlangan holat tiklanadi va havolalarda tooltip (title) bor', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    const { w, ui } = setup()
    expect(ui.sidebarCollapsed).toBe(true)
    const labels = w.findAll('[data-testid="nav-label"]')
    for (const l of labels) expect(l.classes()).toContain('lg:hidden')
    for (const a of w.findAll('nav a')) {
      expect(a.attributes('title')).toBeTruthy()
      expect(a.attributes('aria-label')).toBe(a.attributes('title'))
    }
  })
})
