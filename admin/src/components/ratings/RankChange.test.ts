import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import RankChange from './RankChange.vue'

const mountChange = (change: number | null) =>
  mount(RankChange, {
    props: { change },
    global: { plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })] },
  })

describe('RankChange', () => {
  it('musbat: yuqoriga, yashil, miqdor bilan', () => {
    const w = mountChange(3)
    expect(w.attributes('data-kind')).toBe('up')
    expect(w.classes()).toContain('text-success')
    expect(w.text()).toBe('3')
    expect(w.attributes('aria-label')).toContain('3')
  })
  it('manfiy: pastga, qizil, modul bilan', () => {
    const w = mountChange(-2)
    expect(w.attributes('data-kind')).toBe('down')
    expect(w.classes()).toContain('text-danger')
    expect(w.text()).toBe('2')
  })
  it("nol va null: o'zgarishsiz belgi", () => {
    for (const v of [0, null]) {
      const w = mountChange(v)
      expect(w.classes()).toContain('text-fg-muted')
      expect(w.text()).toBe('')
    }
    expect(mountChange(0).attributes('data-kind')).toBe('same')
    expect(mountChange(null).attributes('data-kind')).toBe('none')
  })
})
