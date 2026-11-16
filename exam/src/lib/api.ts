import type {
  AnswerEntry,
  EventType,
  JoinResponse,
  ResultResponse,
  SaveResponse,
  StartResponse,
  StateResponse,
} from './types'

export const API_BASE = '/api/v1/exam-client'

/** status 0: tarmoq xatosi (internet yo'q / server javob bermadi) */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
  get isNetwork() {
    return this.status === 0
  }
  /** Qayta urinishga arziydigan xatolar: tarmoq, 5xx, 429 */
  get retryable() {
    return this.status === 0 || this.status >= 500 || this.status === 429
  }
}

export interface ExamApi {
  join(body: { code: string; pin: string; deviceId: string }): Promise<JoinResponse>
  start(): Promise<StartResponse>
  state(): Promise<StateResponse>
  saveAnswers(body: {
    clientSeq: number
    answers: { qid: string; value: AnswerEntry['value']; flagged: boolean }[]
  }): Promise<SaveResponse>
  event(type: EventType, at: string): Promise<unknown>
  heartbeat(): Promise<unknown>
  submit(): Promise<ResultResponse>
  result(): Promise<ResultResponse>
  asset(id: string): Promise<Blob>
}

/**
 * Faqat /api/v1/exam-client ga murojaat qiladi. Token FAQAT Authorization sarlavhasida
 * (cookie yo'q, admin API ga hech qachon yuborilmaydi).
 */
export function createApi(getToken: () => string | null, fetchFn: typeof fetch = fetch): ExamApi {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let res: Response
    try {
      res = await fetchFn(API_BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        cache: 'no-store',
      })
    } catch {
      throw new ApiError(0, 'NETWORK', "Internet yo'q")
    }
    let json: { success?: boolean; data?: T; error?: { code?: string; message?: string } } = {}
    try {
      json = await res.json()
    } catch {
      /* JSON emas (masalan, 502 sahifasi) */
    }
    if (!res.ok || json.success === false) {
      throw new ApiError(
        res.status,
        json.error?.code ?? 'ERROR',
        json.error?.message ?? 'Xatolik yuz berdi',
      )
    }
    return json.data as T
  }

  return {
    join: (b) => call('POST', '/join', b),
    start: () => call('POST', '/start'),
    state: () => call('GET', '/state'),
    saveAnswers: (b) => call('PUT', '/answers', b),
    event: (type, at) => call('POST', '/events', { type, at }),
    heartbeat: () => call('POST', '/heartbeat'),
    submit: () => call('POST', '/submit'),
    result: () => call('GET', '/result'),
    async asset(id) {
      const headers: Record<string, string> = {}
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      let res: Response
      try {
        res = await fetchFn(`${API_BASE}/assets/${id}`, { headers, credentials: 'omit' })
      } catch {
        throw new ApiError(0, 'NETWORK', "Internet yo'q")
      }
      if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Rasm yuklanmadi')
      return res.blob()
    },
  }
}
