import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { TimetableOptions, TimetableWarning } from '@/api/timetable.api'
import {
  buildIssues,
  busyClassesOf,
  cellIssueSummary,
  countIssues,
  formatIssue,
  issueContextFrom,
  issuesByCell,
  issueTooltip,
  previewCellWarnings,
} from './timetableIssues'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const t = i18n.global.t as (k: string, n?: Record<string, unknown>) => string

const W = (over: Partial<TimetableWarning> = {}): TimetableWarning => ({
  code: 'teacher_double_booked',
  severity: 'error',
  weekday: 1,
  lessonNo: 1,
  subjectId: 'inf',
  teacherId: 't1',
  message: 'server xabari',
  other: { classId: 'c2', className: '1-B', versionId: 'v', validFrom: '', validTo: null },
  ...over,
})

const OPTS = {
  subjects: [{ id: 'inf', name: 'Informatika' }],
  teachers: [
    { id: 't1', fullName: 'Mirzamatov Muhsinbek' },
    { id: 't2', fullName: 'Karimov' },
  ],
  classAssignments: [{ subjectId: 'inf', teacherId: 't2' }],
  subjectTeachers: {},
} as unknown as TimetableOptions
const ctx = issueContextFrom(OPTS)

describe('formatIssue', () => {
  it("o'qituvchi band: sarlavha, tushuntirish va katak yorlig'i", () => {
    const i = formatIssue(W(), t, ctx)
    expect(i.title).toBe("O'qituvchi band")
    expect(i.text).toBe('Mirzamatov Muhsinbek dushanba, 1-darsda 1-B sinfida ham dars beradi.')
    expect(i.cellLabel).toBe('Dush · 1-dars · Informatika')
    expect(i.otherClass).toEqual({ id: 'c2', name: '1-B' })
    expect(i.severity).toBe('error')
  })

  it("bir nechta versiya bo'lsa qo'shimcha gap; kontekst bo'lmasa umumiy matn", () => {
    const versions = [
      { versionId: 'a', validFrom: '', validTo: null },
      { versionId: 'b', validFrom: '', validTo: null },
    ]
    const w = W({ other: { ...W().other!, versions } })
    expect(formatIssue(w, t, ctx).text).toContain("2 ta versiyasida to'qnashadi")
    const bare = formatIssue(W(), t)
    expect(bare.text).toBe("O'qituvchi dushanba, 1-darsda 1-B sinfida ham dars beradi.")
    expect(bare.cellLabel).toBe('Dush · 1-dars')
  })

  it("biriktirish: boshqa o'qituvchi biriktirilgan yoki fan biriktirilmagan", () => {
    const w = W({ code: 'teacher_not_assigned', severity: 'warning', other: undefined })
    const a = formatIssue(w, t, ctx)
    expect(a.title).toBe("Boshqa o'qituvchi biriktirilgan")
    expect(a.text).toContain('biriktirilgan: Karimov')
    expect(a.text).toContain('jadvalda: Mirzamatov Muhsinbek')
    const b = formatIssue(w, t, issueContextFrom({ ...OPTS, classAssignments: [] }))
    expect(b.title).toBe('Fan sinfga biriktirilmagan')
    expect(b.severity).toBe('warning')
  })

  it("nofaol fan/o'qituvchi va dam olish kuni", () => {
    const base = { severity: 'warning' as const, other: undefined }
    expect(formatIssue(W({ ...base, code: 'subject_inactive' }), t, ctx).title).toBe('Fan nofaol')
    expect(formatIssue(W({ ...base, code: 'teacher_inactive' }), t, ctx).title).toBe(
      "O'qituvchi nofaol",
    )
    const o = formatIssue(W({ ...base, code: 'out_of_range', weekday: 7 }), t, ctx)
    expect(o.title).toBe("Dam olish kuniga qo'yilgan")
    expect(o.text).toContain('yakshanba')
  })

  it("noma'lum kod: server xabari zaxira sifatida", () => {
    const i = formatIssue(W({ code: 'future_code' as never }), t, ctx)
    expect(i.text).toBe('server xabari')
    expect(i.title).toBe('Xato')
  })
})

describe('buildIssues', () => {
  it('takrorlarni olib tashlaydi, xatolar birinchi, so`ng kun/dars bo`yicha', () => {
    const warn = W({ code: 'subject_inactive', severity: 'warning', other: undefined, weekday: 1 })
    const list = buildIssues(
      [
        warn,
        W({ weekday: 3, lessonNo: 2 }),
        W({ weekday: 3, lessonNo: 2 }), // takror
        W({ weekday: 2, lessonNo: 1 }),
        // boshqa sinf bilan to'qnashuv takror emas
        W({ weekday: 2, lessonNo: 1, other: { ...W().other!, classId: 'c3', className: '1-V' } }),
      ],
      t,
      ctx,
    )
    expect(list.map((i) => `${i.severity}:${i.weekday}:${i.lessonNo}`)).toEqual([
      'error:2:1',
      'error:2:1',
      'error:3:2',
      'warning:1:1',
    ])
    expect(countIssues(list)).toEqual({ error: 3, warning: 1, total: 4 })
  })

  it('katak bo`yicha guruhlash, aria xulosa va tooltip', () => {
    const list = buildIssues(
      [W(), W({ code: 'teacher_not_assigned', severity: 'warning', other: undefined })],
      t,
      ctx,
    )
    const map = issuesByCell(list)
    expect(Object.keys(map)).toEqual(['1:1'])
    expect(cellIssueSummary(map['1:1'], t)).toBe('1 ta xato, 1 ta ogohlantirish')
    expect(cellIssueSummary(undefined, t)).toBe('')
    expect(issueTooltip(map['1:1']).split('\n')).toHaveLength(2)
    expect(issueTooltip(undefined)).toBe('')
  })
})

describe('jonli ko`rinish va band o`qituvchilar', () => {
  const busy = [
    { teacherId: 't1', classId: 'c2', className: '1-B' },
    { teacherId: 't1', classId: 'c2', className: '1-B' },
    { teacherId: 't1', classId: 'c3', className: '2-A' },
  ]
  it('busyClassesOf noyob sinflarni qaytaradi', () => {
    expect(busyClassesOf(busy, 't1')).toEqual(['1-B', '2-A'])
    expect(busyClassesOf(busy, 't2')).toEqual([])
  })

  it('previewCellWarnings: har bir band sinf uchun bitta xato + biriktirish ogohlantirishi', () => {
    const base = { weekday: 1, lessonNo: 1, options: OPTS, busy }
    const w = previewCellWarnings({ ...base, subjectId: 'inf', teacherId: 't1' })
    expect(w.filter((x) => x.code === 'teacher_double_booked')).toHaveLength(2)
    expect(w.some((x) => x.code === 'teacher_not_assigned')).toBe(true)
    // biriktirilgan va band emas -> muammo yo'q
    expect(previewCellWarnings({ ...base, subjectId: 'inf', teacherId: 't2' })).toEqual([])
    expect(previewCellWarnings({ ...base, subjectId: '', teacherId: 't1' })).toEqual([])
  })
})
