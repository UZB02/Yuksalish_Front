import { describe, expect, it } from 'vitest'
import {
  academicYearSchema,
  classSchema,
  hasPeriodErrors,
  studentSchema,
  validatePeriods,
} from './domain'

const t = (k: string) => k

describe('studentSchema', () => {
  const valid = { fullName: 'Aliyev Vali', classId: 'c1' }

  it("minimal to'g'ri ma'lumot qabul qilinadi, ixtiyoriy maydonlar bo'sh satr", () => {
    const r = studentSchema(t).safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toMatchObject({ birthDate: '', gender: '', studentCode: '' })
  })

  it('F.I.Sh. va sinf majburiy', () => {
    const r = studentSchema(t).safeParse({ fullName: 'Al', classId: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toEqual(expect.arrayContaining(['fullName', 'classId']))
    }
  })

  it("kelajakdagi tug'ilgan sana, noto'g'ri jins va telefon rad etiladi", () => {
    const bad = studentSchema(t).safeParse({
      ...valid,
      birthDate: '2999-01-01',
      gender: 'x',
      parentPhone: 'abc',
    })
    expect(bad.success).toBe(false)
    const ok = studentSchema(t).safeParse({
      ...valid,
      birthDate: '2012-05-01',
      gender: 'female',
      parentPhone: '+998 90 123 45 67',
    })
    expect(ok.success).toBe(true)
  })
})

describe('classSchema / academicYearSchema', () => {
  it("parallel 1-11 oralig'ida", () => {
    expect(classSchema(t).safeParse({ name: '7-A', grade: '7' }).success).toBe(true)
    expect(classSchema(t).safeParse({ name: '12-A', grade: '12' }).success).toBe(false)
  })

  it("tugash sanasi boshlanishdan keyin bo'lishi kerak", () => {
    const base = { name: '2026-2027' }
    expect(
      academicYearSchema(t).safeParse({ ...base, startDate: '2026-09-01', endDate: '2027-05-31' })
        .success,
    ).toBe(true)
    expect(
      academicYearSchema(t).safeParse({ ...base, startDate: '2027-05-31', endDate: '2026-09-01' })
        .success,
    ).toBe(false)
  })
})

describe('validatePeriods', () => {
  const year = { startDate: '2026-09-01', endDate: '2027-05-31' }

  it("to'g'ri choraklar xatosiz", () => {
    const errs = validatePeriods(
      [{ name: '1-chorak', startDate: '2026-09-01', endDate: '2026-11-01' }],
      year,
      t,
    )
    expect(hasPeriodErrors(errs)).toBe(false)
  })

  it("yil oralig'idan tashqari, tartibi noto'g'ri va nomsiz chorak", () => {
    const errs = validatePeriods(
      [
        { name: '', startDate: '2026-09-01', endDate: '2026-10-01' },
        { name: 'A', startDate: '2026-08-01', endDate: '2026-10-01' },
        { name: 'B', startDate: '2026-12-01', endDate: '2026-11-01' },
      ],
      year,
      t,
    )
    expect(errs[0]!.name).toBeDefined()
    expect(errs[1]!.startDate).toBe('validation.periodOutside')
    expect(errs[2]!.endDate).toBe('validation.endAfterStart')
  })

  it('keyingi chorak oldingisi tugaganidan KEYIN boshlanishi kerak (tutashmaydi)', () => {
    const errs = validatePeriods(
      [
        { name: 'A', startDate: '2026-09-01', endDate: '2026-11-01' },
        { name: 'B', startDate: '2026-11-01', endDate: '2026-12-20' },
        { name: 'C', startDate: '2026-12-21', endDate: '2027-02-01' },
      ],
      year,
      t,
    )
    expect(errs[1]!.startDate).toBe('validation.periodOverlap')
    expect(errs[2]).toEqual({})
  })
})
