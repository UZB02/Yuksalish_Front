import { describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import type { Role } from '@/api/types'
import { NAV_ITEMS } from '@/constants/navigation'
import { canAccess, resolveAccess, type AccessContext } from './guards'

function ctx(role: Role, permissions: string[] = []): AccessContext {
  return {
    isAuthenticated: true,
    hasRole: (roles) => !roles || roles.length === 0 || roles.includes(role),
    hasPermission: (p) => !p || role === 'superadmin' || permissions.includes(p),
  }
}

const route = (name: string, meta: RouteMeta) => ({ name, fullPath: `/${name}`, meta })

describe('4-bosqich marshrutlari', () => {
  const ratings = route('ratings', { anyPermission: ['reports.view'] })
  const settings = route('settings', { roles: ['superadmin'] })

  it('/ratings: reports.view yoki superadmin', () => {
    expect(resolveAccess(ratings, ctx('superadmin'))).toBe(true)
    expect(resolveAccess(ratings, ctx('school_admin', ['reports.view']))).toBe(true)
    expect(resolveAccess(ratings, ctx('teacher', ['reports.view']))).toBe(true)
    expect(resolveAccess(ratings, ctx('teacher', ['scores.create']))).toEqual({ name: 'forbidden' })
  })

  it('/settings faqat superadmin', () => {
    expect(resolveAccess(settings, ctx('superadmin'))).toBe(true)
    expect(resolveAccess(settings, ctx('school_admin', ['reports.view']))).toEqual({
      name: 'forbidden',
    })
  })

  it('menyuda "Reyting" ruxsat boʼyicha', () => {
    const has = (c: AccessContext) =>
      NAV_ITEMS.filter((i) => canAccess(c, i)).some((i) => i.name === 'ratings')
    expect(has(ctx('superadmin'))).toBe(true)
    expect(has(ctx('school_admin', ['reports.view']))).toBe(true)
    expect(has(ctx('school_admin', ['students.view']))).toBe(false)
  })
})
