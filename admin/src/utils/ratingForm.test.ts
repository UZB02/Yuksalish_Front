import { describe, expect, it } from 'vitest'
import type { RatingSettings } from '@/api/types'
import {
  DEFAULT_RATING,
  type RatingKey,
  RATING_KEYS,
  moveItem,
  normalizeTieBreak,
  validateRating,
} from './ratingForm'
import { DEFAULT_PUBLIC, topMode, validatePublic } from './publicForm'
import {
  applyChanges,
  diffValues,
  flagsFromOverride,
  mergeValues,
  omitKeys,
  pickOverride,
  resetFlagValue,
} from './scopeSettings'

const t = (k: string) => k

describe('validateRating', () => {
  it('standart qiymatlar xatosiz', () => {
    expect(validateRating(DEFAULT_RATING, t)).toEqual({})
  })
  it('maxsus davr: ikkala sana majburiy va from <= to', () => {
    const base = { ...DEFAULT_RATING, periodType: 'custom' as const }
    const empty = validateRating(base, t)
    expect(empty.customFrom).toBeDefined()
    expect(empty.customTo).toBeDefined()
    expect(
      validateRating({ ...base, customFrom: '2026-10-10', customTo: '2026-10-01' }, t).customTo,
    ).toBe('validation.endAfterStart')
    expect(
      validateRating({ ...base, customFrom: '2026-10-01', customTo: '2026-10-10' }, t),
    ).toEqual({})
    expect(
      validateRating({ ...base, customFrom: '2026-10-01', customTo: '2026-10-01' }, t),
    ).toEqual({})
  })
  it("maxsus bo'lmasa sanalar tekshirilmaydi; minScoresCount >= 1 butun son", () => {
    expect(validateRating({ ...DEFAULT_RATING, customFrom: null }, t)).toEqual({})
    expect(validateRating({ ...DEFAULT_RATING, minScoresCount: 0 }, t).minScoresCount).toBeDefined()
    expect(
      validateRating({ ...DEFAULT_RATING, minScoresCount: 2.5 }, t).minScoresCount,
    ).toBeDefined()
    expect(
      validateRating({ ...DEFAULT_RATING, minScoresCount: NaN }, t).minScoresCount,
    ).toBeDefined()
  })
})

describe('tie-break yordamchilari', () => {
  it('normalizeTieBreak: takrorsiz, alifbo oxirida', () => {
    expect(normalizeTieBreak(['alphabetical', 'scoresCount', 'scoresCount', 'daysCount'])).toEqual([
      'scoresCount',
      'daysCount',
      'alphabetical',
    ])
    expect(normalizeTieBreak([])).toEqual(['alphabetical'])
  })
  it('moveItem chegaradan chiqmaydi', () => {
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
  })
})

describe('validatePublic', () => {
  it('standart xatosiz', () => {
    expect(validatePublic(DEFAULT_PUBLIC, t)).toEqual({})
  })
  it('chegaralar: topStudents, yangilanish, slayd, rang, matn uzunligi', () => {
    expect(validatePublic({ ...DEFAULT_PUBLIC, topStudents: null }, t)).toEqual({})
    expect(validatePublic({ ...DEFAULT_PUBLIC, topStudents: 501 }, t).topStudents).toBeDefined()
    expect(validatePublic({ ...DEFAULT_PUBLIC, topStudents: 0 }, t).topStudents).toBeDefined()
    expect(
      validatePublic({ ...DEFAULT_PUBLIC, autoRefreshSeconds: 29 }, t).autoRefreshSeconds,
    ).toBeDefined()
    expect(validatePublic({ ...DEFAULT_PUBLIC, autoRefreshSeconds: 3600 }, t)).toEqual({})
    expect(validatePublic({ ...DEFAULT_PUBLIC, tvSlideSeconds: 4 }, t).tvSlideSeconds).toBeDefined()
    expect(validatePublic({ ...DEFAULT_PUBLIC, primaryColor: 'red' }, t).primaryColor).toBeDefined()
    expect(validatePublic({ ...DEFAULT_PUBLIC, primaryColor: '#aabbcc' }, t)).toEqual({})
    expect(validatePublic({ ...DEFAULT_PUBLIC, title: 'x'.repeat(81) }, t).title).toBeDefined()
    expect(
      validatePublic({ ...DEFAULT_PUBLIC, subtitle: 'x'.repeat(161) }, t).subtitle,
    ).toBeDefined()
  })
  it('topMode', () => {
    expect(topMode(null)).toBe('all')
    expect(topMode(50)).toBe(50)
    expect(topMode(33)).toBe('custom')
  })
})

describe("scopeSettings (umumiy override mantig'i)", () => {
  const global = { ...DEFAULT_RATING }

  it("massiv qiymatlar ham diff da to'g'ri solishtiriladi", () => {
    expect(
      diffValues(global, { ...global, tieBreak: ['daysCount', 'alphabetical'] }, RATING_KEYS),
    ).toEqual([])
    expect(
      diffValues(global, { ...global, tieBreak: ['scoresCount', 'alphabetical'] }, RATING_KEYS),
    ).toEqual(['tieBreak'])
  })
  it("override, bayroqlar va qiymatlar o'zaro mos", () => {
    const override: Partial<RatingSettings> = { method: 'sum', minScoresCount: 5 }
    const flags = flagsFromOverride<RatingSettings, RatingKey>(override, RATING_KEYS)
    expect(flags.method && flags.minScoresCount && !flags.periodType).toBe(true)
    const values = mergeValues(global, override)
    expect(values.method).toBe('sum')
    expect(pickOverride<RatingSettings, RatingKey>(values, flags, RATING_KEYS)).toEqual(override)
    const reset = resetFlagValue(values, global, 'method', false)
    expect(reset.method).toBe('average')
    expect(
      pickOverride<RatingSettings, RatingKey>(reset, { ...flags, method: false }, RATING_KEYS),
    ).toEqual({
      minScoresCount: 5,
    })
    expect(
      pickOverride<RatingSettings, RatingKey>(
        reset,
        flagsFromOverride<RatingSettings, RatingKey>(null, RATING_KEYS),
        RATING_KEYS,
      ),
    ).toBeNull()
  })
  it('omitKeys va applyChanges', () => {
    expect(omitKeys({ a: 1, b: 2 }, ['b'])).toEqual({ a: 1 })
    const calls: string[] = []
    applyChanges({ a: 1, b: 2 }, { a: 1, b: 3 }, ['a', 'b'], (k) => calls.push(k))
    expect(calls).toEqual(['b'])
  })
})
