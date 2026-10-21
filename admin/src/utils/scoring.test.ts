import { describe, expect, it } from 'vitest'
import {
  dateBounds,
  isDateAllowed,
  pruneSelection,
  quickScores,
  shiftDate,
  todayTashkent,
  validateDraft,
  withAlpha,
  type RowDraft,
} from './scoring'
import type { ScoringSettings } from '@/api/types'

const base: ScoringSettings = {
  minScore: 0,
  maxScore: 100,
  requireBehaviorType: false,
  commentRequiredBelow: null,
  editWindowHours: 24,
  backdateDays: 3,
  dailyAggregation: 'average',
}
const d = (over: Partial<RowDraft> = {}): RowDraft => ({
  value: '80',
  behaviorTypeId: null,
  comment: '',
  ...over,
})

describe('validateDraft', () => {
  it("to'g'ri qoralama xatosiz", () => {
    expect(validateDraft(d(), base)).toEqual({})
    expect(validateDraft(d({ value: '0' }), base)).toEqual({})
    expect(validateDraft(d({ value: '100' }), base)).toEqual({})
  })
  it("bo'sh, kasr, harf va diapazondan tashqari qiymatlar", () => {
    expect(validateDraft(d({ value: '' }), base).value).toBe('required')
    expect(validateDraft(d({ value: '7.5' }), base).value).toBe('integer')
    expect(validateDraft(d({ value: 'abc' }), base).value).toBe('integer')
    expect(validateDraft(d({ value: '-1' }), base).value).toBe('range')
    expect(validateDraft(d({ value: '101' }), base).value).toBe('range')
  })
  it('sozlamadagi boshqa diapazon', () => {
    const s = { ...base, minScore: 1, maxScore: 5 }
    expect(validateDraft(d({ value: '5' }), s)).toEqual({})
    expect(validateDraft(d({ value: '6' }), s).value).toBe('range')
  })
  it('izoh majburiy chegarasi: faqat chegaradan past ballda', () => {
    const s = { ...base, commentRequiredBelow: 60 }
    expect(validateDraft(d({ value: '59' }), s).comment).toBe('commentRequired')
    expect(validateDraft(d({ value: '60' }), s)).toEqual({})
    expect(validateDraft(d({ value: '10', comment: '   ' }), s).comment).toBe('commentRequired')
    expect(validateDraft(d({ value: '10', comment: 'sabab' }), s)).toEqual({})
  })
  it('izoh uzunligi 500 dan oshmasin', () => {
    expect(validateDraft(d({ comment: 'x'.repeat(501) }), base).comment).toBe('commentTooLong')
  })
  it("xulq turi majburiy bo'lsa", () => {
    const s = { ...base, requireBehaviorType: true }
    expect(validateDraft(d(), s).behavior).toBe('behaviorRequired')
    expect(validateDraft(d({ behaviorTypeId: 'b' }), s)).toEqual({})
  })
})

describe('sana cheklovlari', () => {
  it("shiftDate oy va yil chegarasidan o'tadi", () => {
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30')
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('dateBounds: [bugun - backdateDays, bugun]', () => {
    expect(dateBounds('2026-10-16', 3)).toEqual({ min: '2026-10-13', max: '2026-10-16' })
    expect(dateBounds('2026-10-16', 0)).toEqual({ min: '2026-10-16', max: '2026-10-16' })
  })
  it('isDateAllowed: kelajak va juda eski sana rad etiladi', () => {
    expect(isDateAllowed('2026-10-16', '2026-10-16', 3)).toBe(true)
    expect(isDateAllowed('2026-10-13', '2026-10-16', 3)).toBe(true)
    expect(isDateAllowed('2026-10-12', '2026-10-16', 3)).toBe(false)
    expect(isDateAllowed('2026-10-17', '2026-10-16', 3)).toBe(false)
  })
  it('todayTashkent: UTC kechasi Toshkentda keyingi kun', () => {
    expect(todayTashkent(new Date('2026-10-15T20:00:00Z'))).toBe('2026-10-16')
    expect(todayTashkent(new Date('2026-10-15T10:00:00Z'))).toBe('2026-10-15')
  })
})

describe('quickScores / withAlpha', () => {
  it('standart diapazonda 100/90/80/70/60', () => {
    expect(quickScores(base)).toEqual([100, 90, 80, 70, 60])
  })
  it('5 ballik diapazonga moslanadi va takrorlanmaydi', () => {
    expect(quickScores({ minScore: 1, maxScore: 5 })).toEqual([5, 4, 3])
  })
  it('withAlpha 8 xonali hex qaytaradi', () => {
    expect(withAlpha('#16a34a', 1)).toBe('#16a34aff')
    expect(withAlpha('#16a34a', 0)).toBe('#16a34a00')
  })
})

describe('pruneSelection (ommaviy panel tanlovi)', () => {
  it("ko'rinmay qolgan qatorlar tanlovdan chiqariladi, ko'rinadiganlari qoladi", () => {
    const selected = new Set(['a', 'b', 'c'])
    expect(pruneSelection(selected, ['b', 'c', 'd'])).toBe(1)
    expect([...selected]).toEqual(['b', 'c'])
  })
  it("saqlagach hammasi yashirinsa (faqat baholanmaganlar filtri) tanlov bo'shaydi", () => {
    const selected = new Set(['a', 'b'])
    expect(pruneSelection(selected, [])).toBe(2)
    expect(selected.size).toBe(0)
  })
  it("o'zgarish bo'lmasa 0 qaytaradi", () => {
    const selected = new Set(['a'])
    expect(pruneSelection(selected, ['a', 'b'])).toBe(0)
    expect(selected.has('a')).toBe(true)
  })
})
