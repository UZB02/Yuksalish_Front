import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { toApiError } from './errors'
import type { ApiSuccess, AuthResult, Paginated } from './types'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
})

/** Interceptorsiz instans: refresh/login chaqiruvlari uchun (aylanma halqaning oldini oladi). */
export const bareHttp = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let unauthorizedHandler: (() => void) | null = null

/** Sessiyani tiklab bo'lmaganda chaqiriladi (odatda /login ga yo'naltirish). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

/** blob so'rovida xato javobi ham Blob bo'ladi: JSON tanasini o'qib, odatiy xato shakliga qaytaradi. */
async function unwrapBlobError(error: AxiosError) {
  const data: unknown = error.response?.data
  if (!(data instanceof Blob) || typeof data.text !== 'function') return
  try {
    error.response!.data = JSON.parse(await data.text())
  } catch {
    // JSON emas: tanasiz xato sifatida qoladi
  }
}

let refreshPromise: Promise<string> | null = null

/** Yagona refresh: parallel 401 lar bitta /auth/refresh so'rovini kutadi. */
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = bareHttp
      .post<ApiSuccess<AuthResult>>('/auth/refresh')
      .then((res) => {
        const { accessToken, user } = res.data.data
        useAuthStore().setSession(accessToken, user)
        return accessToken
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

const isAuthUrl = (url?: string) => !!url && /\/auth\/(login|refresh)/.test(url)

http.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.set('Authorization', `Bearer ${auth.accessToken}`)
  }
  if (auth.user?.role === 'superadmin') {
    const schoolId = useSchoolContextStore().schoolId
    // Aniq berilgan sarlavha (masalan sozlamalarda boshqa maktab uchun) ustun turadi.
    if (schoolId && !config.headers.has('X-School-Id')) config.headers.set('X-School-Id', schoolId)
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    await unwrapBlobError(error)
    const original = error.config as RetriableConfig | undefined
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthUrl(original.url)
    ) {
      original._retry = true
      let token: string
      try {
        token = await refreshAccessToken()
      } catch (refreshError) {
        // Refresh muvaffaqiyatsiz: sessiya tugagan -> logout va /login ga yo'naltirish.
        const failed = toApiError(refreshError)
        if (failed.code !== 'NETWORK') {
          useAuthStore().clearSession()
          unauthorizedHandler?.()
        }
        return Promise.reject(toApiError(error))
      }
      original.headers.set('Authorization', `Bearer ${token}`)
      return http(original)
    }
    return Promise.reject(toApiError(error))
  },
)

/** undefined / bo'sh qiymatlarni so'rov parametrlaridan olib tashlaydi. */
export function clean(params?: object): Record<string, unknown> | undefined {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

export async function getData<T>(url: string, params?: object): Promise<T> {
  const res = await http.get<ApiSuccess<T>>(url, { params: clean(params) })
  return res.data.data
}

export async function getPage<T>(url: string, params?: object): Promise<Paginated<T>> {
  const res = await http.get<ApiSuccess<T[]>>(url, { params: clean(params) })
  const items = res.data.data
  return {
    items,
    meta: res.data.meta ?? { page: 1, limit: items.length, total: items.length, totalPages: 1 },
  }
}

export async function sendData<T>(
  method: 'post' | 'patch' | 'put',
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await http.request<ApiSuccess<T>>({ method, url, data: body })
  return res.data.data
}

/** Rasm yuklash (multipart, maydon nomi `photo`) */
export async function putPhoto<T>(url: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('photo', file)
  const res = await http.put<ApiSuccess<T>>(url, form, { timeout: 60000 })
  return res.data.data
}

export async function deleteData<T>(url: string): Promise<T> {
  const res = await http.delete<ApiSuccess<T>>(url)
  return res.data.data
}
