import { ApiError } from './api'
import type { AnswerEntry, SaveResponse } from './types'

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'failed' | 'closed'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface QueueOptions {
  /** Javoblarni yuborish (PUT /answers) */
  send: (body: {
    clientSeq: number
    answers: { qid: string; value: AnswerEntry['value']; flagged: boolean }[]
  }) => Promise<SaveResponse>
  storage: KeyValueStore | null
  /** Saqlash kaliti (urinishga xos) */
  storageKey: string
  debounceMs?: number
  maxBackoffMs?: number
  onStatus?: (s: SaveStatus) => void
  /** Server 409 qaytardi: imtihon topshirilgan yoki vaqt tugagan */
  onClosed?: () => void
}

interface Stored {
  seq: number
  entries: Record<string, AnswerEntry>
  dirty: string[]
}

const MAX_STALE_RETRIES = 3

/**
 * Oflayn-xavfsiz javoblar navbati.
 *  - Har o'zgarish darhol localStorage ga yoziladi (sahifa yopilsa ham yo'qolmaydi) va 1-2 s debounce bilan yuboriladi.
 *  - Har so'rov monoton oshuvchi `clientSeq` bilan; server eskirgan seq ni e'tiborsiz qoldiradi (idempotent).
 *  - Tarmoq/5xx xatosida eksponensial backoff (1s, 2s, 4s ... maks 60s); ulanish tiklanganda (`retryNow`)
 *    OXIRGI TO'LIQ HOLAT yuboriladi (hamma javoblar), shunda yo'qolgan so'rovlar muammo bo'lmaydi.
 *  - Server 409 (topshirilgan/vaqt tugagan): navbat yopiladi, `onClosed` chaqiriladi.
 */
export class AnswerQueue {
  readonly entries: Record<string, AnswerEntry & { v: number }> = {}
  private dirty = new Set<string>()
  private seq = 0
  private inFlight = false
  private again = false
  private resync = false
  private attempts = 0
  private staleRetries = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  status: SaveStatus = 'saved'

  constructor(private o: QueueOptions) {
    const raw = this.read()
    if (raw) {
      this.seq = raw.seq
      for (const [q, e] of Object.entries(raw.entries)) this.entries[q] = { ...e, v: 0 }
      this.dirty = new Set(raw.dirty)
    }
  }

  /** Server holati bilan moslash (qayta ochilganda): seq ni kamaytirmaydi; mahalliy o'zgarmagan javoblar serverdan olinadi */
  hydrate(
    saved: { id: string; value: AnswerEntry['value']; flagged: boolean }[],
    serverSeq: number,
  ) {
    this.seq = Math.max(this.seq, serverSeq)
    for (const s of saved) {
      if (this.dirty.has(s.id)) continue // mahalliy o'zgarish ustun (hali yuborilmagan)
      this.entries[s.id] = { value: s.value, flagged: s.flagged, v: 0 }
    }
    this.persist()
    if (this.dirty.size) this.schedule(0)
  }

  get hasUnsynced(): boolean {
    return this.dirty.size > 0 || this.inFlight
  }

  get currentSeq(): number {
    return this.seq
  }

  set(qid: string, entry: AnswerEntry) {
    if (this.closed) return
    const prev = this.entries[qid]
    this.entries[qid] = { value: entry.value, flagged: entry.flagged, v: (prev?.v ?? 0) + 1 }
    this.dirty.add(qid)
    this.persist()
    this.setStatus(this.inFlight ? 'saving' : this.status === 'offline' ? 'offline' : 'saving')
    this.schedule(this.o.debounceMs ?? 1500)
  }

  /** Darhol yuborish (masalan, topshirishdan oldin) */
  async flushNow(): Promise<void> {
    this.clearTimer()
    await this.flush()
  }

  /** Ulanish tiklandi: kutmasdan, to'liq holat bilan */
  retryNow() {
    if (this.closed) return
    this.resync = true
    this.attempts = 0
    this.clearTimer()
    void this.flush()
  }

  destroy() {
    this.closed = true
    this.clearTimer()
  }

  private schedule(ms: number) {
    if (this.closed) return
    if (this.timer && ms > 0) return // allaqachon rejalashtirilgan: trailing debounce emas, maksimal kutish
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, ms)
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async flush(): Promise<void> {
    if (this.closed) return
    if (this.inFlight) {
      this.again = true
      return
    }
    if (!this.dirty.size && !this.resync) {
      this.setStatus('saved')
      return
    }
    const qids = this.resync ? Object.keys(this.entries) : [...this.dirty]
    const versions = new Map(qids.map((q) => [q, this.entries[q]!.v]))
    const clientSeq = ++this.seq
    this.persist()
    this.inFlight = true
    this.setStatus('saving')
    try {
      const r = await this.o.send({
        clientSeq,
        answers: qids.map((q) => ({
          qid: q,
          value: this.entries[q]!.value,
          flagged: this.entries[q]!.flagged,
        })),
      })
      this.inFlight = false
      if (r.stale) {
        // Server bizning seq dan yuqoriroq saqlagan: seq ni ko'taramiz va qayta yuboramiz (ma'lumot saqlanmadi)
        this.seq = Math.max(this.seq, r.savedSeq)
        this.persist()
        if (this.staleRetries++ < MAX_STALE_RETRIES) {
          this.schedule(0)
          return
        }
        this.setStatus('failed')
        return
      }
      this.staleRetries = 0
      for (const q of qids) if (this.entries[q]?.v === versions.get(q)) this.dirty.delete(q)
      this.resync = false
      this.attempts = 0
      this.persist()
      if (this.dirty.size || this.again) {
        this.again = false
        this.schedule(0)
      } else this.setStatus('saved')
    } catch (e) {
      this.inFlight = false
      if (e instanceof ApiError && e.status === 409) {
        this.closed = true
        this.setStatus('closed')
        this.o.onClosed?.()
        return
      }
      if (e instanceof ApiError && !e.retryable) {
        this.setStatus('failed') // masalan, 400: qayta yuborish foydasiz
        return
      }
      this.resync = true // ulanish tiklanganda to'liq holat
      this.attempts++
      const max = this.o.maxBackoffMs ?? 60_000
      const delay = Math.min(1000 * 2 ** (this.attempts - 1), max)
      this.setStatus(e instanceof ApiError && e.isNetwork ? 'offline' : 'failed')
      this.again = false
      this.clearTimer()
      this.timer = setTimeout(() => {
        this.timer = null
        void this.flush()
      }, delay)
    }
  }

  private setStatus(s: SaveStatus) {
    if (this.status === s) return
    this.status = s
    this.o.onStatus?.(s)
  }

  private persist() {
    if (!this.o.storage) return
    const entries: Record<string, AnswerEntry> = {}
    for (const [q, e] of Object.entries(this.entries))
      entries[q] = { value: e.value, flagged: e.flagged }
    const data: Stored = { seq: this.seq, entries, dirty: [...this.dirty] }
    try {
      this.o.storage.setItem(this.o.storageKey, JSON.stringify(data))
    } catch {
      /* xotira to'la / bloklangan: xotiradagi navbat ishlayveradi */
    }
  }

  private read(): Stored | null {
    if (!this.o.storage) return null
    try {
      const raw = this.o.storage.getItem(this.o.storageKey)
      if (!raw) return null
      const d = JSON.parse(raw) as Stored
      if (typeof d.seq !== 'number' || typeof d.entries !== 'object') return null
      return { seq: d.seq, entries: d.entries ?? {}, dirty: Array.isArray(d.dirty) ? d.dirty : [] }
    } catch {
      return null
    }
  }
}
