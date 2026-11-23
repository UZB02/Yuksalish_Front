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
  /** "Fayl + kalit" bloki: varaqadagi savol raqami va variant harfi (matn/variant mazmuni yo'q, fayldan o'qiladi) */
  no?: number
  variant?: string
}

/** "Fayl + kalit" bloki: o'quvchiga berilgan variant fayli (PDF yoki tartiblangan rasmlar) */
export interface FileBlockView {
  blockId: string
  variant: string
  kind: 'pdf' | 'image'
  files: { id: string }[]
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

/** Shaxsiy kod bilan 1-qadam: "Bu sizmisiz?" ma'lumoti (token YO'Q, urinish yaratilmagan) */
export interface JoinCodeResponse {
  confirmToken: string
  serverNow: string
  participant: { fullName: string; className: string | null }
  exam: {
    title: string
    subjectsCount: number
    durationMin: number
    startsAt: string
    endsAt: string
    /** upcoming: hali boshlanmagan; running: kirish mumkin; ended: tugagan */
    phase: 'upcoming' | 'running' | 'ended'
  }
  attemptStatus: string | null
}

export interface JoinResponse {
  token: string
  serverNow: string
  attemptStatus: 'joined' | 'in_progress' | 'submitted' | 'auto_submitted'
  terminated?: boolean
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
  /** Ko'rinadigan fayl bloklari (yo'q = barcha bloklar savollar bankidan) */
  files?: FileBlockView[]
  /** Blokma-blok: joriy blok (questions faqat shu blokniki). Aks holda null/yo'q */
  block?: BlockView | null
}

/** Nazoratchi ogohlantirishi: o'quvchi tasdiqlamaguncha server har heartbeat/state da qaytaradi */
export interface SupervisorWarning {
  id: string
  text: string
  at: string
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
  /** Nazoratchi imtihonni to'xtatgan (status 'submitted') */
  terminated?: boolean
  warnings?: SupervisorWarning[]
}

/** Heartbeat javobi (kerakli qismi) */
export interface HeartbeatResponse {
  serverNow: string
  status: 'joined' | 'in_progress' | 'submitted' | 'auto_submitted'
  deadline: string | null
  block?: BlockView | null
  terminated?: boolean
  warnings?: SupervisorWarning[]
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
  /** Nazoratchi imtihonni to'xtatgan (shu paytgacha javoblar baholangan) */
  terminated?: boolean
  score?: { earned: number; max: number; autoMax: number; essayPending: number }
  /** Blok bo'yicha ballar (bir nechta blokli imtihonda va natija ko'rsatilsa) */
  blocks?: { id: string; title: string; earned: number; max: number }[]
  review?: ReviewItem[]
}

/** Blokni yakunlash javobi: keyingi blok ko'rinishi yoki (oxirgi blok) natija */
export type FinishBlockResponse =
  ({ finished: false } & StartResponse) | ({ finished: true } & ResultResponse)

export type EventType = 'blur' | 'fullscreen_exit' | 'visibility_hidden' | 'reconnect'
