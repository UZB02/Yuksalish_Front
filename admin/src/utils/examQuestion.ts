import type {
  Question,
  QuestionAnswer,
  QuestionBlock,
  QuestionDifficulty,
  QuestionOption,
  QuestionPayload,
  QuestionSharing,
  QuestionType,
} from '@/api/types'

/** Serverdagi chegaralar bilan bir xil (Yuksalish_backend: questions.schema.ts LIMITS) */
export const QUESTION_LIMITS = {
  textChars: 5000,
  texChars: 2000,
  topicChars: 200,
  blocks: 30,
  optionBlocks: 5,
  options: 10,
  acceptedAnswers: 20,
  acceptedAnswerChars: 200,
  rubricChars: 5000,
  maxPoints: 100,
} as const

export const QUESTION_TYPES: QuestionType[] = ['single', 'multi', 'short', 'essay']
export const DIFFICULTIES: QuestionDifficulty[] = [1, 2, 3]

/** Tahrirlash formasi holati (UI uchun qulay shakl) */
export interface QuestionForm {
  /** Fan (faqat mavzular ro'yxatini tanlash uchun; serverga yuborilmaydi, fan mavzudan olinadi) */
  subjectId: string
  topicId: string
  difficulty: QuestionDifficulty
  type: QuestionType
  content: QuestionBlock[]
  options: QuestionOption[]
  /** single */
  correctOptionId: string
  /** multi */
  correctOptionIds: string[]
  partialCredit: boolean
  /** short */
  acceptedAnswers: string[]
  /** essay */
  rubric: string
  points: number
  status: 'draft' | 'active'
  /** Ulashish (muallif yoki ma'muriyat o'zgartiradi) */
  sharing: QuestionSharing
}

export type FormErrors = Record<string, string>

// ---------- Bloklar ----------

export const emptyBlock = (type: QuestionBlock['type']): QuestionBlock =>
  type === 'text'
    ? { type: 'text', text: '' }
    : type === 'math'
      ? { type: 'math', tex: '' }
      : { type: 'image', assetId: '' }

export function addBlock(
  blocks: QuestionBlock[],
  block: QuestionBlock,
  max: number = QUESTION_LIMITS.blocks,
): QuestionBlock[] {
  return blocks.length >= max ? blocks : [...blocks, block]
}

export function removeBlock(blocks: QuestionBlock[], index: number): QuestionBlock[] {
  return blocks.filter((_, i) => i !== index)
}

/** Blokni `delta` (-1 yuqoriga, +1 pastga) siljitadi; chegaradan chiqsa o'zgarmaydi */
export function moveBlock(blocks: QuestionBlock[], index: number, delta: -1 | 1): QuestionBlock[] {
  const to = index + delta
  if (index < 0 || index >= blocks.length || to < 0 || to >= blocks.length) return blocks
  const next = [...blocks]
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item!)
  return next
}

export function updateBlock(
  blocks: QuestionBlock[],
  index: number,
  patch: Partial<{ text: string; tex: string; assetId: string }>,
): QuestionBlock[] {
  return blocks.map((b, i) => (i === index ? ({ ...b, ...patch } as QuestionBlock) : b))
}

/** Bo'sh bo'lmagan blokmi (matn/formula bo'sh emas, rasm yuklangan) */
export const isBlockFilled = (b: QuestionBlock): boolean =>
  b.type === 'text'
    ? b.text.trim().length > 0
    : b.type === 'math'
      ? b.tex.trim().length > 0
      : !!b.assetId

// ---------- Variantlar ----------

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

/** Yangi variant identifikatori: a, b, c ... (band bo'lmaganlaridan birinchisi) */
export function nextOptionId(options: QuestionOption[]): string {
  const used = new Set(options.map((o) => o.id))
  for (const ch of ID_ALPHABET) if (!used.has(ch)) return ch
  let n = options.length + 1
  while (used.has(`o${n}`)) n++
  return `o${n}`
}

export function addOption(options: QuestionOption[]): QuestionOption[] {
  if (options.length >= QUESTION_LIMITS.options) return options
  return [...options, { id: nextOptionId(options), content: [{ type: 'text', text: '' }] }]
}

/** Variantni o'chiradi; to'g'ri javoblar ro'yxatidan ham chiqariladi */
export function removeOption(form: QuestionForm, id: string): QuestionForm {
  return {
    ...form,
    options: form.options.filter((o) => o.id !== id),
    correctOptionId: form.correctOptionId === id ? '' : form.correctOptionId,
    correctOptionIds: form.correctOptionIds.filter((x) => x !== id),
  }
}

export function toggleCorrect(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

// ---------- Forma <-> server ----------

export const defaultForm = (subjectId = '', topicId = ''): QuestionForm => ({
  subjectId,
  topicId,
  difficulty: 2,
  type: 'single',
  content: [{ type: 'text', text: '' }],
  options: [
    { id: 'a', content: [{ type: 'text', text: '' }] },
    { id: 'b', content: [{ type: 'text', text: '' }] },
  ],
  correctOptionId: '',
  correctOptionIds: [],
  partialCredit: false,
  acceptedAnswers: [],
  rubric: '',
  points: 1,
  status: 'draft',
  sharing: { mode: 'private', userIds: [] },
})

export function formFromQuestion(q: Question): QuestionForm {
  const a: QuestionAnswer = q.answer ?? {}
  return {
    subjectId: q.subjectId,
    topicId: q.topicId,
    difficulty: q.difficulty,
    type: q.type,
    content: q.content.map((b) => ({ ...b })),
    options: q.options.map((o) => ({ id: o.id, content: o.content.map((b) => ({ ...b })) })),
    correctOptionId: a.optionId ?? '',
    correctOptionIds: [...(a.optionIds ?? [])],
    partialCredit: a.partialCredit ?? false,
    acceptedAnswers: [...(a.acceptedAnswers ?? [])],
    rubric: a.rubric ?? '',
    points: q.points,
    status: q.status === 'archived' ? 'draft' : q.status,
    sharing: { mode: q.sharing?.mode ?? 'private', userIds: [...(q.sharing?.userIds ?? [])] },
  }
}

/** Turga mos javob kaliti (serverga faqat kerakli maydonlar yuboriladi) */
export function answerOf(f: QuestionForm): QuestionAnswer {
  if (f.type === 'single') return { optionId: f.correctOptionId }
  if (f.type === 'multi') return { optionIds: f.correctOptionIds, partialCredit: f.partialCredit }
  if (f.type === 'short') return { acceptedAnswers: f.acceptedAnswers }
  return f.rubric.trim() ? { rubric: f.rubric.trim() } : {}
}

export function toPayload(f: QuestionForm): QuestionPayload {
  const hasOptions = f.type === 'single' || f.type === 'multi'
  return {
    topicId: f.topicId,
    difficulty: f.difficulty,
    type: f.type,
    content: f.content,
    options: hasOptions ? f.options : [],
    answer: answerOf(f),
    points: f.points,
    status: f.status,
    sharing: {
      mode: f.sharing.mode,
      userIds: f.sharing.mode === 'users' ? f.sharing.userIds : [],
    },
  }
}

/** Qisqa javoblar ro'yxatiga qo'shish: bo'shlar tashlanadi, takrorlar (katta-kichik harfsiz) va limit */
export function addAcceptedAnswer(list: string[], raw: string): string[] {
  const v = raw.trim().slice(0, QUESTION_LIMITS.acceptedAnswerChars)
  if (!v || list.length >= QUESTION_LIMITS.acceptedAnswers) return list
  if (list.some((x) => x.trim().toLowerCase() === v.toLowerCase())) return list
  return [...list, v]
}

// ---------- Tekshiruv (server qoidalari aksi; server baribir qayta tekshiradi) ----------

export function validateForm(f: QuestionForm, t: (key: string, p?: object) => string): FormErrors {
  const e: FormErrors = {}
  if (!f.subjectId) e.subjectId = t('exams.errors.subject')
  if (!f.topicId) e.topicId = t('exams.errors.topic')
  if (!f.content.length || !f.content.some(isBlockFilled))
    e.content = t('exams.errors.contentEmpty')
  else if (f.content.some((b) => !isBlockFilled(b))) e.content = t('exams.errors.blockEmpty')
  if (!(f.points > 0) || f.points > QUESTION_LIMITS.maxPoints) {
    e.points = t('exams.errors.points', { n: QUESTION_LIMITS.maxPoints })
  }
  if (f.type === 'single' || f.type === 'multi') {
    if (f.options.length < 2) e.options = t('exams.errors.optionsMin')
    else if (f.options.some((o) => !o.content.length || !o.content.every(isBlockFilled))) {
      e.options = t('exams.errors.optionEmpty')
    }
    if (f.type === 'single' && !f.options.some((o) => o.id === f.correctOptionId)) {
      e.answer = t('exams.errors.correctSingle')
    }
    if (
      f.type === 'multi' &&
      !f.correctOptionIds.some((id) => f.options.some((o) => o.id === id))
    ) {
      e.answer = t('exams.errors.correctMulti')
    }
  }
  if (f.sharing.mode === 'users' && f.sharing.userIds.length === 0) {
    e.sharing = t('exams.errors.sharingUsers')
  }
  if (f.type === 'short' && f.acceptedAnswers.length === 0) {
    e.answer = t('exams.errors.acceptedMin')
  }
  return e
}
