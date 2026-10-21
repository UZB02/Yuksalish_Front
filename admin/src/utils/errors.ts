import type { ApiError } from '@/api/errors'
import { isApiError } from '@/api/errors'

type Translate = (key: string) => string

/** ApiError ni foydalanuvchiga tushunarli o'zbekcha xabarga aylantiradi. */
export function errorMessage(e: unknown, t: Translate): string {
  if (!isApiError(e)) return t('errors.unknown')
  const key = `errors.codes.${e.code}`
  const text = t(key)
  return text === key ? t('errors.unknown') : text
}

/**
 * Serverdan kelgan details ([{path, message}]) ni forma maydonlariga bog'laydi.
 * Qaytaradi: maydonga bog'lanmagan (umumiy) xato bormi.
 */
export function applyServerErrors(
  e: unknown,
  setErrors: (errors: Record<string, string>) => void,
  knownFields: readonly string[],
): boolean {
  if (!isApiError(e) || e.details.length === 0) return false
  const mapped: Record<string, string> = {}
  for (const d of e.details) {
    const field = d.path.split('.').pop() ?? d.path
    if (knownFields.includes(field) && !mapped[field]) mapped[field] = d.message
  }
  if (Object.keys(mapped).length === 0) return false
  setErrors(mapped)
  return true
}

export function isConflictOrValidation(e: unknown): e is ApiError {
  return isApiError(e) && (e.code === 'CONFLICT' || e.code === 'VALIDATION_ERROR')
}

/** Eksport xatosi: 403 - ruxsat yo'q; 400 - serverning aniq xabari (masalan, "Davrni qisqartiring"). */
export function exportErrorMessage(e: unknown, t: Translate): string {
  if (isApiError(e)) {
    if (e.status === 403) return t('reports.exportForbidden')
    if (e.status === 400) {
      const detail = e.details[0]?.message
      if (detail) return detail
      if (e.message && e.message !== 'Request failed') return e.message
    }
  }
  return errorMessage(e, t)
}
