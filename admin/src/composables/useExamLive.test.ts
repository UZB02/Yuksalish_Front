/* eslint-disable vue/one-component-per-file -- sinov uchun kichik "host" komponentlar */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ApiError } from '@/api/errors'
import type { ExamLiveResponse, ExamLiveRow } from '@/api/types'

const api = { sessionLive: vi.fn() }
vi.mock('@/api/exams.api', () => ({
  examsApi: new Proxy({}, { get: (_t, k) => api[k as keyof typeof api] }),
}))

import { FLASH_MS, useExamLive } from './useExamLive'

const T0 = new Date('2026-12-01T10:00:00.000Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const row = (over: Partial<ExamLiveRow> = {}) =>
  ({ key: 'k1', fullName: 'A', status: 'in_progress', leaves: 0, ...over }) as ExamLiveRow
const resp = (items: ExamLiveRow[], over: Partial<ExamLiveResponse> = {}) =>
  ({
    serverNow: iso(Date.now()),
    session: { id: 'e1', status: 'open' },
    canIntervene: true,
    staleAfterSec: 60,
    items,
    ...over,
  }) as unknown as ExamLiveResponse

let live!: ReturnType<typeof useExamLive>
let enabled!: Ref<boolean>
const onStatus = vi.fn()
const mounted: VueWrapper[] = []
function mk(on = true) {
  enabled = ref(on)
  const w = mount(
    defineComponent({
      setup() {
        live = useExamLive(ref('e1'), enabled, onStatus)
        return () => h('div')
      },
    }),
  )
  mounted.push(w)
  return w
}
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)
let hiddenFlag = false
const setHidden = (v: boolean) => {
  hiddenFlag = v
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  hiddenFlag = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hiddenFlag })
  api.sessionLive.mockReset()
  onStatus.mockReset()
  api.sessionLive.mockImplementation(async () => resp([row()]))
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  vi.useRealTimers()
})

describe('useExamLive: polling', () => {
  it('har 5 soniyada bitta so`rov', async () => {
    mk()
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
    await tick(10_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(4)
  })

  it('bir vaqtda faqat bitta so`rov: javob kechiksa yangisi boshlanmaydi', async () => {
    let release: (v: ExamLiveResponse) => void = () => undefined
    api.sessionLive.mockImplementation(() => new Promise<ExamLiveResponse>((r) => (release = r)))
    mk()
    await tick()
    await tick(30_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    release(resp([row()]))
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
  })

  it('sahifa yashirin bo`lsa to`xtaydi, ko`ringach darhol davom etadi', async () => {
    mk()
    await tick()
    setHidden(true)
    await tick(60_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    expect(live.hidden.value).toBe(true)
    setHidden(false)
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(3)
  })

  it('xato: loadError belgilanadi va qayta uriniladi; o`chirilganda taymer to`xtaydi', async () => {
    api.sessionLive.mockRejectedValueOnce(new ApiError('INTERNAL', 'xato', 500))
    const w = mk()
    await tick()
    expect(live.loadError.value).toBe(true)
    await tick(5000)
    expect(api.sessionLive).toHaveBeenCalledTimes(2)
    expect(live.loadError.value).toBe(false)
    w.unmount()
    mounted.pop()
    api.sessionLive.mockClear()
    await tick(30_000)
    expect(api.sessionLive).not.toHaveBeenCalled()
  })

  it('enabled=false: so`rov yo`q; yoqilganda darhol boshlanadi', async () => {
    mk(false)
    await tick(20_000)
    expect(api.sessionLive).not.toHaveBeenCalled()
    enabled.value = true
    await tick()
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
    enabled.value = false
    await tick(20_000)
    expect(api.sessionLive).toHaveBeenCalledTimes(1)
  })

  it('imtihon holati o`zgarsa onStatus chaqiriladi', async () => {
    mk()
    await tick()
    expect(onStatus).toHaveBeenLastCalledWith('open')
    api.sessionLive.mockResolvedValue(resp([row()], { session: { status: 'closed' } } as never))
    await tick(5000)
    expect(onStatus).toHaveBeenLastCalledWith('closed')
  })
})

describe('useExamLive: yangi chiqish va server vaqti', () => {
  it('birinchi yuklashdagi chiqishlar "yangi" emas; keyingi oshish 15 s miltillaydi', async () => {
    api.sessionLive.mockResolvedValue(resp([row({ leaves: 3 })]))
    mk()
    await tick()
    expect(live.flashUntil.value).toEqual({})
    api.sessionLive.mockResolvedValue(resp([row({ leaves: 4 })]))
    await tick(5000)
    expect(live.flashUntil.value.k1).toBeGreaterThan(Date.now())
    expect(live.flashUntil.value.k1 - Date.now()).toBeLessThanOrEqual(FLASH_MS)
  })

  it('server vaqti farqi (offset) hisobga olinadi', async () => {
    api.sessionLive.mockImplementation(async () =>
      resp([row()], { serverNow: iso(Date.now() + 60_000) }),
    )
    mk()
    await tick()
    expect(live.offset.value).toBeGreaterThanOrEqual(59_000)
    expect(live.nowMs.value - live.tick.value).toBe(live.offset.value)
  })
})

describe('useExamLive: imtihon almashishi', () => {
  it('oldingi imtihonning kechikkan javobi qo`llanmaydi', async () => {
    const id = ref('e1')
    let release: (v: ExamLiveResponse) => void = () => undefined
    api.sessionLive.mockImplementationOnce(
      () => new Promise<ExamLiveResponse>((r) => (release = r)),
    )
    const w = mount(
      defineComponent({
        setup() {
          live = useExamLive(id, ref(true), onStatus)
          return () => h('div')
        },
      }),
    )
    mounted.push(w)
    await tick()
    id.value = 'e2'
    api.sessionLive.mockResolvedValue(resp([row({ key: 'yangi' })]))
    release(resp([row({ key: 'eski' })]))
    await tick()
    await tick(5000)
    expect(live.data.value?.items.map((x) => x.key)).toEqual(['yangi'])
  })
})
