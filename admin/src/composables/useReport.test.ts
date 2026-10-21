import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { ApiError } from '@/api/errors'
import { useReport } from './useReport'

const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe('useReport', () => {
  it("manba null bo'lsa so'rov yuborilmaydi (idle)", async () => {
    const fetch = vi.fn()
    const r = useReport(() => null, fetch)
    await flush()
    expect(fetch).not.toHaveBeenCalled()
    expect(r.idle.value).toBe(true)
    expect(r.data.value).toBeNull()
  })

  it("filtr -> so'rov -> holat; filtr o'zgarsa qayta so'raydi", async () => {
    const classId = ref('c1')
    const fetch = vi.fn(async (p: { classId: string }) => ({ rows: [p.classId] }))
    const r = useReport(() => ({ classId: classId.value }), fetch)
    expect(r.loading.value).toBe(true)
    await flush()
    expect(fetch).toHaveBeenCalledWith({ classId: 'c1' })
    expect(r.data.value).toEqual({ rows: ['c1'] })
    expect(r.loading.value).toBe(false)
    classId.value = 'c2'
    await flush()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(r.data.value).toEqual({ rows: ['c2'] })
  })

  it("bir xil qiymat qayta so'rov yubormaydi", async () => {
    const a = ref(1)
    const fetch = vi.fn(async () => ({}))
    useReport(() => ({ x: Math.min(a.value, 1) }), fetch)
    await flush()
    a.value = 5 // x baribir 1
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("bo'sh natija: empty true", async () => {
    const r = useReport(
      () => ({}),
      async () => ({ items: [] as number[] }),
      (d) => d.items.length === 0,
    )
    await flush()
    expect(r.empty.value).toBe(true)
    expect(r.error.value).toBeNull()
  })

  it("xato: ApiError holati, ma'lumot tozalanadi; reload qayta urinadi", async () => {
    let fail = true
    const fetch = vi.fn(async () => {
      if (fail) throw new ApiError('FORBIDDEN', 'x', 403)
      return { ok: 1 }
    })
    const r = useReport(() => ({}), fetch)
    await flush()
    expect(r.error.value?.status).toBe(403)
    expect(r.data.value).toBeNull()
    expect(r.idle.value).toBe(false)
    fail = false
    await r.reload()
    expect(r.error.value).toBeNull()
    expect(r.data.value).toEqual({ ok: 1 })
  })

  it("eskirgan javob tashlanadi (oxirgi so'rov yutadi)", async () => {
    const id = ref('a')
    const resolvers: Record<string, (v: string) => void> = {}
    const fetch = (p: { id: string }) =>
      new Promise<string>((res) => {
        resolvers[p.id] = res
      })
    const r = useReport(() => ({ id: id.value }), fetch)
    id.value = 'b'
    await flush()
    resolvers.b!('B')
    await flush()
    resolvers.a!('A') // kechikib keldi
    await flush()
    expect(r.data.value).toBe('B')
  })

  it("manba null ga o'tsa ma'lumot tozalanadi", async () => {
    const on = ref(true)
    const r = useReport(
      () => (on.value ? {} : null),
      async () => ({ a: 1 }),
    )
    await flush()
    expect(r.data.value).toEqual({ a: 1 })
    on.value = false
    await flush()
    expect(r.data.value).toBeNull()
    expect(r.idle.value).toBe(true)
  })
})
