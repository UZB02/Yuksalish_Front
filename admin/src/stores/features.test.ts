import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { User } from '@/api/types'
import { useAuthStore } from './auth'
import { useFeaturesStore } from './features'
import { useSchoolContextStore } from './school-context'

const get = vi.fn()
vi.mock('@/api/settings.api', () => ({
  settingsApi: { get: (...a: unknown[]) => get(...a) },
}))

const res = (enabled: boolean) => ({
  effective: { enabled, teachersCanCreateQuizzes: true, candidateRetentionDays: 365 },
  global: {},
  override: null,
})
const flush = async () => {
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
}

function setup(user: Partial<User> | null) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  if (user) auth.setSession('t', { id: 'u1', permissions: [], ...user } as unknown as User)
  return { auth, school: useSchoolContextStore(), features: useFeaturesStore() }
}

beforeEach(() => {
  get.mockReset()
  localStorage.clear()
})

describe('features store (imtihon moduli bayrog`i)', () => {
  it('standart: o`chiq; kirmagan foydalanuvchi uchun so`rov yuborilmaydi', async () => {
    const { features } = setup(null)
    await flush()
    expect(features.isEnabled('exams')).toBe(false)
    expect(get).not.toHaveBeenCalled()
  })

  it("maktab xodimi: o'z maktabi sozlamasi (X-School-Id yuborilmaydi)", async () => {
    get.mockResolvedValue(res(true))
    const { features } = setup({ role: 'teacher', schoolId: 's1' })
    await flush()
    expect(get).toHaveBeenCalledWith('exams', undefined)
    expect(features.isEnabled('exams')).toBe(true)
  })

  it("server o'chiq desa yoki xato qaytarsa modul o'chiq", async () => {
    get.mockResolvedValue(res(false))
    const a = setup({ role: 'teacher', schoolId: 's1' })
    await flush()
    expect(a.features.isEnabled('exams')).toBe(false)

    get.mockRejectedValue(new Error('403'))
    const b = setup({ role: 'school_admin', schoolId: 's1' })
    await flush()
    expect(b.features.isEnabled('exams')).toBe(false)
  })

  it('superadmin: maktab tanlanmaguncha so`rov yo`q; tanlangach shu maktab uchun, almashsa qayta', async () => {
    get.mockImplementation((_k: string, sid?: string) => Promise.resolve(res(sid === 'A')))
    const { features, school } = setup({ role: 'superadmin' })
    await flush()
    expect(get).not.toHaveBeenCalled()
    expect(features.isEnabled('exams')).toBe(false)

    school.select('A')
    await flush()
    expect(get).toHaveBeenLastCalledWith('exams', 'A')
    expect(features.isEnabled('exams')).toBe(true)

    school.select('B')
    await nextTick()
    // almashgan zahoti eski maktab menyusi qolmaydi
    expect(features.isEnabled('exams')).toBe(false)
    await flush()
    expect(get).toHaveBeenLastCalledWith('exams', 'B')
    expect(features.isEnabled('exams')).toBe(false)
  })

  it('refresh sozlama o`zgargandan keyin qayta yuklaydi, load keshlanadi', async () => {
    get.mockResolvedValueOnce(res(false))
    const { features } = setup({ role: 'school_admin', schoolId: 's1' })
    await flush()
    await features.load()
    expect(get).toHaveBeenCalledTimes(1)
    get.mockResolvedValueOnce(res(true))
    await features.refresh()
    expect(get).toHaveBeenCalledTimes(2)
    expect(features.isEnabled('exams')).toBe(true)
  })

  it('eskirgan javob (maktab almashgan) natijani buzmaydi', async () => {
    let resolveA: (v: unknown) => void = () => undefined
    get.mockImplementation((_k: string, sid?: string) =>
      sid === 'A' ? new Promise((r) => (resolveA = r)) : Promise.resolve(res(false)),
    )
    const { features, school } = setup({ role: 'superadmin' })
    school.select('A')
    await nextTick()
    school.select('B')
    await flush()
    resolveA(res(true)) // A ning kechikkan javobi
    await flush()
    expect(features.isEnabled('exams')).toBe(false)
  })
})
