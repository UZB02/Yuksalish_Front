import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { authApi } from '@/api/auth.api'
import type { User } from '@/api/types'

vi.mock('@/api/auth.api', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn(), changePassword: vi.fn() },
}))

const teacher: User = {
  id: 't1',
  fullName: "O'qituvchi",
  username: 'teacher1',
  role: 'teacher',
  schoolId: 's1',
  permissions: ['dashboard.view', 'scores.create'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login sessiyani xotirada saqlaydi', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ accessToken: 'abc', user: teacher })
    const auth = useAuthStore()
    await auth.login({ username: 'teacher1', password: 'x' })
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.accessToken).toBe('abc')
    expect(auth.role).toBe('teacher')
  })

  it("hasPermission: o'qituvchi faqat o'z ruxsatlariga ega", () => {
    const auth = useAuthStore()
    auth.setSession('abc', teacher)
    expect(auth.hasPermission('scores.create')).toBe(true)
    expect(auth.hasPermission('teachers.manage')).toBe(false)
    expect(auth.hasPermission(undefined)).toBe(true)
  })

  it('superadmin hamma ruxsatga ega', () => {
    const auth = useAuthStore()
    auth.setSession('abc', { ...teacher, role: 'superadmin', permissions: [] })
    expect(auth.hasPermission('audit.view')).toBe(true)
    expect(auth.isSuperadmin).toBe(true)
  })

  it("hasRole rol ro'yxatini tekshiradi", () => {
    const auth = useAuthStore()
    auth.setSession('abc', teacher)
    expect(auth.hasRole(['superadmin'])).toBe(false)
    expect(auth.hasRole(['teacher', 'school_admin'])).toBe(true)
    expect(auth.hasRole()).toBe(true)
  })

  it('logout server xato bersa ham mahalliy sessiyani tozalaydi', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network'))
    const auth = useAuthStore()
    auth.setSession('abc', teacher)
    await auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.accessToken).toBeNull()
  })
})
