import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth.api'
import { refreshAccessToken } from '@/api/http'
import { toApiError } from '@/api/errors'
import { TEACHER_ALWAYS } from '@/constants/permissions'
import type { LoginPayload, Role, User } from '@/api/types'

/** Access token faqat xotirada saqlanadi (localStorage ga yozilmaydi). */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<User | null>(null)
  const initialized = ref(false)
  /** Ilova ochilganda tarmoq yo'q edi: sessiya holati noma'lum (logout EMAS). */
  const networkError = ref(false)
  let initPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const role = computed<Role | null>(() => user.value?.role ?? null)
  const isSuperadmin = computed(() => user.value?.role === 'superadmin')

  function setSession(token: string, nextUser: User) {
    accessToken.value = token
    user.value = nextUser
  }

  function clearSession() {
    accessToken.value = null
    user.value = null
  }

  function hasRole(roles?: Role[]) {
    if (!roles || roles.length === 0) return true
    return !!user.value && roles.includes(user.value.role)
  }

  function hasPermission(permission?: string) {
    if (!permission) return true
    if (!user.value) return false
    if (user.value.role === 'superadmin') return true
    // O'qituvchida davomat olish ruxsati doim bor
    if (user.value.role === 'teacher' && TEACHER_ALWAYS.includes(permission)) return true
    return user.value.permissions.includes(permission)
  }

  async function login(payload: LoginPayload) {
    const result = await authApi.login(payload)
    setSession(result.accessToken, result.user)
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // Server xato bersa ham mahalliy sessiya tozalanadi.
    } finally {
      clearSession()
    }
  }

  /**
   * Ilova yuklanganda httpOnly cookie orqali sessiyani tiklaydi (bir marta).
   * Tarmoq xatosi sessiyani bekor qilmaydi: `networkError` yoqiladi va "Internet yo'q" ekrani
   * ko'rsatiladi. Faqat server rad etsa (401 va h.k.) sessiya tozalanadi.
   */
  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = refreshAccessToken()
        .then(() => {
          networkError.value = false
        })
        .catch((e: unknown) => {
          if (toApiError(e).code === 'NETWORK') {
            networkError.value = true
            return
          }
          networkError.value = false
          clearSession()
        })
        .finally(() => {
          initialized.value = true
        })
    }
    return initPromise
  }

  /** "Qayta urinish": tarmoq xatosidan keyin sessiyani qaytadan tiklashga urinadi. */
  function retryInit(): Promise<void> {
    initPromise = null
    return init()
  }

  async function fetchMe() {
    user.value = await authApi.me()
  }

  return {
    accessToken,
    user,
    initialized,
    networkError,
    isAuthenticated,
    role,
    isSuperadmin,
    setSession,
    clearSession,
    hasRole,
    hasPermission,
    login,
    logout,
    init,
    retryInit,
    fetchMe,
  }
})
