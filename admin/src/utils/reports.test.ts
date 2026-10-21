import { describe, expect, it } from 'vitest'
import {
  coverageTone,
  daysBetween,
  formatScore,
  parseReportQuery,
  presetOptions,
  reportRequest,
  resolvePreset,
  sortRows,
  toReportQuery,
  validatePeriod,
  visibleReportTabs,
  type ReportState,
  type YearLike,
} from './reports'

const year: YearLike = {
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: '2027-05-31T00:00:00.000Z',
  periods: [
    { name: '1-chorak', startDate: '2026-09-01', endDate: '2026-10-31' },
    { name: '2-chorak', startDate: '2026-11-04', endDate: '2026-12-28' },
  ],
}

describe('visibleReportTabs', () => {
  const all = () => true
  it("o'qituvchi faqat Sinf va O'quvchi", () => {
    expect(visibleReportTabs('teacher', all)).toEqual(['class', 'student'])
  })
  it('maktab admini 5 ta tab, Maktablar yoq', () => {
    expect(visibleReportTabs('school_admin', all)).toEqual([
      'class',
      'student',
      'teachers',
      'school',
      'behavior',
    ])
  })
  it('Maktablar tabi faqat superadmin uchun', () => {
    expect(visibleReportTabs('superadmin', all)).toContain('schools')
    expect(visibleReportTabs('school_admin', all)).not.toContain('schools')
  })
  it("reports.view yo'q yoki rol yo'q bo'lsa hech narsa", () => {
    expect(visibleReportTabs('school_admin', (p) => p !== 'reports.view')).toEqual([])
    expect(visibleReportTabs(undefined, all)).toEqual([])
  })
})

describe('validatePeriod', () => {
  const today = '2026-10-17'
  it('toliq va togri davr', () => {
    expect(validatePeriod('2026-10-01', '2026-10-17', today)).toBeNull()
  })
  it('majburiy / tartib / kelajak', () => {
    expect(validatePeriod('', '2026-10-17', today)).toBe('required')
    expect(validatePeriod('2026-10-10', '2026-10-01', today)).toBe('order')
    expect(validatePeriod('2026-10-10', '2026-10-18', today)).toBe('future')
  })
  it('366 kun chegarasi: 366 mumkin, 367 - yoq', () => {
    expect(daysBetween('2025-10-17', '2026-10-17')).toBe(366)
    expect(validatePeriod('2025-10-17', '2026-10-17', today)).toBeNull()
    expect(validatePeriod('2025-10-16', '2026-10-17', today)).toBe('tooLong')
  })
})

describe('resolvePreset', () => {
  const today = '2026-10-17'
  it('bugun / 7 kun / joriy oy', () => {
    expect(resolvePreset('today', today, null)).toEqual({ from: today, to: today })
    expect(resolvePreset('week', today, null)).toEqual({ from: '2026-10-11', to: today })
    expect(resolvePreset('month', today, null)).toEqual({ from: '2026-10-01', to: today })
  })
  it("otgan oy (yanvarda yil chegarasidan o'tadi)", () => {
    expect(resolvePreset('lastMonth', today, null)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(resolvePreset('lastMonth', '2026-01-10', null)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
    expect(resolvePreset('lastMonth', '2028-03-05', null)).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })
  it('chorak va oquv yili: kelajak chegarasi bugunga qisqaradi', () => {
    expect(resolvePreset('quarter:0', today, year)).toEqual({
      from: '2026-09-01',
      to: '2026-10-17',
    })
    expect(resolvePreset('year', today, year)).toEqual({ from: '2026-09-01', to: today })
    expect(resolvePreset('quarter:0', '2026-12-01', year)).toEqual({
      from: '2026-09-01',
      to: '2026-10-31',
    })
  })
  it('boshlanmagan chorak yoki yil yoq bolsa null', () => {
    expect(resolvePreset('quarter:1', today, year)).toBeNull()
    expect(resolvePreset('quarter:0', today, null)).toBeNull()
    expect(resolvePreset('year', today, null)).toBeNull()
    expect(resolvePreset('custom', today, year)).toBeNull()
  })
  it('tezkor tanlovlar royxati: choraklar faol yildan', () => {
    const keys = presetOptions(year).map((o) => o.value)
    expect(keys).toEqual([
      'today',
      'week',
      'month',
      'lastMonth',
      'quarter:0',
      'quarter:1',
      'year',
      'custom',
    ])
    expect(presetOptions(null).map((o) => o.value)).toEqual([
      'today',
      'week',
      'month',
      'lastMonth',
      'custom',
    ])
  })
})

describe('URL holati', () => {
  const allowed = ['class', 'student', 'teachers'] as const
  it('standart: birinchi ruxsat etilgan tab va joriy oy', () => {
    expect(parseReportQuery({}, [...allowed])).toEqual({
      tab: 'class',
      preset: 'month',
      from: '',
      to: '',
      classId: '',
      studentId: '',
    })
  })
  it('ruxsat etilmagan tab birinchisiga qaytadi', () => {
    expect(parseReportQuery({ tab: 'schools' }, [...allowed]).tab).toBe('class')
    expect(parseReportQuery({ tab: 'teachers' }, [...allowed]).tab).toBe('teachers')
  })
  it('maxsus davr: from/to saqlanadi, preset custom boladi', () => {
    const s = parseReportQuery(
      { tab: 'student', from: '2026-10-01', to: '2026-10-10', studentId: 's1' },
      [...allowed],
    )
    expect(s).toMatchObject({
      preset: 'custom',
      from: '2026-10-01',
      to: '2026-10-10',
      studentId: 's1',
    })
    expect(toReportQuery(s)).toEqual({
      tab: 'student',
      preset: 'custom',
      from: '2026-10-01',
      to: '2026-10-10',
      studentId: 's1',
    })
  })
  it('yaroqsiz sana tashlanadi; standart preset yozilmaydi', () => {
    const s = parseReportQuery({ from: 'abc', classId: 'c1' }, [...allowed])
    expect(s.from).toBe('')
    expect(toReportQuery(s)).toEqual({ tab: 'class', classId: 'c1' })
  })
  it('sinf filtri faqat uni qollaydigan tablarda yoziladi', () => {
    const base: ReportState = {
      tab: 'school',
      preset: 'week',
      from: '',
      to: '',
      classId: 'c1',
      studentId: 's1',
    }
    expect(toReportQuery(base)).toEqual({ tab: 'school', preset: 'week' })
  })
})

describe('reportRequest', () => {
  const period = { from: '2026-10-01', to: '2026-10-17' }
  const st = (over: Partial<ReportState>): ReportState => ({
    tab: 'class',
    preset: 'month',
    from: '',
    to: '',
    classId: '',
    studentId: '',
    ...over,
  })
  it('sinf va oquvchi: majburiy filtrsiz null', () => {
    expect(reportRequest(st({ tab: 'class' }), period)).toBeNull()
    expect(reportRequest(st({ tab: 'student' }), period)).toBeNull()
  })
  it('sinf hisoboti classId bilan', () => {
    expect(reportRequest(st({ tab: 'class', classId: 'c1' }), period)).toEqual({
      type: 'class',
      params: { ...period, classId: 'c1' },
    })
  })
  it('oquvchi hisoboti id ni alohida beradi', () => {
    expect(reportRequest(st({ tab: 'student', studentId: 's1', classId: 'c1' }), period)).toEqual({
      type: 'student',
      params: period,
      studentId: 's1',
    })
  })
  it('oqituvchilar/xulq: sinf ixtiyoriy', () => {
    expect(reportRequest(st({ tab: 'teachers' }), period)).toEqual({
      type: 'teachers',
      params: period,
    })
    expect(reportRequest(st({ tab: 'behavior', classId: 'c2' }), period)?.params).toEqual({
      ...period,
      classId: 'c2',
    })
    expect(reportRequest(st({ tab: 'schools' }), period)).toEqual({
      type: 'schools',
      params: period,
    })
  })
})

describe('coverageTone chegaralari', () => {
  it('<20 qizil, <50 sariq, >=50 yashil, null neytral', () => {
    expect(coverageTone(0)).toBe('danger')
    expect(coverageTone(19.9)).toBe('danger')
    expect(coverageTone(20)).toBe('warning')
    expect(coverageTone(49.9)).toBe('warning')
    expect(coverageTone(50)).toBe('success')
    expect(coverageTone(100)).toBe('success')
    expect(coverageTone(null)).toBe('neutral')
  })
})

describe('sortRows / formatScore', () => {
  const rows = [
    { n: 'b', v: 2 },
    { n: 'a', v: null },
    { n: 'c', v: 5 },
    { n: 'd', v: 2 },
  ]
  it('nullar ikkala yonalishda ham oxirida; barqaror', () => {
    expect(sortRows(rows, (r) => r.v, 'asc').map((r) => r.n)).toEqual(['b', 'd', 'c', 'a'])
    expect(sortRows(rows, (r) => r.v, 'desc').map((r) => r.n)).toEqual(['c', 'b', 'd', 'a'])
  })
  it("satr bo'yicha saralash", () => {
    expect(sortRows(rows, (r) => r.n, 'desc').map((r) => r.n)).toEqual(['d', 'c', 'b', 'a'])
  })
  it('formatScore', () => {
    expect(formatScore(null)).toBe('-')
    expect(formatScore(87.456)).toBe('87.5')
    expect(formatScore(90)).toBe('90')
  })
})
