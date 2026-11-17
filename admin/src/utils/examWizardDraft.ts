import type {
  ExamBlockInput,
  ExamResultsMode,
  ExamScoringMode,
  ExamSection,
  ExamSessionType,
  ExamTimingMode,
} from '@/api/types'

/** Imtihon yaratish ustasining brauzerdagi qoralamasi (avtosaqlash). Foydalanuvchi + maktab + qoralama id bo'yicha. */
/** 2: bloklar (blocks, scoringMode, timingMode, contribDeadline) qo'shildi; eski (1) mahalliy qoralamalar jimgina tashlanadi */
export const WIZARD_DRAFT_VERSION = 2
export const WIZARD_DRAFT_MAX_AGE_MS = 7 * 24 * 3_600_000

export interface WizardFormState {
  type: ExamSessionType
  title: string
  subjectId: string
  classIds: string[]
  templateId: string
  /** 'blocks': bloklar (ma'muriyat), 'sections': bo'limlar (o'qituvchi nazorat ishi va eski qoralamalar) */
  mode: 'sections' | 'blocks'
  sections: ExamSection[]
  blocks: ExamBlockInput[]
  scoringMode: ExamScoringMode
  timingMode: ExamTimingMode
  /** datetime-local qiymati yoki '' */
  contribDeadline: string
  start: string
  durationMin: string
  shuffleQuestions: boolean
  shuffleOptions: boolean
  resultsMode: ExamResultsMode
  passPercent: string
  supervisorIds: string[]
}

export interface WizardDraft {
  v: number
  savedAt: string
  step: number
  form: WizardFormState
}

const PREFIX = 'exam.wizard'
const TYPES = ['quiz', 'quarter', 'annual', 'trial', 'admission']
const MODES = ['score', 'score_answers', 'after_publish', 'never']

/** Kalit: foydalanuvchi + maktab + (server qoralama id yoki "new") */
export const draftKey = (userId: string, schoolId: string, draftId: string | null): string =>
  `${PREFIX}.v${WIZARD_DRAFT_VERSION}:${userId}:${schoolId || '-'}:${draftId ?? 'new'}`

const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)

function validSections(v: unknown): v is ExamSection[] {
  return (
    Array.isArray(v) &&
    v.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        isStr((s as ExamSection).title) &&
        Array.isArray((s as ExamSection).items) &&
        (s as ExamSection).items.every((i) =>
          i && typeof i === 'object' && (i as { kind: string }).kind === 'manual'
            ? isStrArr((i as { questionIds: unknown }).questionIds)
            : (i as { kind: string }).kind === 'rule' &&
              isStr((i as { topicId: unknown }).topicId) &&
              typeof (i as { count: unknown }).count === 'number',
        ),
    )
  )
}

function validBlocks(v: unknown): v is ExamBlockInput[] {
  return (
    Array.isArray(v) &&
    v.every((b) => {
      const x = b as Partial<ExamBlockInput> | null
      return (
        !!x &&
        typeof x === 'object' &&
        isStr(x.subjectId) &&
        typeof x.targetCount === 'number' &&
        typeof x.coefficient === 'number' &&
        isStrArr(x.contributorIds) &&
        validSections([{ title: '', items: x.items }])
      )
    })
  )
}

/** Tuzilmasi noto'g'ri yoki versiyasi boshqa bo'lsa null */
export function parseDraft(raw: string | null, now = Date.now()): WizardDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<WizardDraft>
    if (!d || d.v !== WIZARD_DRAFT_VERSION || !isStr(d.savedAt) || !d.form) return null
    const t = new Date(d.savedAt).getTime()
    if (!Number.isFinite(t) || now - t > WIZARD_DRAFT_MAX_AGE_MS || t > now + 3_600_000) return null
    const f = d.form as Partial<WizardFormState>
    if (
      !Number.isInteger(d.step) ||
      d.step! < 0 ||
      d.step! > 4 ||
      !TYPES.includes(f.type as string) ||
      !MODES.includes(f.resultsMode as string) ||
      !isStr(f.title) ||
      !isStr(f.subjectId) ||
      !isStrArr(f.classIds) ||
      !isStr(f.templateId) ||
      (f.mode !== 'sections' && f.mode !== 'blocks') ||
      !validSections(f.sections) ||
      !validBlocks(f.blocks) ||
      (f.scoringMode !== 'points' && f.scoringMode !== 'coefficient') ||
      (f.timingMode !== 'common' && f.timingMode !== 'per_block') ||
      !isStr(f.contribDeadline) ||
      !isStr(f.start) ||
      !isStr(f.durationMin) ||
      typeof f.shuffleQuestions !== 'boolean' ||
      typeof f.shuffleOptions !== 'boolean' ||
      !isStr(f.passPercent) ||
      !isStrArr(f.supervisorIds)
    ) {
      return null
    }
    return d as WizardDraft
  } catch {
    return null
  }
}

export function loadDraft(key: string): WizardDraft | null {
  try {
    const raw = localStorage.getItem(key)
    const d = parseDraft(raw)
    if (raw && !d) localStorage.removeItem(key) // buzilgan/eski: o'chiriladi
    return d
  } catch {
    return null
  }
}

export function saveDraft(key: string, step: number, form: WizardFormState): void {
  try {
    const d: WizardDraft = {
      v: WIZARD_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      step,
      form: JSON.parse(JSON.stringify(form)) as WizardFormState,
    }
    localStorage.setItem(key, JSON.stringify(d))
  } catch {
    /* xotira to'la yoki bloklangan: ustaning o'zi ishlayveradi */
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Server qoralamasi o'chirilganda/yuborilganda shu id ning mahalliy nusxasi ham tozalanadi (hamma foydalanuvchi/maktab uchun emas, joriylari) */
export function clearDraftById(userId: string, schoolId: string, draftId: string): void {
  clearDraft(draftKey(userId, schoolId, draftId))
}

/** Ustaning birinchi to'ldirilmagan qadami (server qoralamasini ochishda) */
export function firstIncompleteStep(input: {
  title: string
  /** Bo'limlar yoki bloklar savollari to'liq */
  sectionsOk: boolean
  participants: number
}): number {
  if (!input.title.trim()) return 0
  if (!input.sectionsOk) return 1
  return input.participants === 0 ? 3 : 4
}
