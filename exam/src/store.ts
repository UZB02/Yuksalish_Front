import { reactive } from 'vue'
import { ApiError, createApi, type ExamApi } from './lib/api'
import { toggleOption } from './lib/answers'
import { installAntiCheat } from './lib/events'
import { AnswerQueue, type KeyValueStore, type SaveStatus } from './lib/queue'
import { computeOffset, remainingMs } from './lib/timer'
import type {
  AnswerEntry,
  AnswerValue,
  ClientQuestion,
  EventType,
  JoinResponse,
  ResultResponse,
} from './lib/types'

export type Screen = 'loading' | 'join' | 'confirm' | 'exam' | 'result' | 'closed'

export interface Toast {
  id: number
  kind: 'info' | 'warn' | 'error'
  message: string
}

export interface StoreOptions {
  api?: ExamApi
  storage?: KeyValueStore | null
  now?: () => number
  /** Brauzer muhiti (testlarda soxtalashtiriladi) */
  env?: { document: Document; window: Window }
  heartbeatMs?: number
  tickMs?: number
}

const K_DEVICE = 'exam.deviceId'
const K_TOKEN = 'exam.token'
const K_INFO = 'exam.info'

const randomId = (): string => {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createStore(opts: StoreOptions = {}) {
  const now = opts.now ?? Date.now
  const storage: KeyValueStore | null =
    opts.storage !== undefined ? opts.storage : (safeLocalStorage() ?? null)
  const env = opts.env ?? { document, window }
  let token: string | null = readKey(storage, K_TOKEN)
  const api: ExamApi = opts.api ?? createApi(() => token)

  const state = reactive({
    screen: 'loading' as Screen,
    busy: false,
    error: '',
    join: null as JoinResponse | null,
    questions: [] as ClientQuestion[],
    answers: {} as Record<string, AnswerEntry>,
    index: 0,
    deadline: null as string | null,
    offset: 0,
    remaining: 0,
    saveStatus: 'saved' as SaveStatus,
    toasts: [] as Toast[],
    result: null as ResultResponse | null,
    online: true,
    closedReason: '' as '' | 'time' | 'submitted',
  })

  let queue: AnswerQueue | null = null
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let beatTimer: ReturnType<typeof setInterval> | null = null
  let removeAnti: (() => void) | null = null
  let toastSeq = 0
  let submitting = false
  let listenersOn = false

  const deviceId = (): string => {
    let id = readKey(storage, K_DEVICE)
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = randomId()
      writeKey(storage, K_DEVICE, id)
    }
    return id
  }

  function toast(message: string, kind: Toast['kind'] = 'info') {
    const id = ++toastSeq
    state.toasts.push({ id, kind, message })
    setTimeout(() => {
      const i = state.toasts.findIndex((t) => t.id === id)
      if (i >= 0) state.toasts.splice(i, 1)
    }, 4500)
  }

  function syncClock(serverNowIso: string) {
    state.offset = computeOffset(serverNowIso, now())
  }

  const errText = (e: unknown, fallback = 'Xatolik yuz berdi'): string =>
    e instanceof ApiError
      ? e.isNetwork
        ? "Internet yo'q. Aloqani tekshiring"
        : e.message
      : fallback

  // ---------- Kirish ----------
  async function init() {
    state.screen = 'loading'
    state.error = ''
    if (!token) {
      state.screen = 'join'
      return
    }
    try {
      const info = readJson<JoinResponse>(storage, K_INFO)
      const st = await api.state()
      syncClock(st.serverNow)
      if (!info) throw new ApiError(401, 'UNAUTHORIZED', 'Qayta kiring')
      state.join = info
      if (st.status === 'submitted' || st.status === 'auto_submitted') await showResult()
      else if (st.status === 'in_progress') await start()
      else state.screen = 'confirm'
    } catch (e) {
      if (e instanceof ApiError && !e.retryable) {
        clearSession()
        state.screen = 'join'
      } else {
        state.error = errText(e)
        state.screen = 'loading'
      }
    }
  }

  async function join(code: string, pin: string) {
    state.busy = true
    state.error = ''
    try {
      const r = await api.join({ code: code.trim(), pin: pin.trim(), deviceId: deviceId() })
      token = r.token
      writeKey(storage, K_TOKEN, r.token)
      writeKey(storage, K_INFO, JSON.stringify({ ...r, token: undefined }))
      state.join = r
      syncClock(r.serverNow)
      if (r.attemptStatus === 'submitted' || r.attemptStatus === 'auto_submitted')
        await showResult()
      else state.screen = 'confirm'
    } catch (e) {
      state.error = errText(e)
    } finally {
      state.busy = false
    }
  }

  function clearSession() {
    token = null
    removeKey(storage, K_TOKEN)
    removeKey(storage, K_INFO)
    teardown()
    state.join = null
    state.questions = []
    state.answers = {}
  }

  /** "Boshqa talaba" uchun: chiqish (faqat topshirilgandan keyin yoki kirish bosqichida) */
  function leave() {
    clearSession()
    state.result = null
    state.error = ''
    state.screen = 'join'
  }

  // ---------- Imtihon ----------
  async function start() {
    state.busy = true
    state.error = ''
    try {
      const r = await api.start()
      syncClock(r.serverNow)
      state.questions = r.questions
      state.deadline = r.deadline
      const answers: Record<string, AnswerEntry> = {}
      queue?.destroy()
      queue = new AnswerQueue({
        storage,
        storageKey: `exam.q.${r.startedAt ?? 'x'}`,
        send: async (body) => {
          const res = await api.saveAnswers(body)
          syncClock(res.serverNow)
          return res
        },
        onStatus: (s) => (state.saveStatus = s),
        onClosed: () => void onServerClosed(),
      })
      queue.hydrate(r.saved, r.clientSeq)
      for (const q of r.questions) {
        const e = queue.entries[q.id]
        if (e) answers[q.id] = { value: e.value, flagged: e.flagged }
      }
      state.answers = answers
      state.index = 0
      state.screen = 'exam'
      startRuntime()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await showResult().catch(() => undefined)
      else state.error = errText(e)
    } finally {
      state.busy = false
    }
  }

  function startRuntime() {
    stopRuntime()
    updateRemaining()
    tickTimer = setInterval(() => {
      updateRemaining()
      if (state.deadline && state.remaining <= 0 && state.screen === 'exam') void submit(true)
    }, opts.tickMs ?? 1000)
    beatTimer = setInterval(
      () => void api.heartbeat().catch(() => undefined),
      opts.heartbeatMs ?? 30_000,
    )
    removeAnti = installAntiCheat(
      {
        send: (type, at) => void sendEvent(type, at),
        warn: (m) => toast(m, 'warn'),
        now,
      },
      env.document,
      env.window,
    )
    if (!listenersOn) {
      env.window.addEventListener('online', onOnline)
      env.window.addEventListener('offline', onOffline)
      env.window.addEventListener('beforeunload', onBeforeUnload)
      listenersOn = true
    }
  }

  function stopRuntime() {
    if (tickTimer) clearInterval(tickTimer)
    if (beatTimer) clearInterval(beatTimer)
    tickTimer = beatTimer = null
    removeAnti?.()
    removeAnti = null
  }

  function teardown() {
    stopRuntime()
    queue?.destroy()
    queue = null
    if (listenersOn) {
      env.window.removeEventListener('online', onOnline)
      env.window.removeEventListener('offline', onOffline)
      env.window.removeEventListener('beforeunload', onBeforeUnload)
      listenersOn = false
    }
  }

  function updateRemaining() {
    if (state.deadline) state.remaining = remainingMs(state.deadline, state.offset, now())
  }

  async function sendEvent(type: EventType, at: string) {
    try {
      await api.event(type, at)
    } catch {
      /* hodisa yo'qolsa ham test davom etadi */
    }
  }

  function onOnline() {
    state.online = true
    queue?.retryNow()
    void sendEvent('reconnect', new Date(now()).toISOString())
  }
  function onOffline() {
    state.online = false
  }
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (queue?.hasUnsynced) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  function setAnswer(qid: string, value: AnswerValue) {
    const prev = state.answers[qid]
    const entry: AnswerEntry = { value, flagged: prev?.flagged ?? false }
    state.answers[qid] = entry
    queue?.set(qid, entry)
  }

  /** Variant tanlash (single/multi) */
  function pickOption(q: ClientQuestion, optionId: string) {
    setAnswer(q.id, toggleOption(q.type, state.answers[q.id]?.value ?? null, optionId))
  }

  function toggleFlag(qid: string) {
    const prev = state.answers[qid]
    const entry: AnswerEntry = { value: prev?.value ?? null, flagged: !prev?.flagged }
    state.answers[qid] = entry
    queue?.set(qid, entry)
  }

  function goto(i: number) {
    if (i >= 0 && i < state.questions.length) state.index = i
  }

  async function onServerClosed() {
    if (state.screen !== 'exam') return
    stopRuntime()
    await showResult().catch(() => {
      state.closedReason = 'time'
      state.screen = 'closed'
    })
  }

  // ---------- Topshirish ----------
  /** auto: vaqt tugadi (qayta urinadi, to'xtamaydi); aks holda tarmoq xatosida xabar beradi va qaytadi */
  async function submit(auto = false): Promise<boolean> {
    if (submitting) return false
    submitting = true
    state.busy = true
    try {
      if (queue) {
        await Promise.race([queue.flushNow(), new Promise<void>((r) => setTimeout(r, 4000))])
      }
      for (let attempt = 0; ; attempt++) {
        try {
          state.result = await api.submit()
          break
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            // Allaqachon topshirilgan (sweeper yoki boshqa so'rov): natijani olamiz
            state.result = await api.result()
            break
          }
          if (!auto || attempt >= 5) {
            toast(errText(e, 'Topshirib bo‘lmadi, qayta urinib ko‘ring'), 'error')
            return false
          }
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)))
        }
      }
      finish()
      return true
    } finally {
      submitting = false
      state.busy = false
    }
  }

  async function showResult() {
    state.result = await api.result()
    finish()
  }

  function finish() {
    teardown()
    if (storage) {
      for (const k of keysOf(storage)) if (k.startsWith('exam.q.')) removeKey(storage, k)
    }
    state.screen = 'result'
  }

  return {
    state,
    init,
    join,
    start,
    submit,
    leave,
    setAnswer,
    pickOption,
    toggleFlag,
    goto,
    toast,
    retryInit: init,
    /** Rasm (token bilan) */
    fetchAsset: (id: string) => api.asset(id),
    get queue() {
      return queue
    },
  }
}

export type ExamStore = ReturnType<typeof createStore>

// ---------- Xavfsiz storage yordamchilari ----------
function safeLocalStorage(): KeyValueStore | null {
  try {
    const s = window.localStorage
    s.setItem('exam.probe', '1')
    s.removeItem('exam.probe')
    return s
  } catch {
    return null
  }
}
function readKey(s: KeyValueStore | null, k: string): string | null {
  try {
    return s?.getItem(k) ?? null
  } catch {
    return null
  }
}
function writeKey(s: KeyValueStore | null, k: string, v: string) {
  try {
    s?.setItem(k, v)
  } catch {
    /* ignore */
  }
}
function removeKey(s: KeyValueStore | null, k: string) {
  try {
    s?.removeItem(k)
  } catch {
    /* ignore */
  }
}
function readJson<T>(s: KeyValueStore | null, k: string): T | null {
  const raw = readKey(s, k)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
function keysOf(s: KeyValueStore): string[] {
  const anyS = s as unknown as { length?: number; key?: (i: number) => string | null }
  if (typeof anyS.length === 'number' && anyS.key) {
    const out: string[] = []
    for (let i = 0; i < anyS.length; i++) {
      const k = anyS.key(i)
      if (k) out.push(k)
    }
    return out
  }
  return []
}
