import type { GradeValue } from '@/api/types'

/** Fan bahosi (bilim bahosi) qiymatlari */
export const GRADE_VALUES: readonly GradeValue[] = [2, 3, 4, 5]
export const GRADE_COMMENT_MAX = 500

/** Fan bahosi 100 ballik shkalada: 5 -> 100, 4 -> 80 (reyting formulasi bilan bir xil). */
export const GRADE_TO_100 = 20
export const gradeTo100 = (avg: number): number => Math.round(avg * GRADE_TO_100 * 100) / 100

/** Baho qatori qoralamasi: qiymat tanlanmagan bo'lsa null. */
export interface GradeDraft {
  value: number | null
  comment: string
}

/** Xato kalitlari i18n `grading.errors.*` ga mos. */
export interface GradeDraftErrors {
  value?: string
  comment?: string
}

export const gradeDraftsEqual = (a: GradeDraft, b: GradeDraft) =>
  a.value === b.value && a.comment.trim() === b.comment.trim()

export function validateGradeDraft(d: GradeDraft): GradeDraftErrors {
  const e: GradeDraftErrors = {}
  if (d.value === null) e.value = 'required'
  else if (!GRADE_VALUES.includes(d.value as GradeValue)) e.value = 'range'
  if (d.comment.length > GRADE_COMMENT_MAX) e.comment = 'commentTooLong'
  return e
}

type Tone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral'

/** Baho rangi: 5 - yashil, 4 - ko'k, 3 - sariq, 2 - qizil. */
export function gradeTone(value: number | null | undefined): Tone {
  switch (value) {
    case 5:
      return 'success'
    case 4:
      return 'primary'
    case 3:
      return 'warning'
    case 2:
      return 'danger'
    default:
      return 'neutral'
  }
}

/** O'rtacha bahoni ko'rsatish: 4.5 -> "4,50" emas, mavjud format bilan mos "4.5". */
export const fmtAvg = (v: number | null | undefined): string =>
  v === null || v === undefined ? '-' : String(Math.round(v * 100) / 100)
