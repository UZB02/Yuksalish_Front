import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { downloadFile, parseFilename } from './download'
import { http } from './http'
import { useAuthStore } from '@/stores/auth'

describe('parseFilename', () => {
  it("oddiy va qo'shtirnoqli filename", () => {
    expect(parseFilename('attachment; filename=students.xlsx')).toBe('students.xlsx')
    expect(parseFilename('attachment; filename="o quvchilar.xlsx"')).toBe('o quvchilar.xlsx')
  })
  it('filename* (UTF-8) ustun turadi', () => {
    expect(
      parseFilename('attachment; filename="x.xlsx"; filename*=UTF-8\'\'o%CA%BBquvchilar.xlsx'),
    ).toBe('oʻquvchilar.xlsx')
  })
  it("sarlavha bo'lmasa null", () => {
    expect(parseFilename(undefined)).toBeNull()
    expect(parseFilename('inline')).toBeNull()
  })
})

describe('downloadFile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it("auth sarlavhasi va blob bilan so'raydi, fayl nomini sarlavhadan oladi", async () => {
    useAuthStore().setSession('tok', {
      id: '1',
      fullName: 'A',
      username: 'a',
      role: 'school_admin',
      schoolId: 's1',
      permissions: [],
      isActive: true,
      lastLoginAt: null,
      createdAt: '',
    })
    let seen: { auth?: unknown; type?: unknown; params?: unknown } = {}
    http.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      seen = {
        auth: config.headers.get('Authorization'),
        type: config.responseType,
        params: config.params,
      }
      return Promise.resolve({
        data: new Blob(['x']),
        status: 200,
        statusText: 'OK',
        headers: { 'content-disposition': 'attachment; filename="sinf-7a.xlsx"' },
        config,
      })
    }) as AxiosAdapter

    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const name = await downloadFile('/students/export', {
      params: { classId: 'c1' },
      fallbackName: 'fallback.xlsx',
    })

    expect(seen).toEqual({ auth: 'Bearer tok', type: 'blob', params: { classId: 'c1' } })
    expect(name).toBe('sinf-7a.xlsx')
    expect(click).toHaveBeenCalledTimes(1)
  })
})
