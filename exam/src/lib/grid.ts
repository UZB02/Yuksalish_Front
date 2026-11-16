import type { AnswerEntry, ClientQuestion } from './types'

export type CellState = 'answered' | 'flagged' | 'empty'

export const isAnswered = (v: AnswerEntry['value'] | undefined): boolean => {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  return v.trim().length > 0
}

/** Belgilangan ("keyinroq qaytaman") holat javobdan ustun turadi */
export function cellState(entry: AnswerEntry | undefined): CellState {
  if (entry?.flagged) return 'flagged'
  return isAnswered(entry?.value) ? 'answered' : 'empty'
}

export function gridCells(
  questions: readonly ClientQuestion[],
  answers: Record<string, AnswerEntry>,
): { index: number; id: string; state: CellState }[] {
  return questions.map((q, index) => ({ index, id: q.id, state: cellState(answers[q.id]) }))
}

export const countUnanswered = (
  questions: readonly ClientQuestion[],
  answers: Record<string, AnswerEntry>,
): number => questions.filter((q) => !isAnswered(answers[q.id]?.value)).length

export const countFlagged = (
  questions: readonly ClientQuestion[],
  answers: Record<string, AnswerEntry>,
): number => questions.filter((q) => answers[q.id]?.flagged).length
