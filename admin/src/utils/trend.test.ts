import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import TrendChart from '@/components/scoring/TrendChart.vue'
import { buildTrend } from './trend'

describe('buildTrend', () => {
  it("bo'sh ro'yxat: koordinata va yo'l yo'q", () => {
    const g = buildTrend([], 600, 200)
    expect(g.coords).toEqual([])
    expect(g.linePath).toBe('')
  })

  it("bitta nuqta: markazda, maydon yo'li yo'q", () => {
    const g = buildTrend([{ date: '2026-10-10', dayScore: 80 }], 600, 200)
    expect(g.coords).toHaveLength(1)
    expect(g.coords[0]!.x).toBeCloseTo(36 + (600 - 36 - 16) / 2, 0)
    expect(g.areaPath).toBe('')
    expect(g.yMax).toBeGreaterThan(g.yMin)
  })

  it("ko'p nuqta: sana bo'yicha proporsional x, katta ball yuqorida (kichik y)", () => {
    const g = buildTrend(
      [
        { date: '2026-10-12', dayScore: 90 },
        { date: '2026-10-10', dayScore: 60 },
        { date: '2026-10-11', dayScore: 75 },
      ],
      600,
      200,
    )
    expect(g.coords.map((c) => c.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12'])
    expect(g.coords[0]!.x).toBe(36)
    expect(g.coords[2]!.x).toBe(584)
    expect(g.coords[1]!.x).toBeCloseTo(310, 0)
    expect(g.coords[2]!.y).toBeLessThan(g.coords[0]!.y)
    expect(g.linePath.startsWith('M')).toBe(true)
    expect(g.areaPath.endsWith('Z')).toBe(true)
  })

  it('belgilangan diapazon (min/max) ishlatiladi', () => {
    const g = buildTrend([{ date: '2026-10-10', dayScore: 100 }], 600, 200, undefined, {
      min: 0,
      max: 100,
    })
    expect(g.yMin).toBe(0)
    expect(g.yMax).toBe(100)
    expect(g.coords[0]!.y).toBe(12) // eng yuqori chiziq
  })
})

describe('TrendChart', () => {
  const mountChart = (points: { date: string; dayScore: number }[]) =>
    mount(TrendChart, {
      props: { points },
      global: { plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })] },
    })

  it("bo'sh holat xabari", () => {
    const w = mountChart([])
    expect(w.find('svg').exists()).toBe(false)
    expect(w.text()).toContain("baholar yo'q")
  })
  it("bitta nuqta: doira bor, chiziq yo'q", () => {
    const w = mountChart([{ date: '2026-10-10', dayScore: 80 }])
    expect(w.findAll('circle')).toHaveLength(1)
    expect(w.find('path.stroke-primary-600').exists()).toBe(false)
  })
  it("ko'p nuqta: chiziq va har nuqta uchun doira, aria-label bilan", () => {
    const w = mountChart([
      { date: '2026-10-10', dayScore: 60 },
      { date: '2026-10-11', dayScore: 70 },
      { date: '2026-10-12', dayScore: 90 },
    ])
    expect(w.findAll('circle')).toHaveLength(3)
    expect(w.find('path.stroke-primary-600').exists()).toBe(true)
    expect(w.find('svg').attributes('aria-label')).toContain('3')
  })
})
