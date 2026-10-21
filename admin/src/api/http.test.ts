import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { bareHttp, http, setUnauthorizedHandler } from './http'
import { ApiError } from './errors'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import type { User } from './types'

const baseUser: User = {
  id: 'u1',
  fullName: 'Test User',
  username: 'test',
  role: 'superadmin',
  schoolId: null,
  permissions: [],
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config })
}

function fail(config: InternalAxiosRequestConfig, status: number, body?: unknown) {
  const response = { data: body, status, statusText: '', headers: {}, config }
  return Promise.reject(new AxiosError('fail', String(status), config, null, response))
}

describe('http interceptors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setUnauthorizedHandler(null)
  })

  it("Authorization va X-School-Id (faqat superadmin) sarlavhalarini qo'shadi", async () => {
    const seen: Record<string, unknown>[] = []
    http.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      seen.push({
        auth: config.headers.get('Authorization'),
        school: config.headers.get('X-School-Id'),
      })
      return ok(config, { success: true, data: [] })
    }) as AxiosAdapter

    const auth = useAuthStore()
    const ctx = useSchoolContextStore()
    auth.setSession('tok-1', baseUser)
    ctx.select('school-9')
    await http.get('/teachers')

    auth.setSession('tok-1', { ...baseUser, role: 'school_admin', schoolId: 'school-1' })
    await http.get('/teachers')

    expect(seen[0]).toEqual({ auth: 'Bearer tok-1', school: 'school-9' })
    expect(seen[1]).toEqual({ auth: 'Bearer tok-1', school: undefined })
  })

  it("401 da bitta refresh qiladi, parallel so'rovlar uni kutadi va qayta yuboriladi", async () => {
    const auth = useAuthStore()
    auth.setSession('old', baseUser)
    const refresh = vi.fn((config: InternalAxiosRequestConfig) =>
      ok(config, { success: true, data: { accessToken: 'new', user: baseUser } }),
    )
    bareHttp.defaults.adapter = refresh as unknown as AxiosAdapter
    http.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.headers.get('Authorization') === 'Bearer new') {
        return ok(config, { success: true, data: config.url })
      }
      return fail(config, 401, { success: false, error: { code: 'UNAUTHORIZED', message: 'x' } })
    }) as AxiosAdapter

    const [a, b, c] = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect([a.data.data, b.data.data, c.data.data]).toEqual(['/a', '/b', '/c'])
    expect(auth.accessToken).toBe('new')
  })

  it("refresh muvaffaqiyatsiz bo'lsa sessiyani tozalaydi va handlerni chaqiradi", async () => {
    const auth = useAuthStore()
    auth.setSession('old', baseUser)
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    bareHttp.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      fail(config, 401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'expired' },
      })) as AxiosAdapter
    http.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      fail(config, 401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'expired' },
      })) as AxiosAdapter

    await expect(http.get('/teachers')).rejects.toBeInstanceOf(ApiError)
    expect(auth.accessToken).toBeNull()
    expect(auth.user).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("serverdagi xato formatini ApiError ga o'giradi (details bilan)", async () => {
    http.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      fail(config, 400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid',
          details: [{ path: 'slug', message: 'band' }],
        },
      })) as AxiosAdapter

    const err = await http.post('/schools', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.details).toEqual([{ path: 'slug', message: 'band' }])
  })

  it('token localStorage ga yozilmaydi', () => {
    useAuthStore().setSession('secret-token', baseUser)
    const dump = JSON.stringify({ ...localStorage })
    expect(dump).not.toContain('secret-token')
  })
})
