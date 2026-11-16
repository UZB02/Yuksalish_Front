import type { AnswerValue, QuestionType } from './types'

/** Variantni belgilash/olib tashlash: single - almashtiradi (qayta bosilsa bekor), multi - qo'shadi/olib tashlaydi */
export function toggleOption(
  type: QuestionType,
  current: AnswerValue,
  optionId: string,
): AnswerValue {
  if (type === 'single') return current === optionId ? null : optionId
  const list = Array.isArray(current) ? current : []
  const next = list.includes(optionId) ? list.filter((x) => x !== optionId) : [...list, optionId]
  return next.length ? next : null
}

/** Serverga yuboriladigan qiymat: bo'sh matn/ro'yxat -> null */
export function serializeValue(type: QuestionType, value: AnswerValue): AnswerValue {
  if (value === null || value === undefined) return null
  if (type === 'multi') {
    const arr = Array.isArray(value) ? [...new Set(value)] : []
    return arr.length ? arr : null
  }
  if (typeof value !== 'string') return null
  if (type === 'single') return value === '' ? null : value
  return value.trim() === '' ? null : value
}

export const TEXT_LIMITS: Record<'short' | 'essay', number> = { short: 500, essay: 10_000 }
