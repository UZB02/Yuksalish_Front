import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { refreshAccessToken } from '@/api/http'
import { ApiError } from '@/api/errors'
import type { User } from '@/api/types'

vi.mock('@/api/auth.api', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn(), changePassword: vi.fn() },
}))
vi.mock('@/api/http', () => ({ refreshAccessToken: vi.fn() }))

const user: User = {
  id: 't1',
  fullName: "O'qituvchi",
  username: 'teacher1',
  role: 'teacher',
  schoolId: 's1',
  permissions: [],
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('auth.init: tarmoq xatosi va logout farqi', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('tarmoq xatosi sessiyani tozalamaydi: networkError yoqiladi, init tugaydi', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new ApiError('NETWORK', 'Network Error'))
    const auth = useAuthStore()
    auth.setSession('tok', user)
    await auth.init()
    expect(auth.networkError).toBe(true)
    expect(auth.initialized).toBe(true)
    expect(auth.accessToken).toBe('tok')
    expect(auth.user).not.toBeNull()
  })

  it('401 sessiyani tozalaydi (logout)', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new ApiError('UNAUTHORIZED', 'no', 401))
    const auth = useAuthStore()
    auth.setSession('tok', user)
    await auth.init()
    expect(auth.networkError).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
  })

  it("retryInit: internet qaytgach sessiya tiklanadi va networkError o'chadi", async () => {
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(new ApiError('NETWORK', 'Network Error'))
    const auth = useAuthStore()
    await auth.init()
    expect(auth.networkError).toBe(true)

    vi.mocked(refreshAccessToken).mockResolvedValueOnce('new-token')
    await auth.retryInit()
    expect(auth.networkError).toBe(false)
    expect(refreshAccessToken).toHaveBeenCalledTimes(2)
  })
})
