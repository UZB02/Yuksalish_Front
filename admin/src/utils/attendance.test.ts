import { describe, expect, it } from 'vitest'
import {
  formatRate,
  isoWeekday,
  isIsoDate,
  isWorkingDay,
  nearestWorkingDay,
  monthGrid,
  presetRange,
  rateTone,
  shiftMonth,
  textOn,
  validateAttendanceDraft,
} from './attendance'
import { shiftDate } from './scoring'

describe('isoWeekday / isWorkingDay', () => {
  it('ISO hafta kunlari (1 = dushanba, 7 = yakshanba)', () => {
    expect(isoWeekday('2026-10-12')).toBe(1) // dushanba
    expect(isoWeekday('2026-10-17')).toBe(6) // shanba
    expect(isoWeekday('2026-10-18')).toBe(7) // yakshanba
  })
  it('ish kuni: standart dushanba-shanba, yakshanba dam', () => {
    const wd = [1, 2, 3, 4, 5, 6]
    expect(isWorkingDay('2026-10-17', wd)).toBe(true)
    expect(isWorkingDay('2026-10-18', wd)).toBe(false)
    expect(isWorkingDay('2026-10-17', [1, 2, 3, 4, 5])).toBe(false)
  })
})

describe('validateAttendanceDraft', () => {
  const settings = { noteRequiredCategories: ['absent_excused' as const] }
  const draft = (over = {}) => ({ statusId: 's', minutesLate: '', note: '', ...over })

  it('holat majburiy', () => {
    expect(validateAttendanceDraft(draft({ statusId: null }), undefined, settings).status).toBe(
      'statusRequired',
    )
  })
  it('daqiqa faqat late da tekshiriladi', () => {
    expect(
      validateAttendanceDraft(draft({ minutesLate: '0' }), { category: 'late' }, settings).minutes,
    ).toBe('minutesRange')
    expect(
      validateAttendanceDraft(draft({ minutesLate: '1.5' }), { category: 'late' }, settings)
        .minutes,
    ).toBe('minutesRange')
    expect(
      validateAttendanceDraft(draft({ minutesLate: '600' }), { category: 'late' }, settings),
    ).toEqual({})
    // late bo'lmasa daqiqa e'tiborsiz
    expect(
      validateAttendanceDraft(draft({ minutesLate: '9999' }), { category: 'present' }, settings),
    ).toEqual({})
  })
  it('izoh majburiyligi va uzunligi', () => {
    expect(validateAttendanceDraft(draft(), { category: 'absent_excused' }, settings).note).toBe(
      'noteRequired',
    )
    expect(
      validateAttendanceDraft(draft({ note: '   ' }), { category: 'absent_excused' }, settings)
        .note,
    ).toBe('noteRequired')
    expect(
      validateAttendanceDraft(draft({ note: 'x'.repeat(301) }), { category: 'present' }, settings)
        .note,
    ).toBe('noteTooLong')
  })
})

describe('kalendar yordamchilari', () => {
  it("shiftMonth yil chegarasidan o'tadi", () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
  it("monthGrid: haftalar dushanbadan boshlanadi, bo'sh kataklar to'ldiriladi", () => {
    const weeks = monthGrid('2026-10') // 1-oktyabr 2026 - payshanba
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0]!.slice(0, 3).map((c) => c.date)).toEqual([null, null, null])
    expect(weeks[0]![3]!.date).toBe('2026-10-01')
    const days = weeks.flat().filter((c) => c.date)
    expect(days).toHaveLength(31)
    expect(days[0]!.isoWeekday).toBe(4)
  })
  it('fevral (kabisa yili)', () => {
    expect(
      monthGrid('2028-02')
        .flat()
        .filter((c) => c.date),
    ).toHaveLength(29)
  })
})

describe('foiz va tezkor davrlar', () => {
  it('rateTone / formatRate', () => {
    expect(rateTone(95)).toBe('success')
    expect(rateTone(80)).toBe('warning')
    expect(rateTone(50)).toBe('danger')
    expect(rateTone(null)).toBe('neutral')
    expect(formatRate(92.345)).toBe('92.3%')
    expect(formatRate(null)).toBe('-')
  })
  it('presetRange', () => {
    expect(presetRange('today', '2026-10-16', shiftDate)).toEqual({
      from: '2026-10-16',
      to: '2026-10-16',
    })
    expect(presetRange('week', '2026-10-16', shiftDate)).toEqual({
      from: '2026-10-10',
      to: '2026-10-16',
    })
    expect(presetRange('month', '2026-10-16', shiftDate).from).toBe('2026-09-17')
  })
  it("textOn: rang ustida o'qiladigan matn rangi", () => {
    expect(textOn('#1e3a8a')).toBe('#ffffff')
    expect(textOn('#fde047')).toBe('#0f172a')
    expect(textOn('xxx')).toBe('#ffffff') // noto'g'ri qiymat -> standart kulrang
  })
})

describe("nearestWorkingDay (davomat boshlang'ich sanasi)", () => {
  const wd = [1, 2, 3, 4, 5, 6] // yakshanba dam
  it("bugun ish kuni bo'lsa - bugun", () => {
    expect(nearestWorkingDay('2026-10-17', wd, 3)).toBe('2026-10-17') // shanba
  })
  it('yakshanba -> shanba', () => {
    expect(nearestWorkingDay('2026-10-18', wd, 3)).toBe('2026-10-17')
  })
  it("shanba-yakshanba dam bo'lsa dushanba -> juma (backdate ichida)", () => {
    const five = [1, 2, 3, 4, 5]
    expect(nearestWorkingDay('2026-10-18', five, 3)).toBe('2026-10-16') // yakshanba -> juma (2 kun)
    expect(nearestWorkingDay('2026-10-17', five, 3)).toBe('2026-10-16')
  })
  it('backdate chegarasi: ish kuni topilmasa bugun qoladi', () => {
    expect(nearestWorkingDay('2026-10-18', [1], 3)).toBe('2026-10-18')
    expect(nearestWorkingDay('2026-10-18', [5], 2)).toBe('2026-10-16') // juma aynan chegarada
    expect(nearestWorkingDay('2026-10-18', [5], 1)).toBe('2026-10-18') // chegaradan tashqarida
  })
  it('isIsoDate', () => {
    expect(isIsoDate('2026-10-17')).toBe(true)
    expect(isIsoDate('17.10.2026')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
  })
})
