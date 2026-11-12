import { describe, expect, it } from 'vitest'
import type { AttendanceTrendDay } from '@/api/types'
import { barLevel, labelIndices, layoutBars, pickDays, shortDate } from './dashboardChart'

const day = (date: string): AttendanceTrendDay => ({
  date,
  rate: 90,
  present: 1,
  late: 0,
  partial: 0,
  absentExcused: 0,
  absentUnexcused: 0,
  total: 1,
})

describe('dashboardChart utils', () => {
  it('barLevel chegaralari', () => {
    expect(barLevel(100)).toBe('good')
    expect(barLevel(95)).toBe('good')
    expect(barLevel(94.99)).toBe('warn')
    expect(barLevel(85)).toBe('warn')
    expect(barLevel(84.9)).toBe('bad')
  })

  it('pickDays: oxirgi N ta, tartiblangan', () => {
    const days = Array.from({ length: 25 }, (_, i) =>
      day(`2026-10-${String(i + 1).padStart(2, '0')}`),
    )
    const picked = pickDays([...days].reverse(), 20)
    expect(picked).toHaveLength(20)
    expect(picked[0]!.date).toBe('2026-10-06')
    expect(picked[19]!.date).toBe('2026-10-25')
    expect(pickDays([], 20)).toEqual([])
  })

  it('layoutBars: kam kunda cho`zilmaydi, ko`p kunda butun kenglikka sig`adi', () => {
    const few = layoutBars(4, 600, 30)
    expect(few.barW).toBe(28)
    expect(few.slot).toBe(42)
    expect(few.x(0)).toBe(30)
    expect(few.x(3)).toBe(30 + 3 * 42)
    const many = layoutBars(20, 600, 30)
    expect(many.slot).toBe(30)
    expect(many.barW).toBeCloseTo(20.4)
    expect(many.x(19) + many.slot).toBeLessThanOrEqual(30 + 600 + 1e-9)
    expect(layoutBars(0, 600, 30).slot).toBe(0)
  })

  it('labelIndices: oxirgisi doim bor, yorliqlar orasi >= yorliq kengligi', () => {
    // slot 10px, yorliq 32px -> step 4
    const idx = labelIndices(20, 10, 32)
    expect(idx[idx.length - 1]).toBe(19)
    for (let i = 1; i < idx.length; i++)
      expect((idx[i]! - idx[i - 1]!) * 10).toBeGreaterThanOrEqual(32)
    // keng slotda hammasi
    expect(labelIndices(4, 42, 32)).toEqual([0, 1, 2, 3])
    expect(labelIndices(1, 42, 32)).toEqual([0])
    expect(labelIndices(0, 42, 32)).toEqual([])
  })

  it('shortDate', () => {
    expect(shortDate('2026-11-12')).toBe('12.11')
  })
})
