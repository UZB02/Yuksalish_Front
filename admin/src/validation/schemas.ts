import { z } from 'zod'
import { SLUG_PATTERN } from '@/utils/slug'

export type Translate = (key: string, params?: Record<string, unknown>) => string

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/

const optionalText = (max: number, t: Translate) =>
  z.string().trim().max(max, t('validation.maxLength', { max })).optional().default('')

export function loginSchema(t: Translate) {
  return z.object({
    username: z.string().trim().min(1, t('validation.required')),
    password: z.string().min(1, t('validation.required')),
  })
}

export function schoolSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t('validation.minLength', { min: 2 }))
      .max(120, t('validation.maxLength', { max: 120 })),
    slug: z
      .string()
      .trim()
      .min(2, t('validation.minLength', { min: 2 }))
      .max(60, t('validation.maxLength', { max: 60 }))
      .regex(SLUG_PATTERN, t('validation.slug')),
    address: optionalText(255, t),
    phone: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine((v) => v === '' || PHONE_PATTERN.test(v), t('validation.phone')),
    logoUrl: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), t('validation.url')),
  })
}

const fullName = (t: Translate) =>
  z
    .string()
    .trim()
    .min(3, t('validation.minLength', { min: 3 }))
    .max(120, t('validation.maxLength', { max: 120 }))

const username = (t: Translate) =>
  z
    .string()
    .trim()
    .min(3, t('validation.minLength', { min: 3 }))
    .max(32, t('validation.maxLength', { max: 32 }))
    .regex(USERNAME_PATTERN, t('validation.username'))

const password = (t: Translate) =>
  z
    .string()
    .min(8, t('validation.minLength', { min: 8 }))
    .max(128, t('validation.maxLength', { max: 128 }))
    .regex(/[A-Za-z]/, t('validation.passwordComplexity'))
    .regex(/\d/, t('validation.passwordComplexity'))

const phoneOptional = (t: Translate) =>
  z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || PHONE_PATTERN.test(v), t('validation.phone'))

export function schoolAdminCreateSchema(t: Translate) {
  return z.object({
    schoolId: z.string().min(1, t('validation.selectSchool')),
    fullName: fullName(t),
    username: username(t),
    password: password(t),
  })
}

export function schoolAdminEditSchema(t: Translate) {
  return z.object({ fullName: fullName(t) })
}

export function teacherCreateSchema(t: Translate) {
  return z.object({
    fullName: fullName(t),
    username: username(t),
    password: password(t),
    phone: phoneOptional(t),
  })
}

export function teacherEditSchema(t: Translate) {
  return z.object({ fullName: fullName(t), phone: phoneOptional(t) })
}

export function resetPasswordSchema(t: Translate) {
  return z
    .object({
      newPassword: password(t),
      confirmPassword: z.string().min(1, t('validation.required')),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ['confirmPassword'],
      message: t('validation.passwordMismatch'),
    })
}

export function changePasswordSchema(t: Translate) {
  return z
    .object({
      currentPassword: z.string().min(1, t('validation.required')),
      newPassword: password(t),
      confirmPassword: z.string().min(1, t('validation.required')),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ['confirmPassword'],
      message: t('validation.passwordMismatch'),
    })
    .refine((v) => v.newPassword !== v.currentPassword, {
      path: ['newPassword'],
      message: t('validation.passwordSame'),
    })
}
