import type { BehaviorKind, ScoringSettings } from '@/api/types'

export const COMMENT_MAX = 500

export const DEFAULT_SCORING: ScoringSettings = {
  minScore: 0,
  maxScore: 100,
  requireBehaviorType: true,
  commentRequiredBelow: null,
  editWindowHours: 24,
  backdateDays: 3,
  dailyAggregation: 'average',
}

/** Baholash qatori qoralamasi (forma qiymatlari). */
export interface RowDraft {
  value: string
  behaviorTypeId: string | null
  comment: string
}

/** Xato kalitlari i18n `scoring.errors.*` ga mos. */
export interface DraftErrors {
  value?: string
  behavior?: string
  comment?: string
}

export const hasErrors = (e: DraftErrors) => Object.keys(e).length > 0

/** Qoralamani sozlamalarga ko'ra tekshiradi. */
export function validateDraft(draft: RowDraft, settings: ScoringSettings): DraftErrors {
  const errors: DraftErrors = {}
  const raw = draft.value.trim()
  if (raw === '') {
    errors.value = 'required'
  } else if (!/^-?\d+$/.test(raw)) {
    errors.value = 'integer'
  } else {
    const n = Number(raw)
    if (n < settings.minScore || n > settings.maxScore) errors.value = 'range'
    else if (settings.commentRequiredBelow !== null && n < settings.commentRequiredBelow) {
      if (draft.comment.trim() === '') errors.comment = 'commentRequired'
    }
  }
  if (settings.requireBehaviorType && !draft.behaviorTypeId) errors.behavior = 'behaviorRequired'
  if (draft.comment.length > COMMENT_MAX) errors.comment = 'commentTooLong'
  return errors
}

export const isCommentRequired = (draft: RowDraft, settings: ScoringSettings): boolean => {
  const raw = draft.value.trim()
  return (
    settings.commentRequiredBelow !== null &&
    /^-?\d+$/.test(raw) &&
    Number(raw) < settings.commentRequiredBelow
  )
}

export const draftsEqual = (a: RowDraft, b: RowDraft) =>
  a.value.trim() === b.value.trim() &&
  a.behaviorTypeId === b.behaviorTypeId &&
  a.comment.trim() === b.comment.trim()

// ---- Sanalar (Asia/Tashkent) ----
const pad = (n: number) => String(n).padStart(2, '0')

/** Bugungi sana 'YYYY-MM-DD' Asia/Tashkent vaqt mintaqasida. */
export function todayTashkent(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts // en-CA: YYYY-MM-DD
}

/** 'YYYY-MM-DD' sanasini `days` kunga siljitadi (vaqt mintaqasidan mustaqil). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Baholash mumkin bo'lgan sana oralig'i: [bugun - backdateDays, bugun]. */
export function dateBounds(today: string, backdateDays: number) {
  return { min: shiftDate(today, -Math.max(0, backdateDays)), max: today }
}

export const isDateAllowed = (date: string, today: string, backdateDays: number) => {
  const { min, max } = dateBounds(today, backdateDays)
  return date >= min && date <= max
}

// ---- Tezkor ballar ----
/** 100/90/80/70/60 ni [min..max] diapazoniga moslaydi (takrorlanmaydi, kamayish tartibida). */
export function quickScores(settings: Pick<ScoringSettings, 'minScore' | 'maxScore'>): number[] {
  const { minScore: min, maxScore: max } = settings
  const out = [1, 0.9, 0.8, 0.7, 0.6].map((f) => Math.round(min + (max - min) * f))
  return [...new Set(out)]
}

export const kindTone: Record<BehaviorKind, 'success' | 'danger' | 'neutral'> = {
  positive: 'success',
  negative: 'danger',
  neutral: 'neutral',
}

/** Chip foni uchun `#RRGGBB` + alfa (8 xonali hex). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `${hex}${a.toString(16).padStart(2, '0')}`
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * Tanlovni faqat ko'rinadigan qatorlar bilan cheklaydi (filtr yoki saqlashdan keyin yashirin
 * qolgan qatorlar tanlovdan chiqariladi). O'chirilganlar sonini qaytaradi.
 */
export function pruneSelection(selected: Set<string>, visibleIds: readonly string[]): number {
  const keep = new Set(visibleIds)
  let removed = 0
  for (const id of [...selected]) {
    if (!keep.has(id)) {
      selected.delete(id)
      removed++
    }
  }
  return removed
}
