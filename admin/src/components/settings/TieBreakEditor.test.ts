import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { TieBreakKey } from '@/api/types'
import TieBreakEditor from './TieBreakEditor.vue'

const mountEditor = (modelValue: TieBreakKey[], disabled = false) =>
  mount(TieBreakEditor, {
    props: { modelValue, disabled },
    global: { plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })] },
  })

describe('TieBreakEditor', () => {
  it('alifbo tartibi har doim oxirida, qulflangan va tugmasiz', () => {
    const w = mountEditor(['alphabetical', 'daysCount', 'scoresCount'])
    const items = w.findAll('[data-testid="tie-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Baholangan kunlar soni')
    expect(items[1]!.text()).toContain('Baholar soni')
    const locked = w.find('[data-testid="tie-locked"]')
    expect(locked.text()).toContain('Alifbo')
    expect(locked.findAll('button')).toHaveLength(0)
  })

  it('pastga/yuqoriga siljitish yangi tartibni chiqaradi (alifbo oxirida)', async () => {
    const w = mountEditor(['daysCount', 'scoresCount', 'alphabetical'])
    await w.findAll('[data-testid="tie-down"]')[0]!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([
      ['scoresCount', 'daysCount', 'alphabetical'],
    ])
    await w.findAll('[data-testid="tie-up"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')![1]).toEqual([
      ['scoresCount', 'daysCount', 'alphabetical'],
    ])
  })

  it("chetki elementlar uchun yuqoriga/pastga o'chirilgan", () => {
    const w = mountEditor(['daysCount', 'scoresCount'])
    expect(w.findAll('[data-testid="tie-up"]')[0]!.attributes('disabled')).toBeDefined()
    expect(w.findAll('[data-testid="tie-down"]')[1]!.attributes('disabled')).toBeDefined()
  })

  it("olib tashlash va qo'shish", async () => {
    const w = mountEditor(['daysCount', 'alphabetical'])
    await w.find('[data-testid="tie-remove"]').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([['alphabetical']])
    const add = w.findAll('[data-testid="tie-add"]')
    expect(add).toHaveLength(1)
    await add[0]!.trigger('click')
    expect(w.emitted('update:modelValue')![1]).toEqual([
      ['daysCount', 'scoresCount', 'alphabetical'],
    ])
  })

  it("disabled bo'lsa hamma tugmalar o'chiq", () => {
    const w = mountEditor(['daysCount', 'scoresCount'], true)
    expect(w.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })
})
