import { describe, expect, it } from 'vitest'
import type { ScoringSettings } from '@/api/types'
import {
  applyFlagChange,
  buildOverride,
  diffSettings,
  mergeWithGlobal,
  overrideFlags,
  validateScoringSettings,
} from './settingsForm'

const t = (k: string) => k
const global: ScoringSettings = {
  minScore: 0,
  maxScore: 100,
  requireBehaviorType: true,
  commentRequiredBelow: null,
  editWindowHours: 24,
  backdateDays: 3,
  dailyAggregation: 'average',
}

describe('validateScoringSettings', () => {
  it('standart qiymatlar xatosiz', () => {
    expect(validateScoringSettings(global, t)).toEqual({})
  })
  it('max <= min, manfiy va kasr qiymatlar', () => {
    expect(validateScoringSettings({ ...global, minScore: 50, maxScore: 50 }, t).maxScore).toBe(
      'settings.errors.maxGtMin',
    )
    expect(
      validateScoringSettings({ ...global, editWindowHours: -1 }, t).editWindowHours,
    ).toBeDefined()
    expect(validateScoringSettings({ ...global, backdateDays: 1.5 }, t).backdateDays).toBeDefined()
    expect(validateScoringSettings({ ...global, minScore: NaN }, t).minScore).toBeDefined()
  })
  it("izoh chegarasi diapazon ichida bo'lishi kerak; null - o'chirilgan", () => {
    expect(validateScoringSettings({ ...global, commentRequiredBelow: 60 }, t)).toEqual({})
    expect(
      validateScoringSettings({ ...global, commentRequiredBelow: 0 }, t).commentRequiredBelow,
    ).toBeDefined()
    expect(
      validateScoringSettings({ ...global, commentRequiredBelow: 101 }, t).commentRequiredBelow,
    ).toBeDefined()
    expect(validateScoringSettings({ ...global, commentRequiredBelow: null }, t)).toEqual({})
  })
})

describe("override mantig'i", () => {
  it('overrideFlags: faqat serverdagi override kalitlari belgilanadi', () => {
    const f = overrideFlags({ minScore: 1, commentRequiredBelow: null })
    expect(f.minScore).toBe(true)
    expect(f.commentRequiredBelow).toBe(true) // null ham override (izohni o'chirish)
    expect(f.maxScore).toBe(false)
    expect(Object.values(overrideFlags(null)).every((v) => v === false)).toBe(true)
  })

  it('mergeWithGlobal: override global qiymatni bekor qiladi', () => {
    expect(mergeWithGlobal(global, { maxScore: 5, minScore: 1 })).toMatchObject({
      minScore: 1,
      maxScore: 5,
      editWindowHours: 24,
    })
    expect(mergeWithGlobal(global, null)).toEqual(global)
  })

  it("buildOverride: faqat belgilangan maydonlar; hech biri bo'lmasa null", () => {
    const values = { ...global, minScore: 1, maxScore: 5, backdateDays: 10 }
    const flags = overrideFlags({ minScore: 1, maxScore: 5 })
    expect(buildOverride(values, flags)).toEqual({ minScore: 1, maxScore: 5 })
    expect(buildOverride(values, overrideFlags(null))).toBeNull()
  })

  it("belgini o'chirish maydonni global qiymatga qaytaradi", () => {
    const values = { ...global, maxScore: 5 }
    expect(applyFlagChange(values, global, 'maxScore', false).maxScore).toBe(100)
    expect(applyFlagChange(values, global, 'maxScore', true).maxScore).toBe(5)
  })

  it("diffSettings o'zgargan kalitlarni qaytaradi", () => {
    expect(diffSettings(global, { ...global, maxScore: 10, requireBehaviorType: false })).toEqual([
      'maxScore',
      'requireBehaviorType',
    ])
    expect(diffSettings(global, { ...global })).toEqual([])
  })
})
