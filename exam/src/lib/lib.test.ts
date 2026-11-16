import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApi } from './api'
import { serializeValue, toggleOption } from './answers'
import { installAntiCheat } from './events'
import { cellState, countFlagged, countUnanswered, gridCells } from './grid'
import { computeOffset, formatRemaining, isLowTime, remainingMs } from './timer'
import type { AnswerEntry, ClientQuestion } from './types'

const q = (id: string, type: ClientQuestion['type'] = 'single'): ClientQuestion => ({
  id,
  type,
  points: 1,
  content: [{ type: 'text', text: id }],
  options: [],
})

describe('timer (server soati bilan sinxron)', () => {
  it('offset: klient soati orqada/oldinda bo`lsa ham qolgan vaqt serverga mos', () => {
    const deadline = '2026-12-01T10:40:00.000Z'
    const serverNow = '2026-12-01T10:30:00.000Z'
    // klient soati 1 soat oldinda
    const clientNow = new Date('2026-12-01T11:30:00.000Z').getTime()
    const off = computeOffset(serverNow, clientNow)
    expect(off).toBe(-3_600_000)
    expect(remainingMs(deadline, off, clientNow)).toBe(10 * 60_000)
    expect(remainingMs(deadline, off, clientNow + 5_000)).toBe(10 * 60_000 - 5_000)
    // klient soati 2 soat orqada
    const c2 = new Date('2026-12-01T08:30:00.000Z').getTime()
    expect(remainingMs(deadline, computeOffset(serverNow, c2), c2)).toBe(10 * 60_000)
  })
  it('0 dan past emas; format; oxirgi 5 daqiqa', () => {
    expect(remainingMs('2020-01-01T00:00:00Z', 0, Date.now())).toBe(0)
    expect(formatRemaining(65_000)).toBe('01:05')
    expect(formatRemaining(3_725_000)).toBe('1:02:05')
    expect(formatRemaining(0)).toBe('00:00')
    expect(formatRemaining(999)).toBe('00:01')
    expect(isLowTime(5 * 60_000)).toBe(true)
    expect(isLowTime(5 * 60_000 + 1)).toBe(false)
  })
})

describe('grid holatlari', () => {
  const qs = [q('a'), q('b'), q('c'), q('d', 'multi')]
  const answers: Record<string, AnswerEntry> = {
    a: { value: 'x', flagged: false },
    b: { value: null, flagged: true },
    c: { value: '   ', flagged: false },
    d: { value: ['1'], flagged: true },
  }
  it('answered / flagged (javobdan ustun) / empty (bo`sh matn ham)', () => {
    expect(gridCells(qs, answers).map((c) => c.state)).toEqual([
      'answered',
      'flagged',
      'empty',
      'flagged',
    ])
    expect(cellState(undefined)).toBe('empty')
    expect(cellState({ value: [], flagged: false })).toBe('empty')
  })
  it('javobsiz va belgilanganlar soni', () => {
    expect(countUnanswered(qs, answers)).toBe(2)
    expect(countFlagged(qs, answers)).toBe(2)
  })
})

describe('javob serializatsiyasi', () => {
  it('single: almashadi, qayta bosilsa bekor; multi: qo`shadi/olib tashlaydi, bo`sh -> null', () => {
    expect(toggleOption('single', null, 'a')).toBe('a')
    expect(toggleOption('single', 'a', 'b')).toBe('b')
    expect(toggleOption('single', 'b', 'b')).toBeNull()
    expect(toggleOption('multi', null, 'a')).toEqual(['a'])
    expect(toggleOption('multi', ['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleOption('multi', ['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleOption('multi', ['a'], 'a')).toBeNull()
  })
  it('serializeValue: bo`sh qiymatlar null, takrorlar olib tashlanadi', () => {
    expect(serializeValue('short', '  ')).toBeNull()
    expect(serializeValue('short', ' 12 ')).toBe(' 12 ')
    expect(serializeValue('essay', '')).toBeNull()
    expect(serializeValue('multi', ['a', 'a', 'b'])).toEqual(['a', 'b'])
    expect(serializeValue('multi', [])).toBeNull()
    expect(serializeValue('single', '')).toBeNull()
  })
})

describe('installAntiCheat', () => {
  function env() {
    const doc = document
    let hidden = false
    Object.defineProperty(doc, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })
    let fs: Element | null = null
    Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => fs })
    return {
      doc,
      setHidden: (v: boolean) => (hidden = v),
      setFs: (v: boolean) => (fs = v ? doc.documentElement : null),
    }
  }
  it('blur / visibility / fullscreen chiqish qayd etiladi, ogohlantirish bir marta; dedupe', () => {
    const e = env()
    const send = vi.fn()
    const warn = vi.fn()
    let t = 1_000_000
    const off = installAntiCheat({ send, warn, now: () => t })
    e.setHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('blur')) // bir vaqtda: ogohlantirish takrorlanmaydi
    expect(send.mock.calls.map((c) => c[0])).toEqual(['visibility_hidden', 'blur'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('Oynadan chiqish qayd qilindi')
    document.dispatchEvent(new Event('visibilitychange')) // 1.5 s ichida: e'tiborsiz
    expect(send).toHaveBeenCalledTimes(2)
    t += 5_000
    e.setFs(false)
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(send.mock.calls[2]![0]).toBe('fullscreen_exit')
    expect(warn).toHaveBeenCalledTimes(2)
    e.setHidden(false)
    t += 5_000
    document.dispatchEvent(new Event('visibilitychange')) // qaytish: hodisa emas
    expect(send).toHaveBeenCalledTimes(3)
    off()
    t += 5_000
    window.dispatchEvent(new Event('blur'))
    expect(send).toHaveBeenCalledTimes(3)
  })
})

describe('createApi', () => {
  it('token faqat Authorization sarlavhasida, cookie yo`q; xatolar ApiError', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! })
      if (String(url).endsWith('/state')) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Yo‘q' } }),
          { status: 401 },
        )
      }
      return new Response(JSON.stringify({ success: true, data: { savedSeq: 1 } }), { status: 200 })
    }) as unknown as typeof fetch
    const api = createApi(() => 'tok123', fetchFn)
    await api.saveAnswers({ clientSeq: 1, answers: [] })
    expect(calls[0]!.url).toBe('/api/v1/exam-client/answers')
    expect(calls[0]!.init.method).toBe('PUT')
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok123')
    expect(calls[0]!.init.credentials).toBe('omit')
    await expect(api.state()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Yo‘q',
    })
    const down = createApi(() => null, (() =>
      Promise.reject(new TypeError('fail'))) as unknown as typeof fetch)
    const err = await down.state().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.isNetwork && err.retryable).toBe(true)
  })
})
