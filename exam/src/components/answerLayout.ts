import type { ClientQuestion } from '../lib/types'

/** Variant matni shu belgidan oshmasa "qisqa" hisoblanadi */
export const SHORT_OPTION_MAX = 40

/**
 * Keng ekranda (xl+) variantlarni 2 ustunga joylash mumkinmi: kamida 2 ta variant, hammasi faqat matn
 * (rasm/formula yo'q) va har biri SHORT_OPTION_MAX belgidan oshmaydi. Sof funksiya.
 */
export function optionsFitTwoColumns(question: Pick<ClientQuestion, 'type' | 'options'>): boolean {
  if (question.type !== 'single' && question.type !== 'multi') return false
  if (question.options.length < 2) return false
  return question.options.every((o) => {
    if (!o.content.length || o.content.some((b) => b.type !== 'text')) return false
    const len = o.content.reduce((n, b) => n + (b.type === 'text' ? b.text.trim().length : 0), 0)
    return len > 0 && len <= SHORT_OPTION_MAX
  })
}
