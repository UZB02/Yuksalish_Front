import { describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import type { Role } from '@/api/types'
import { resolveAccess, type AccessContext } from './guards'

function ctx(
  role: Role | null,
  permissions: string[] = [],
  extra: Partial<AccessContext> = {},
): AccessContext {
  return {
    isAuthenticated: role !== null,
    hasRole: (roles) => !roles || roles.length === 0 || (role !== null && roles.includes(role)),
    hasPermission: (p) => !p || role === 'superadmin' || permissions.includes(p),
    ...extra,
  }
}

const home = (go?: string) => ({
  name: 'home',
  fullPath: go ? `/?go=${go}` : '/',
  meta: {} as RouteMeta,
  query: (go ? { go } : {}) as Record<string, string>,
})

describe('PWA shortcutlar (/?go=)', () => {
  it("scoring: o'qituvchiga my-classes, adminga scoring", () => {
    expect(resolveAccess(home('scoring'), ctx('teacher', ['scores.create']))).toEqual({
      name: 'my-classes',
    })
    expect(resolveAccess(home('scoring'), ctx('school_admin', ['scores.create']))).toEqual({
      name: 'scoring',
    })
  })

  it('grading va attendance ruxsatga qarab', () => {
    expect(resolveAccess(home('grading'), ctx('teacher', ['grades.create']))).toEqual({
      name: 'grading',
    })
    expect(resolveAccess(home('attendance'), ctx('teacher', ['attendance.take']))).toEqual({
      name: 'attendance',
    })
  })

  it("ruxsat yo'q bo'lsa shortcut e'tiborsiz, odatiy bosh sahifaga", () => {
    const r = resolveAccess(home('grading'), ctx('teacher', ['dashboard.view']))
    expect(r).toEqual({ name: 'dashboard' })
  })

  it("noma'lum go qiymati e'tiborsiz", () => {
    expect(resolveAccess(home('hack'), ctx('teacher', ['dashboard.view']))).toEqual({
      name: 'dashboard',
    })
  })

  it("kirmagan foydalanuvchi login'ga, redirect bilan (shortcut saqlanadi)", () => {
    expect(resolveAccess(home('attendance'), ctx(null))).toEqual({
      name: 'login',
      query: { redirect: '/?go=attendance' },
    })
  })
})

describe('offline holat', () => {
  it("tarmoq xatosida himoyalangan sahifa /offline ga (login'ga emas) yo'naltiradi", () => {
    const to = { name: 'classes', fullPath: '/classes?x=1', meta: {} as RouteMeta }
    expect(resolveAccess(to, ctx(null, [], { networkError: true }))).toEqual({
      name: 'offline',
      query: { redirect: '/classes?x=1' },
    })
  })

  it('offline sahifasi va login ochiq', () => {
    const offline = { name: 'offline', fullPath: '/offline', meta: { public: true } as RouteMeta }
    expect(resolveAccess(offline, ctx(null, [], { networkError: true }))).toBe(true)
  })

  it("tarmoq xatosi bo'lmasa oddiy login redirect", () => {
    const to = { name: 'classes', fullPath: '/classes', meta: {} as RouteMeta }
    expect(resolveAccess(to, ctx(null))).toEqual({
      name: 'login',
      query: { redirect: '/classes' },
    })
  })
})
