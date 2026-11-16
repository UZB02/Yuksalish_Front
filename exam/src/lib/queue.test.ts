import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { AnswerQueue, type KeyValueStore } from './queue'
import type { SaveResponse } from './types'

class MemStore implements KeyValueStore {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const ok = (seq: number, extra: Partial<SaveResponse> = {}): SaveResponse => ({
  savedSeq: seq,
  answeredCount: 1,
  serverNow: new Date().toISOString(),
  ...extra,
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function make(send: ReturnType<typeof vi.fn>, storage: KeyValueStore | null = new MemStore()) {
  const statuses: string[] = []
  const onClosed = vi.fn()
  const q = new AnswerQueue({
    send: send as never,
    storage,
    storageKey: 'k',
    onStatus: (s) => statuses.push(s),
    onClosed,
  })
  return { q, statuses, onClosed, storage }
}

describe('AnswerQueue', () => {
  it('debounce: tez-tez o`zgarishlar bitta so`rovga birlashadi, clientSeq 1 dan', async () => {
    const send = vi.fn().mockResolvedValue(ok(1))
    const { q, statuses } = make(send)
    q.set('a', { value: 'x', flagged: false })
    q.set('a', { value: 'xy', flagged: false })
    q.set('b', { value: ['1'], flagged: true })
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1600)
    expect(send).toHaveBeenCalledTimes(1)
    const body = send.mock.calls[0]![0]
    expect(body.clientSeq).toBe(1)
    expect(body.answers).toEqual([
      { qid: 'a', value: 'xy', flagged: false },
      { qid: 'b', value: ['1'], flagged: true },
    ])
    expect(q.hasUnsynced).toBe(false)
    expect(q.status).toBe('saved')
    expect(statuses).toContain('saving')
  })

  it('seq monoton oshadi; faqat o`zgarganlar yuboriladi', async () => {
    const send = vi.fn().mockImplementation(async (b) => ok(b.clientSeq))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    q.set('b', { value: '2', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    expect(send.mock.calls.map((c) => c[0].clientSeq)).toEqual([1, 2])
    expect(send.mock.calls[1]![0].answers).toEqual([{ qid: 'b', value: '2', flagged: false }])
  })

  it('tarmoq xatosi: offline, eksponensial backoff, keyin TO`LIQ holat yuboriladi', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(ok(1))
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
      .mockResolvedValue(ok(4))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600) // 1-seq muvaffaqiyatli
    q.set('b', { value: '2', flagged: false })
    await vi.advanceTimersByTimeAsync(1600) // 2-urinish: xato
    expect(q.status).toBe('offline')
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000) // backoff 1s: yana xato
    expect(send).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1800) // 2s backoff tugamadi
    expect(send).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(300)
    expect(send).toHaveBeenCalledTimes(4)
    const last = send.mock.calls[3]![0]
    expect(last.clientSeq).toBe(4)
    expect(last.answers.map((x: { qid: string }) => x.qid).sort()).toEqual(['a', 'b']) // to'liq holat
    expect(q.status).toBe('saved')
    expect(q.hasUnsynced).toBe(false)
  })

  it('backoff 60 s dan oshmaydi', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x'))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    for (let i = 0; i < 9; i++) await vi.advanceTimersByTimeAsync(61_000)
    const before = send.mock.calls.length
    await vi.advanceTimersByTimeAsync(61_000)
    expect(send.mock.calls.length).toBe(before + 1) // har 60 s da bitta urinish
  })

  it('retryNow (ulanish tiklandi): kutmasdan to`liq holat', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
      .mockResolvedValue(ok(2))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    q.set('b', { value: '2', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    expect(q.status).toBe('offline')
    q.retryNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]![0].answers).toHaveLength(2)
    expect(q.status).toBe('saved')
  })

  it('5xx qayta uriniladi (failed), 400 qayta urinilmaydi', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'X', 'x'))
      .mockResolvedValue(ok(2))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    expect(q.status).toBe('failed')
    await vi.advanceTimersByTimeAsync(1100)
    expect(q.status).toBe('saved')
    const send400 = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'x'))
    const b = make(send400)
    b.q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(send400).toHaveBeenCalledTimes(1)
    expect(b.q.status).toBe('failed')
  })

  it('409 (topshirilgan/vaqt tugagan): navbat yopiladi va onClosed chaqiriladi', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'Imtihon vaqti tugagan'))
    const { q, onClosed } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(q.status).toBe('closed')
    q.set('a', { value: '2', flagged: false })
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('stale javob: seq serverdagiga ko`tariladi va qayta yuboriladi', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(ok(7, { stale: true }))
      .mockResolvedValue(ok(8))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    await vi.advanceTimersByTimeAsync(10)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]![0].clientSeq).toBe(8)
    expect(q.status).toBe('saved')
  })

  it('o`zgarish yuborish vaqtida bo`lsa yo`qolmaydi (versiya tekshiruvi)', async () => {
    let release: (v: SaveResponse) => void = () => undefined
    const send = vi
      .fn()
      .mockImplementationOnce(() => new Promise<SaveResponse>((r) => (release = r)))
      .mockResolvedValue(ok(2))
    const { q } = make(send)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    q.set('a', { value: '12', flagged: false }) // yuborilayotganda o'zgardi
    release(ok(1))
    await vi.advanceTimersByTimeAsync(1700)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]![0].answers).toEqual([{ qid: 'a', value: '12', flagged: false }])
    expect(q.hasUnsynced).toBe(false)
  })

  it('localStorage: yuborilmagan javoblar va seq qayta yuklashdan keyin tiklanadi; hydrate mahalliy o`zgarishni bosmaydi', async () => {
    const store = new MemStore()
    const send1 = vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x'))
    const a = make(send1, store)
    a.q.set('a', { value: 'mahalliy', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    a.q.destroy()
    // "sahifa qayta ochildi"
    const send2 = vi.fn().mockImplementation(async (b) => ok(b.clientSeq))
    const b = make(send2, store)
    expect(b.q.hasUnsynced).toBe(true)
    b.q.hydrate(
      [
        { id: 'a', value: 'serverdagi eski', flagged: false },
        { id: 'c', value: 'x', flagged: false },
      ],
      5,
    )
    expect(b.q.entries.a!.value).toBe('mahalliy')
    expect(b.q.entries.c!.value).toBe('x')
    await vi.advanceTimersByTimeAsync(10)
    expect(send2).toHaveBeenCalledTimes(1)
    expect(send2.mock.calls[0]![0].clientSeq).toBeGreaterThan(5)
    expect(send2.mock.calls[0]![0].answers).toEqual([
      { qid: 'a', value: 'mahalliy', flagged: false },
    ])
  })

  it('storage ishlamasa (null) xotiradagi navbat ishlaydi', async () => {
    const send = vi.fn().mockResolvedValue(ok(1))
    const { q } = make(send, null)
    q.set('a', { value: '1', flagged: false })
    await vi.advanceTimersByTimeAsync(1600)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
