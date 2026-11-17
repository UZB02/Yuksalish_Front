export type QuestionType = 'single' | 'multi' | 'short' | 'essay'

export type Block =
  | { type: 'text'; text: string }
  | { type: 'math'; tex: string }
  | { type: 'image'; assetId: string }

export interface ClientQuestion {
  id: string
  /** Blok id (blokli imtihon); eski imtihonda yo'q */
  blockId?: string
  type: QuestionType
  points: number
  content: Block[]
  options: { id: string; content: Block[] }[]
}

/** single: variant id, multi: id lar, short/essay: matn, null: javobsiz */
export type AnswerValue = string | string[] | null

export interface AnswerEntry {
  value: AnswerValue
  flagged: boolean
}

export type ResultsMode = 'score' | 'score_answers' | 'after_publish' | 'never'

/** Blok haqida ma'lumot (kalitsiz): nom, savollar soni, davomiylik (blokma-blok vaqtda) */
export interface BlockMeta {
  id: string
  title: string
  questionCount: number
  durationMin: number | null
}

/** Blokma-blok urinishning joriy bloki (server holati) */
export interface BlockView {
  index: number
  total: number
  id: string | null
  startedAt: string | null
  deadline: string | null
}

export interface JoinResponse {
  token: string
  serverNow: string
  attemptStatus: 'joined' | 'in_progress' | 'submitted' | 'auto_submitted'
  participant: { fullName: string; className: string | null }
  exam: {
    title: string
    type: string
    durationMin: number
    questionCount: number
    resultsMode: ResultsMode
    startsAt: string
    endsAt: string
    deadlinePreview: string
    /** false: blokma-blok (orqaga qaytib bo'lmaydi) */
    freeNavigation: boolean
    timingMode?: 'common' | 'per_block'
    blocks?: BlockMeta[]
  }
}

export interface StartResponse {
  serverNow: string
  status: string
  startedAt: string | null
  deadline: string | null
  questions: ClientQuestion[]
  saved: { id: string; value: AnswerValue; flagged: boolean }[]
  clientSeq: number
  timingMode?: 'common' | 'per_block'
  blocks?: BlockMeta[]
  /** Blokma-blok: joriy blok (questions faqat shu blokniki). Aks holda null/yo'q */
  block?: BlockView | null
}

export interface StateResponse {
  serverNow: string
  status: 'joined' | 'in_progress' | 'submitted' | 'auto_submitted'
  startedAt: string | null
  deadline: string | null
  answeredCount: number
  total: number
  clientSeq: number
  block?: BlockView | null
}

export interface SaveResponse {
  savedSeq: number
  answeredCount: number
  serverNow: string
  stale?: boolean
  /** Yopilgan (yoki hali ochilmagan) blokka tegishli, saqlanmagan savollar */
  rejected?: string[]
  blockId?: string | null
}

export interface ReviewItem {
  id: string
  blockId?: string | null
  type: string
  got: number
  max: number
  ok: boolean | null
  given: AnswerValue
  reveal: { optionIds?: string[]; texts?: string[] }
}

export interface ResultResponse {
  status: 'submitted' | 'auto_submitted'
  mode: ResultsMode
  available: boolean
  submittedAt: string | null
  answeredCount: number
  total: number
  score?: { earned: number; max: number; autoMax: number; essayPending: number }
  /** Blok bo'yicha ballar (bir nechta blokli imtihonda va natija ko'rsatilsa) */
  blocks?: { id: string; title: string; earned: number; max: number }[]
  review?: ReviewItem[]
}

/** Blokni yakunlash javobi: keyingi blok ko'rinishi yoki (oxirgi blok) natija */
export type FinishBlockResponse =
  ({ finished: false } & StartResponse) | ({ finished: true } & ResultResponse)

export type EventType = 'blur' | 'fullscreen_exit' | 'visibility_hidden' | 'reconnect'
