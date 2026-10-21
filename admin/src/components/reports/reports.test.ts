import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { todayTashkent } from '@/utils/scoring'
import ReportPeriodPicker from './ReportPeriodPicker.vue'
import ReportToolbar from './ReportToolbar.vue'
import ReportTable, { type ReportColumn } from './ReportTable.vue'
import DistributionBars from './DistributionBars.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const opts = { global: { plugins: [i18n] } }

const year = {
  startDate: '2026-09-01',
  endDate: '2027-05-31',
  periods: [{ name: '1-chorak', startDate: '2026-09-01', endDate: '2026-10-31' }],
}

describe('ReportPeriodPicker', () => {
  const mountPicker = (props = {}) =>
    mount(ReportPeriodPicker, {
      props: { preset: 'month', from: '', to: '', year, error: null, ...props },
      ...opts,
    })

  it("tezkor tanlovlar: Bugun, 7 kun, Joriy oy, O'tgan oy, chorak, O'quv yili, Maxsus", () => {
    const labels = mountPicker()
      .findAll('[role="radio"]')
      .map((b) => b.text())
    expect(labels).toEqual([
      'Bugun',
      '7 kun',
      'Joriy oy',
      "O'tgan oy",
      '1-chorak',
      "O'quv yili",
      'Maxsus',
    ])
  })

  it("faol o'quv yili yo'q bo'lsa chorak va yil tanlovlari chiqmaydi", () => {
    const labels = mountPicker({ year: null })
      .findAll('[role="radio"]')
      .map((b) => b.text())
    expect(labels).toEqual(['Bugun', '7 kun', 'Joriy oy', "O'tgan oy", 'Maxsus'])
  })

  it('tanlangan preset aria-checked va bosilganda update:preset', async () => {
    const w = mountPicker({ preset: 'week' })
    expect(w.find('[data-preset="week"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-preset="today"]').attributes('aria-checked')).toBe('false')
    await w.find('[data-preset="lastMonth"]').trigger('click')
    expect(w.emitted('update:preset')![0]).toEqual(['lastMonth'])
  })

  it('sana maydonlari faqat Maxsus rejimda; kelajak sanasi max=bugun bilan cheklangan', async () => {
    expect(mountPicker().find('[data-testid="period-to"]').exists()).toBe(false)
    const w = mountPicker({ preset: 'custom', from: '2026-10-01', to: '2026-10-05' })
    const to = w.find('input[data-testid="period-to"]')
    expect(to.attributes('max')).toBe(todayTashkent())
    expect(to.attributes('min')).toBe('2026-10-01')
    await w.find('input[data-testid="period-from"]').setValue('2026-10-02')
    expect(w.emitted('update:from')![0]).toEqual(['2026-10-02'])
  })

  it('validatsiya xatosi matni (366 kun / kelajak)', () => {
    expect(
      mountPicker({ preset: 'custom', error: 'tooLong' })
        .find('[data-testid="period-error"]')
        .text(),
    ).toBe('Davr 366 kundan oshmasligi kerak')
    expect(
      mountPicker({ preset: 'custom', error: 'future' }).find('[role="alert"]').text(),
    ).toContain('kelajakka')
    expect(mountPicker().find('[data-testid="period-error"]').exists()).toBe(false)
  })
})

describe('ReportToolbar', () => {
  it("reports.export yo'q: Excel va PDF tugmalari ko'rinmaydi", () => {
    const w = mount(ReportToolbar, { props: { canExport: false, busy: null }, ...opts })
    expect(w.find('[data-testid="export-xlsx"]').exists()).toBe(false)
    expect(w.find('[data-testid="export-pdf"]').exists()).toBe(false)
  })

  it('reports.export bor: tugmalar bosilganda export hodisasi', async () => {
    const w = mount(ReportToolbar, { props: { canExport: true, busy: null }, ...opts })
    await w.find('[data-testid="export-xlsx"]').trigger('click')
    await w.find('[data-testid="export-pdf"]').trigger('click')
    expect(w.emitted('export')).toEqual([['xlsx'], ['pdf']])
  })

  it("yuklanayotganda ikkala tugma bloklanadi; tayyor bo'lmasa disabled", () => {
    const busy = mount(ReportToolbar, { props: { canExport: true, busy: 'pdf' }, ...opts })
    expect(busy.find('[data-testid="export-xlsx"]').attributes('disabled')).toBeDefined()
    expect(busy.find('[data-testid="export-pdf"]').attributes('disabled')).toBeDefined()
    const notReady = mount(ReportToolbar, {
      props: { canExport: true, busy: null, disabled: true },
      ...opts,
    })
    expect(notReady.find('[data-testid="export-xlsx"]').attributes('disabled')).toBeDefined()
  })
})

describe('ReportTable', () => {
  afterEach(() => vi.restoreAllMocks())
  type R = { id: string; name: string; v: number }
  const rows: R[] = Array.from({ length: 60 }, (_, i) => ({ id: String(i), name: `N${i}`, v: i }))
  const columns: ReportColumn<R>[] = [
    { key: 'name', label: 'Nomi' },
    { key: 'v', label: 'Qiymat', sortValue: (r) => r.v },
  ]

  it("ustun sarlavhasi bosilganda saralanadi (asc, so'ng desc)", async () => {
    const w = mount(ReportTable, { props: { columns: columns as never, rows }, ...opts })
    const firstCell = () => w.find('tbody tr td').text()
    expect(firstCell()).toBe('N0')
    const header = w.findAll('th button')[0]!
    await header.trigger('click')
    expect(firstCell()).toBe('N0')
    await header.trigger('click')
    expect(firstCell()).toBe('N59')
    expect(w.find('th[aria-sort="descending"]').exists()).toBe(true)
  })

  it("50 qatordan ortig'i \"ko'proq ko'rsat\" bilan", async () => {
    const w = mount(ReportTable, { props: { columns: columns as never, rows }, ...opts })
    expect(w.findAll('tbody tr')).toHaveLength(50)
    const more = w.findAll('button').find((b) => b.text().includes("Ko'proq"))!
    await more.trigger('click')
    expect(w.findAll('tbody tr')).toHaveLength(60)
  })
})

describe('DistributionBars', () => {
  it("ko'pdan kamga tartiblanadi va eng kattasi 100% kenglikda", () => {
    const w = mount(DistributionBars, {
      props: {
        items: [
          { name: 'B', count: 2, color: '#16a34a' },
          { name: 'A', count: 4, color: '#dc2626' },
        ],
      },
      ...opts,
    })
    const names = w.findAll('li span:first-child').map((s) => s.text())
    expect(names).toEqual(['A', 'B'])
    const bars = w.findAll('[role="img"] > div')
    expect(bars[0]!.attributes('style')).toContain('width: 100%')
    expect(bars[1]!.attributes('style')).toContain('width: 50%')
  })
  it("bo'sh holat matni", () => {
    expect(mount(DistributionBars, { props: { items: [] }, ...opts }).text()).toContain('yo')
  })
})
