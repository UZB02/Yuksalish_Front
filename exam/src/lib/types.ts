export type QuestionType = 'single' | 'multi' | 'short' | 'essay'

export type Block =
  | { type: 'text'; text: string }
  | { type: 'math'; tex: string }
  | { type: 'image'; assetId: string }

export interface ClientQuestion {
  id: string
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
    freeNavigation: boolean
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
}

export interface StateResponse {
  serverNow: string
  status: 'joined' | 'in_progress' | 'submitted' | 'auto_submitted'
  startedAt: string | null
  deadline: string | null
  answeredCount: number
  total: number
  clientSeq: number
}

export interface SaveResponse {
  savedSeq: number
  answeredCount: number
  serverNow: string
  stale?: boolean
}

export interface ReviewItem {
  id: string
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
  review?: ReviewItem[]
}

export type EventType = 'blur' | 'fullscreen_exit' | 'visibility_hidden' | 'reconnect'
