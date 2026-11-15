import type { ExamImportItem, ExamImportOverride, QuestionAnswer, QuestionType } from '@/api/types'
import { defaultForm, validateForm, type QuestionForm } from './examQuestion'

/** Oldindan ko'rishdagi qator holati: joriy (tahrirlangan) nusxa, asl nusxa va chiqarib tashlash belgisi */
export interface ImportRowState {
  original: ExamImportItem
  item: ExamImportItem
  excluded: boolean
}

export const toRowStates = (items: ExamImportItem[]): ImportRowState[] =>
  items.map((original) => ({
    original,
    item: JSON.parse(JSON.stringify(original)) as ExamImportItem,
    excluded: false,
  }))

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Qator tuzatilganmi (fan, tur, javob, qiyinlik, ball, mavzu) */
export function isEdited(r: ImportRowState): boolean {
  const a = r.original
  const b = r.item
  return !(
    a.type === b.type &&
    a.difficulty === b.difficulty &&
    a.points === b.points &&
    sameJson(a.answer, b.answer)
  )
}

export function formFromItem(item: ExamImportItem): QuestionForm {
  // Fan va mavzu import nishonidan: tekshiruvda to'ldirilgan deb olinadi
  const f = defaultForm(item.subjectId ?? 'import', 'import')
  const a = item.answer
  return {
    ...f,
    difficulty: (item.difficulty >= 1 && item.difficulty <= 3 ? item.difficulty : 2) as 1 | 2 | 3,
    type: item.type ?? 'single',
    content: item.content,
    options: item.options,
    correctOptionId: a.optionId ?? '',
    correctOptionIds: a.optionIds ?? [],
    partialCredit: a.partialCredit ?? false,
    acceptedAnswers: a.acceptedAnswers ?? [],
    rubric: a.rubric ?? '',
    points: item.points,
  }
}

/**
 * Qator xatolari: tahrirlanmagan qator uchun serverning xatolari; tahrirlangan qator uchun mijozda qayta
 * hisoblanadi (server baribir import paytida hammasini qayta tekshiradi).
 */
export function rowErrors(r: ImportRowState, t: (k: string, p?: object) => string): string[] {
  if (!isEdited(r)) return r.item.errors
  const errs = Object.values(validateForm(formFromItem(r.item), t))
  if (!r.item.type) errs.unshift(t('exams.import.typeUnknown'))
  return errs
}

export const isRowImportable = (r: ImportRowState, t: (k: string, p?: object) => string) =>
  !r.excluded && rowErrors(r, t).length === 0

/** Serverga yuboriladigan tuzatishlar: faqat o'zgargan maydonlar */
export function buildOverrides(rows: ImportRowState[]): ExamImportOverride[] {
  const out: ExamImportOverride[] = []
  for (const r of rows) {
    if (r.excluded || !isEdited(r)) continue
    const o: ExamImportOverride = { row: r.item.row }
    if (r.item.type && r.item.type !== r.original.type) o.type = r.item.type
    if (r.item.difficulty !== r.original.difficulty) o.difficulty = r.item.difficulty
    if (r.item.points !== r.original.points) o.points = r.item.points
    if (!sameJson(r.item.answer, r.original.answer) || o.type)
      o.answer = cleanAnswer(r.item.type, r.item.answer)
    out.push(o)
  }
  return out
}

function cleanAnswer(type: QuestionType | null, a: QuestionAnswer): QuestionAnswer {
  if (type === 'single') return a.optionId ? { optionId: a.optionId } : {}
  if (type === 'multi')
    return { optionIds: a.optionIds ?? [], partialCredit: a.partialCredit ?? false }
  if (type === 'short') return { acceptedAnswers: a.acceptedAnswers ?? [] }
  return a.rubric ? { rubric: a.rubric } : {}
}

/** Tur almashganda variantlar/javob moslanadi (kerak bo'lsa variantlar bo'sh qoladi, xato ko'rsatiladi) */
export function changeType(item: ExamImportItem, type: QuestionType): ExamImportItem {
  const prev = item.answer
  let answer: QuestionAnswer = {}
  if (type === 'multi')
    answer = {
      optionIds: prev.optionId ? [prev.optionId] : (prev.optionIds ?? []),
      partialCredit: false,
    }
  else if (type === 'single') answer = { optionId: prev.optionId ?? prev.optionIds?.[0] }
  else if (type === 'short') answer = { acceptedAnswers: prev.acceptedAnswers ?? [] }
  return { ...item, type, answer }
}
