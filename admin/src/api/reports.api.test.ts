import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { exportErrorMessage } from '@/utils/errors'
import { isApiError } from './errors'
import { http } from './http'
import { reportPath, reportsApi } from './reports.api'

interface Seen {
  url?: string
  params?: Record<string, unknown>
  type?: unknown
  auth?: unknown
  school?: unknown
}

function mockAdapter(respond: (config: InternalAxiosRequestConfig) => unknown): Seen {
  const seen: Seen = {}
  http.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    seen.url = config.url
    seen.params = config.params
    seen.type = config.responseType
    seen.auth = config.headers.get('Authorization')
    seen.school = config.headers.get('X-School-Id')
    const out = respond(config) as { status?: number; data?: unknown; headers?: object }
    if ((out.status ?? 200) >= 400) {
      const err = new Error('Request failed') as AxiosError
      err.config = config
      err.response = {
        status: out.status!,
        data: out.data,
        headers: {},
        statusText: '',
        config,
      } as AxiosError['response']
      throw err
    }
    return { status: 200, statusText: 'OK', headers: {}, config, ...out }
  }) as AxiosAdapter
  return seen
}

describe('reportPath', () => {
  it("o'quvchi hisoboti id ni yo'lda oladi, qolganlari turi bilan", () => {
    expect(reportPath('student', 's1')).toBe('/reports/student/s1')
    expect(reportPath('class')).toBe('/reports/class')
    expect(reportPath('schools')).toBe('/reports/schools')
  })
})

describe("reportsApi so'rovlari", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
  })

  it('sinf hisoboti: from/to/classId yuboriladi, data qaytariladi', async () => {
    const seen = mockAdapter(() => ({ data: { success: true, data: { meta: {}, students: [] } } }))
    const res = await reportsApi.class({ classId: 'c1', from: '2026-10-01', to: '2026-10-17' })
    expect(seen.url).toBe('/reports/class')
    expect(seen.params).toEqual({ classId: 'c1', from: '2026-10-01', to: '2026-10-17' })
    expect(seen.auth).toBe('Bearer tok')
    expect(res).toEqual({ meta: {}, students: [] })
  })

  it("o'qituvchilar: bo'sh classId parametrga kirmaydi", async () => {
    const seen = mockAdapter(() => ({ data: { success: true, data: { teachers: [] } } }))
    await reportsApi.teachers({ from: '2026-10-01', to: '2026-10-17', classId: '' })
    expect(seen.params).toEqual({ from: '2026-10-01', to: '2026-10-17' })
  })

  it("o'quvchi hisoboti yo'li", async () => {
    const seen = mockAdapter(() => ({ data: { success: true, data: {} } }))
    await reportsApi.student('s9', { from: '2026-10-01', to: '2026-10-02' })
    expect(seen.url).toBe('/reports/student/s9')
  })
})

describe('reportsApi.export', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })

  it("blob so'raydi, format va davrni yuboradi, nomni sarlavhadan oladi", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const seen = mockAdapter(() => ({
      data: new Blob(['x']),
      headers: { 'content-disposition': "attachment; filename*=UTF-8''sinf-7a.xlsx" },
    }))
    const name = await reportsApi.export('class', 'xlsx', {
      from: '2026-10-01',
      to: '2026-10-17',
      classId: 'c1',
    })
    expect(name).toBe('sinf-7a.xlsx')
    expect(seen.url).toBe('/reports/class/export')
    expect(seen.type).toBe('blob')
    expect(seen.params).toEqual({
      from: '2026-10-01',
      to: '2026-10-17',
      classId: 'c1',
      format: 'xlsx',
    })
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("o'quvchi eksporti yo'li va zaxira fayl nomi", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const seen = mockAdapter(() => ({ data: new Blob(['x']) }))
    const name = await reportsApi.export(
      'student',
      'pdf',
      { from: '2026-10-01', to: '2026-10-02' },
      's1',
    )
    expect(seen.url).toBe('/reports/student/s1/export')
    expect(seen.params?.format).toBe('pdf')
    expect(name).toBe('hisobot-student.pdf')
  })

  it("403: ApiError FORBIDDEN, aniq xabar (reports.export yo'q)", async () => {
    const body = new Blob([
      JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: "Ruxsat yo'q" } }),
    ])
    mockAdapter(() => ({ status: 403, data: body }))
    const err = await reportsApi
      .export('school', 'pdf', { from: '2026-10-01', to: '2026-10-02' })
      .catch((e) => e)
    expect(isApiError(err)).toBe(true)
    expect(err.status).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
    expect(exportErrorMessage(err, (k) => k)).toBe('reports.exportForbidden')
  })

  it('400: server xabari (blob ichidagi JSON) saqlanadi', async () => {
    const body = new Blob([
      JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Davrni qisqartiring' },
      }),
    ])
    mockAdapter(() => ({ status: 400, data: body }))
    const err = await reportsApi
      .export('teachers', 'xlsx', { from: '2020-01-01', to: '2026-10-02' })
      .catch((e) => e)
    expect(err.status).toBe(400)
    expect(err.message).toBe('Davrni qisqartiring')
    expect(exportErrorMessage(err, (k) => k)).toBe('Davrni qisqartiring')
  })

  it("400: details[0] xabari (maydon bo'yicha) umumiy xabardan ustun", async () => {
    const body = new Blob([
      JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: "Ma'lumotlar noto'g'ri",
          details: [{ path: 'to', message: 'Davr 366 kundan oshmasligi kerak' }],
        },
      }),
    ])
    mockAdapter(() => ({ status: 400, data: body }))
    const err = await reportsApi
      .export('school', 'pdf', { from: '2020-01-01', to: '2026-10-02' })
      .catch((e) => e)
    expect(exportErrorMessage(err, (k) => k)).toBe('Davr 366 kundan oshmasligi kerak')
  })

  it("JSON bo'lmagan xato tanasi: kod holatdan olinadi", async () => {
    mockAdapter(() => ({ status: 400, data: new Blob(['not json']) }))
    const err = await reportsApi
      .export('class', 'xlsx', { from: '2026-10-01', to: '2026-10-02', classId: 'c' })
      .catch((e) => e)
    expect(err.code).toBe('VALIDATION_ERROR')
    // aniq xabar yo'q -> umumiy kod xabari
    expect(exportErrorMessage(err, (k) => (k.startsWith('errors.codes') ? 'KOD' : k))).not.toBe('')
  })
})
