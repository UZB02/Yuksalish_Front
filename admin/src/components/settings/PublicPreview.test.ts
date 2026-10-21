import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { PublicSettings } from '@/api/types'
import { DEFAULT_PUBLIC } from '@/utils/publicForm'
import PublicPreview from './PublicPreview.vue'

const mountPreview = (over: Partial<PublicSettings> = {}, schoolName?: string) =>
  mount(PublicPreview, {
    props: { settings: { ...DEFAULT_PUBLIC, enabled: true, ...over }, schoolName },
    global: { plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })] },
  })

const title = (w: ReturnType<typeof mountPreview>) => w.find('[data-testid="preview-title"]').text()

describe('PublicPreview', () => {
  it("sarlavha: belgilangan > maktab nomi > standart; qo'shimcha sarlavha", () => {
    expect(title(mountPreview({ title: 'Yuksalish' }, 'Maktab 1'))).toBe('Yuksalish')
    expect(title(mountPreview({}, 'Maktab 1'))).toBe('Maktab 1')
    expect(title(mountPreview())).toBe('Maktab nomi')
    expect(
      mountPreview({ subtitle: 'Intizom' }).find('[data-testid="preview-subtitle"]').text(),
    ).toBe('Intizom')
  })

  it('asosiy rang sarlavha fonida', () => {
    const w = mountPreview({ primaryColor: '#dc2626' })
    expect(w.find('[data-testid="preview-header"]').attributes('style')).toContain(
      'rgb(220, 38, 38)',
    )
  })

  it('medallar, ball va oʻrin oʻzgarishi sozlamaga qarab', () => {
    const on = mountPreview()
    expect(on.findAll('[data-testid="preview-medal"]')).toHaveLength(3)
    expect(on.findAll('[data-testid="preview-score"]').length).toBeGreaterThan(0)
    expect(on.findAll('[data-testid="preview-trend"]').length).toBeGreaterThan(0)
    const off = mountPreview({ showMedals: false, showScores: false, showTrend: false })
    expect(off.findAll('[data-testid="preview-medal"]')).toHaveLength(0)
    expect(off.findAll('[data-testid="preview-score"]')).toHaveLength(0)
    expect(off.findAll('[data-testid="preview-trend"]')).toHaveLength(0)
  })

  it("topStudents qatorlar sonini cheklaydi; o'quvchilar o'chirilsa jadval yo'q", () => {
    expect(mountPreview({ topStudents: 2 }).findAll('[data-testid="preview-row"]')).toHaveLength(2)
    expect(mountPreview({ topStudents: null }).findAll('[data-testid="preview-row"]')).toHaveLength(
      5,
    )
    expect(
      mountPreview({ showStudents: false }).find('[data-testid="preview-table"]').exists(),
    ).toBe(false)
    expect(
      mountPreview({ showClasses: false }).find('[data-testid="preview-classes-tab"]').exists(),
    ).toBe(false)
  })

  it("enabled=false bo'lsa ogohlantirish chiqadi", () => {
    expect(mountPreview({ enabled: false }).find('[data-testid="preview-disabled"]').exists()).toBe(
      true,
    )
    expect(mountPreview({ enabled: true }).find('[data-testid="preview-disabled"]').exists()).toBe(
      false,
    )
  })
})
