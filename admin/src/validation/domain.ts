import { z } from 'zod'
import type { AcademicPeriod } from '@/api/types'
import type { Translate } from './schemas'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/

const requiredDate = (t: Translate) =>
  z.string().min(1, t('validation.required')).regex(DATE_PATTERN, t('validation.date'))

const optionalDate = (t: Translate) =>
  z
    .string()
    .optional()
    .default('')
    .refine((v) => v === '' || DATE_PATTERN.test(v), t('validation.date'))

// ---- O'quv yili ----
export function academicYearSchema(t: Translate) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(3, t('validation.minLength', { min: 3 }))
        .max(40, t('validation.maxLength', { max: 40 })),
      startDate: requiredDate(t),
      endDate: requiredDate(t),
    })
    .refine((v) => !v.startDate || !v.endDate || v.startDate < v.endDate, {
      path: ['endDate'],
      message: t('validation.endAfterStart'),
    })
}

export interface PeriodError {
  name?: string
  startDate?: string
  endDate?: string
}

/** Choraklarni tekshiradi; har bir chorak uchun xato obyekti (bo'sh obyekt = to'g'ri). */
export function validatePeriods(
  periods: AcademicPeriod[],
  year: { startDate: string; endDate: string },
  t: Translate,
): PeriodError[] {
  return periods.map((p, i) => {
    const err: PeriodError = {}
    if (p.name.trim().length === 0) err.name = t('validation.required')
    if (!DATE_PATTERN.test(p.startDate)) err.startDate = t('validation.required')
    if (!DATE_PATTERN.test(p.endDate)) err.endDate = t('validation.required')
    if (!err.startDate && !err.endDate && p.startDate >= p.endDate) {
      err.endDate = t('validation.endAfterStart')
    }
    if (!err.startDate && year.startDate && p.startDate < year.startDate) {
      err.startDate = t('validation.periodOutside')
    }
    if (!err.endDate && year.endDate && p.endDate > year.endDate) {
      err.endDate = t('validation.periodOutside')
    }
    // Keyingi chorak oldingisi tugagandan KEYIN boshlanishi kerak (kesishmaydi va tutashmaydi).
    const prev = periods[i - 1]
    if (!err.startDate && prev && DATE_PATTERN.test(prev.endDate) && p.startDate <= prev.endDate) {
      err.startDate = t('validation.periodOverlap')
    }
    return err
  })
}

export const hasPeriodErrors = (errors: PeriodError[]) =>
  errors.some((e) => Object.keys(e).length > 0)

// ---- Sinf ----
export function classSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation.required'))
      .max(30, t('validation.maxLength', { max: 30 })),
    grade: z
      .string()
      .min(1, t('validation.required'))
      .refine((v) => /^\d+$/.test(v) && +v >= 1 && +v <= 11, t('validation.grade')),
    section: z
      .string()
      .trim()
      .max(5, t('validation.maxLength', { max: 5 }))
      .optional()
      .default(''),
    academicYearId: z.string().optional().default(''),
    homeroomTeacherId: z.string().optional().default(''),
  })
}

// ---- O'quvchi ----
export function studentSchema(t: Translate) {
  const today = new Date().toISOString().slice(0, 10)
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(3, t('validation.minLength', { min: 3 }))
      .max(120, t('validation.maxLength', { max: 120 })),
    classId: z.string().min(1, t('validation.selectClass')),
    birthDate: optionalDate(t).refine((v) => v === '' || v <= today, t('validation.birthFuture')),
    gender: z
      .string()
      .optional()
      .default('')
      .refine((v) => v === '' || v === 'male' || v === 'female', t('validation.gender')),
    studentCode: z
      .string()
      .trim()
      .max(30, t('validation.maxLength', { max: 30 }))
      .optional()
      .default(''),
    parentPhone: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine((v) => v === '' || PHONE_PATTERN.test(v), t('validation.phone')),
  })
}

// ---- Xulq turi ----
const optionalInt = (t: Translate) =>
  z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || /^\d+$/.test(v), t('validation.integer'))

export function behaviorTypeSchema(t: Translate) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, t('validation.minLength', { min: 2 }))
        .max(60, t('validation.maxLength', { max: 60 })),
      kind: z.enum(['positive', 'negative', 'neutral'], { message: t('validation.required') }),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('validation.color')),
      order: z
        .string()
        .trim()
        .min(1, t('validation.required'))
        .refine((v) => /^\d+$/.test(v), t('validation.integer')),
      minScore: optionalInt(t),
      maxScore: optionalInt(t),
      schoolId: z.string().optional().default(''),
    })
    .refine(
      (v) => v.minScore === '' || v.maxScore === '' || Number(v.minScore) <= Number(v.maxScore),
      {
        path: ['maxScore'],
        message: t('validation.rangeOrder'),
      },
    )
}

// ---- Davomat holati ----
export function attendanceStatusSchema(t: Translate) {
  return (
    z
      .object({
        name: z
          .string()
          .trim()
          .min(2, t('validation.minLength', { min: 2 }))
          .max(40, t('validation.maxLength', { max: 40 })),
        shortName: z
          .string()
          .trim()
          .min(1, t('validation.required'))
          .max(4, t('validation.maxLength', { max: 4 })),
        category: z.enum(['present', 'late', 'absent_excused', 'absent_unexcused'], {
          message: t('validation.required'),
        }),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('validation.color')),
        order: z
          .string()
          .trim()
          .min(1, t('validation.required'))
          .refine((v) => /^\d+$/.test(v), t('validation.integer')),
        isDefault: z.boolean(),
        schoolId: z.string().optional().default(''),
      })
      // Standart holat faqat "keldi" kategoriyasida bo'ladi
      .refine((v) => !v.isDefault || v.category === 'present', {
        path: ['isDefault'],
        message: t('attendanceStatuses.defaultOnlyPresent'),
      })
  )
}
