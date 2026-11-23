import { reactive } from 'vue'
import { ApiError, createApi, type ExamApi } from './lib/api'
import { toggleOption } from './lib/answers'
import { installAntiCheat } from './lib/events'
import { AnswerQueue, type KeyValueStore, type SaveStatus } from './lib/queue'
import { computeOffset, remainingMs } from './lib/timer'
import type {
  AnswerEntry,
  AnswerValue,
  BlockMeta,
  BlockView,
  ClientQuestion,
  EventType,
  JoinCodeResponse,
  JoinResponse,
  ResultResponse,
  StartResponse,
  SupervisorWarning,
} from './lib/types'

export type Screen = 'loading' | 'join' | 'whoami' | 'confirm' | 'exam' | 'result' | 'closed'

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
/** Heartbeat oralig'i: nazoratchi ogohlantirishi ham shu bilan yetib keladi (<= ~10 s) */
export const HEARTBEAT_MS = 10_000

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
    /** Shaxsiy kod kiritildi, lekin hali tasdiqlanmadi ("Bu sizmisiz?"): token yo'q, hech narsa saqlanmaydi */
    pending: null as JoinCodeResponse | null,
    /** Hozir ko'rinadigan savollar (blokma-blok: faqat joriy blok) */
    questions: [] as ClientQuestion[],
    /** Ko'rsatilgan barcha savollar (natija tahlili uchun; faqat shu qurilmada ko'rilganlar) */
    allQuestions: [] as ClientQuestion[],
    blocks: [] as BlockMeta[],
    /** Blokma-blok: joriy blok holati; null = umumiy vaqt */
    block: null as BlockView | null,
    blockRemaining: 0,
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
    /** Nazoratchi ogohlantirishlari (navbat): birinchisi ekranda ko'rsatiladi, o'quvchi tasdiqlaydi */
    warnings: [] as SupervisorWarning[],
  })
  /** Tasdiqlangan (yoki tasdiq yuborilayotgan) ogohlantirish id lari: server qayta qaytarsa ham ko'rsatilmaydi */
  const acked = new Set<string>()

  let queue: AnswerQueue | null = null
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let beatTimer: ReturnType<typeof setInterval> | null = null
  let removeAnti: (() => void) | null = null
  let toastSeq = 0
  let submitting = false
  let advancing = false
  let lastAutoAdvance = 0
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
      takeWarnings(st.warnings)
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

  /** Kirish javobini (kod+PIN yoki tasdiqlangan shaxsiy kod) qo'llaydi: token saqlanadi, keyingi ekran */
  async function applyJoin(r: JoinResponse, autoStart = false) {
    token = r.token
    writeKey(storage, K_TOKEN, r.token)
    writeKey(storage, K_INFO, JSON.stringify({ ...r, token: undefined }))
    state.join = r
    state.pending = null
    syncClock(r.serverNow)
    if (r.attemptStatus === 'submitted' || r.attemptStatus === 'auto_submitted') await showResult()
    else if (autoStart && r.exam.timingMode !== 'per_block') await start()
    else state.screen = 'confirm'
  }

  /** Eski usul: imtihon kodi + PIN */
  async function join(code: string, pin: string) {
    state.busy = true
    state.error = ''
    try {
      await applyJoin(await api.join({ code: code.trim(), pin: pin.trim(), deviceId: deviceId() }))
    } catch (e) {
      state.error = errText(e)
    } finally {
      state.busy = false
    }
  }

  /** Shaxsiy kod, 1-qadam: kod serverda tekshiriladi, "Bu sizmisiz?" ekrani (urinish yaratilmaydi) */
  async function joinCode(code: string) {
    state.busy = true
    state.error = ''
    try {
      state.pending = await api.joinCode({ code: code.trim(), deviceId: deviceId() })
      state.screen = 'whoami'
    } catch (e) {
      state.error = errText(e)
    } finally {
      state.busy = false
    }
  }

  /**
   * "Ha, boshlash": tasdiqlash tokeni bilan token olinadi. Umumiy vaqtli imtihon darhol boshlanadi; blokma-blok
   * imtihonda (orqaga qaytib bo'lmaydi) qoidalar ekrani ko'rsatiladi. Tasdiq muddati tugagan bo'lsa kod ekraniga qaytadi.
   */
  async function confirmJoin() {
    const p = state.pending
    if (!p) return
    state.busy = true
    state.error = ''
    try {
      await applyJoin(
        await api.joinConfirm({ confirmToken: p.confirmToken, deviceId: deviceId() }),
        true,
      )
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        state.pending = null
        state.screen = 'join'
      }
      state.error = errText(e)
    } finally {
      state.busy = false
    }
  }

  /** "Men emasman": hech narsa saqlanmagan, kod ekraniga qaytamiz */
  function rejectJoin() {
    state.pending = null
    state.error = ''
    state.screen = 'join'
  }

  function clearSession() {
    token = null
    removeKey(storage, K_TOKEN)
    removeKey(storage, K_INFO)
    teardown()
    state.join = null
    state.pending = null
    state.questions = []
    state.allQuestions = []
    state.blocks = []
    state.block = null
    state.answers = {}
    state.warnings = []
    acked.clear()
  }

  /** "Boshqa talaba" uchun: chiqish (faqat topshirilgandan keyin yoki kirish bosqichida) */
  function leave() {
    clearSession()
    state.result = null
    state.error = ''
    state.screen = 'join'
  }

  // ---------- Imtihon ----------
  /**
   * Server ko'rinishini (start / blok almashishi) holatga qo'llaydi: savollar, javoblar navbati, blok va taymer.
   * Blokma-blok: har blok uchun alohida navbat (eski blok javoblari yangisiga aralashmaydi).
   */
  function applyView(r: StartResponse) {
    syncClock(r.serverNow)
    state.questions = r.questions
    const known = new Set(state.allQuestions.map((q) => q.id))
    for (const q of r.questions) if (!known.has(q.id)) state.allQuestions.push(q)
    state.deadline = r.deadline
    if (r.blocks) state.blocks = r.blocks
    state.block = r.block ?? null
    const answers: Record<string, AnswerEntry> = {}
    queue?.destroy()
    queue = new AnswerQueue({
      storage,
      storageKey: `exam.q.${r.startedAt ?? 'x'}${r.block?.id ? `.${r.block.id}` : ''}`,
      send: async (body) => {
        const res = await api.saveAnswers(body)
        syncClock(res.serverNow)
        if (res.rejected?.length) void onRejected(res.rejected.length)
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
  }

  /** Server bu blokka javob qabul qilmadi (blok yopilgan): holat qayta yuklanadi */
  async function onRejected(n: number) {
    toast(`${n} ta javob saqlanmadi: blok vaqti tugagan`, 'warn')
    try {
      const st = await api.state()
      syncClock(st.serverNow)
      if (st.status === 'submitted' || st.status === 'auto_submitted') await showResult()
      else if (st.block?.id && st.block.id !== state.block?.id) await start()
    } catch {
      /* keyingi heartbeat/tick tuzatadi */
    }
  }

  async function start() {
    state.busy = true
    state.error = ''
    try {
      applyView(await api.start())
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
      if (state.screen !== 'exam') return
      if (state.block) {
        // Blokma-blok: blok vaqti tugadi -> keyingi blokka (oxirgi blok bo'lsa topshirish); xatoda 3 s dan keyin qayta
        if (state.blockRemaining <= 0 && now() - lastAutoAdvance > 3000) {
          lastAutoAdvance = now()
          void finishBlock(true)
        }
      } else if (state.deadline && state.remaining <= 0) void submit(true)
    }, opts.tickMs ?? 1000)
    beatTimer = setInterval(
      () =>
        void api
          .heartbeat()
          .then((hb) => {
            takeWarnings(hb?.warnings)
            // Server bloklarni o'zi almashtirgan bo'lsa (vaqt tugagan) yoki nazoratchi to'xtatgan bo'lsa: holat yangilanadi
            if (hb?.status === 'auto_submitted' || hb?.status === 'submitted') {
              void showResult().catch(() => undefined)
            } else if (hb?.block?.id && state.block?.id && hb.block.id !== state.block.id) {
              void start()
            }
          })
          .catch(() => undefined),
      opts.heartbeatMs ?? HEARTBEAT_MS,
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
    // Blokma-blok: asosiy taymer joriy blok vaqtini ko'rsatadi, umumiy tugash `remaining` da qoladi
    if (state.block?.deadline) {
      state.blockRemaining = remainingMs(state.block.deadline, state.offset, now())
    }
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

  /** Serverdan kelgan tasdiqlanmagan ogohlantirishlarni navbatga qo'shadi (takror va tasdiqlanganlar chiqmaydi) */
  function takeWarnings(list: SupervisorWarning[] | undefined) {
    if (!list?.length) return
    for (const w of list) {
      if (acked.has(w.id) || state.warnings.some((x) => x.id === w.id)) continue
      state.warnings.push(w)
    }
  }

  /** "Tushundim": ogohlantirish yopiladi va tasdiq yuboriladi; yuborilmasa keyingi heartbeat qayta yetkazadi */
  function ackWarning(id: string) {
    const i = state.warnings.findIndex((x) => x.id === id)
    if (i >= 0) state.warnings.splice(i, 1)
    acked.add(id)
    void api.ackWarnings([id]).catch(() => acked.delete(id))
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

  /**
   * Blokni yakunlash (blokma-blok): joriy blok yopiladi, orqaga qaytilmaydi. Oxirgi blokda imtihon topshiriladi.
   * auto: blok vaqti tugagan (qayta uriniladi, to'xtamaydi).
   */
  async function finishBlock(auto = false): Promise<boolean> {
    if (!state.block?.id || advancing || submitting) return false
    advancing = true
    state.busy = true
    try {
      if (queue) {
        await Promise.race([queue.flushNow(), new Promise<void>((r) => setTimeout(r, 4000))])
      }
      const r = await api.finishBlock({ blockId: state.block.id })
      if (r.finished) {
        state.result = r
        finish()
      } else {
        applyView(r)
      }
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        await showResult().catch(() => undefined)
        return true
      }
      if (!auto) toast(errText(e, 'Blokni yakunlab bo‘lmadi, qayta urinib ko‘ring'), 'error')
      return false
    } finally {
      advancing = false
      state.busy = false
    }
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
    state.warnings = []
    if (storage) {
      for (const k of keysOf(storage)) if (k.startsWith('exam.q.')) removeKey(storage, k)
    }
    state.screen = 'result'
  }

  return {
    state,
    init,
    join,
    joinCode,
    confirmJoin,
    rejectJoin,
    start,
    submit,
    finishBlock,
    leave,
    setAnswer,
    pickOption,
    toggleFlag,
    ackWarning,
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
