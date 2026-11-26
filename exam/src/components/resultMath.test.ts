import { describe, expect, it } from 'vitest'
import { RING_C, percentOf, ringOffset, toneOf } from './resultMath'

describe('resultMath', () => {
  it('foiz: yaxlitlash, chegaralar, max=0', () => {
    expect(percentOf(4, 24)).toBe(17)
    expect(percentOf(24, 24)).toBe(100)
    expect(percentOf(30, 24)).toBe(100)
    expect(percentOf(0, 0)).toBe(0)
    expect(percentOf(-1, 10)).toBe(0)
  })
  it('rang chegaralari: 70 ok, 40 warn, past bad', () => {
    expect(toneOf(100)).toBe('ok')
    expect(toneOf(70)).toBe('ok')
    expect(toneOf(69)).toBe('warn')
    expect(toneOf(40)).toBe('warn')
    expect(toneOf(39)).toBe('bad')
    expect(toneOf(0)).toBe('bad')
  })
  it('halqa siljishi', () => {
    expect(ringOffset(0)).toBeCloseTo(RING_C)
    expect(ringOffset(100)).toBeCloseTo(0)
    expect(ringOffset(50)).toBeCloseTo(RING_C / 2)
  })
})
