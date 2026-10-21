import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { PermissionMeta } from '@/api/types'
import PermissionEditor from './PermissionEditor.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const permissions: PermissionMeta[] = [
  { key: 'students.view', group: "O'quvchilar", label: "Ko'rish", roles: ['teacher'] },
  { key: 'reports.view', group: 'Hisobotlar', label: 'Hisobot', roles: ['teacher'] },
  { key: 'classes.manage', group: 'Sinflar', label: 'Sinflar', roles: ['school_admin'] },
]

function mountEditor(props: Record<string, unknown>) {
  return mount(PermissionEditor, {
    props: { permissions, role: 'teacher', modelValue: [], ...props },
    global: { plugins: [i18n] },
  })
}

describe('PermissionEditor', () => {
  it("faqat tanlangan rolga mos ruxsatlarni ko'rsatadi", () => {
    const w = mountEditor({})
    expect(w.text()).toContain("Ko'rish")
    expect(w.text()).not.toContain('Sinflar')
  })

  it("allowed ro'yxatida bo'lmagan ruxsatlar disabled", () => {
    const w = mountEditor({ allowed: ['students.view'] })
    const boxes = w.findAll('input[type="checkbox"]')
    // [guruh1, ruxsat1, guruh2, ruxsat2]
    const labels = w.findAll('label').map((l) => l.text())
    const idx = labels.findIndex((l) => l.startsWith('Hisobot') && !l.startsWith('Hisobotlar'))
    expect(boxes[idx]!.attributes('disabled')).toBeDefined()
    const allowedIdx = labels.findIndex((l) => l.startsWith("Ko'rish"))
    expect(boxes[allowedIdx]!.attributes('disabled')).toBeUndefined()
  })

  it('belgilanganda update:modelValue chiqaradi', async () => {
    const w = mountEditor({})
    const labels = w.findAll('label').map((l) => l.text())
    const idx = labels.findIndex((l) => l.startsWith("Ko'rish"))
    await w.findAll('input[type="checkbox"]')[idx]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['students.view']])
  })
})
