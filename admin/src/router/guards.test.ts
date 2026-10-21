import { describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import type { Role } from '@/api/types'
import { NAV_ITEMS } from '@/constants/navigation'
import { canAccess, firstAllowedRouteName, resolveAccess, type AccessContext } from './guards'

function ctx(role: Role | null, permissions: string[] = []): AccessContext {
  return {
    isAuthenticated: role !== null,
    hasRole: (roles) => !roles || roles.length === 0 || (role !== null && roles.includes(role)),
    hasPermission: (p) => !p || role === 'superadmin' || permissions.includes(p),
  }
}

const route = (name: string, meta: RouteMeta = {}, fullPath = `/${name}`) => ({
  name,
  fullPath,
  meta,
})

describe('resolveAccess', () => {
  it("avtorizatsiyasiz foydalanuvchini /login ga yo'naltiradi (redirect bilan)", () => {
    const r = resolveAccess(route('teachers'), ctx(null))
    expect(r).toEqual({ name: 'login', query: { redirect: '/teachers' } })
  })

  it('login sahifasi mehmonlar uchun ochiq, kirganlarni home ga qaytaradi', () => {
    const meta = { public: true, guestOnly: true }
    expect(resolveAccess(route('login', meta), ctx(null))).toBe(true)
    expect(resolveAccess(route('login', meta), ctx('teacher'))).toEqual({ name: 'home' })
  })

  it('rol mos kelmasa forbidden', () => {
    const meta = { roles: ['superadmin'] as Role[] }
    expect(resolveAccess(route('schools', meta), ctx('school_admin'))).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('schools', meta), ctx('superadmin'))).toBe(true)
  })

  it("ruxsat (permission) yo'q bo'lsa forbidden", () => {
    const meta = { roles: ['school_admin' as Role], permission: 'teachers.manage' }
    expect(resolveAccess(route('teachers', meta), ctx('school_admin', []))).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('teachers', meta), ctx('school_admin', ['teachers.manage']))).toBe(
      true,
    )
  })

  it("home: birinchi ruxsat etilgan sahifaga yo'naltiradi", () => {
    expect(resolveAccess(route('home', {}, '/'), ctx('superadmin'))).toEqual({ name: 'dashboard' })
    expect(resolveAccess(route('home', {}, '/'), ctx('teacher', ['scores.create']))).toEqual({
      name: 'my-classes',
    })
    expect(resolveAccess(route('home', {}, '/'), ctx('school_admin', []))).toEqual({
      name: 'forbidden',
    })
  })
})

describe('menyu / canAccess', () => {
  it("o'qituvchi uchun faqat ruxsat etilgan bandlar", () => {
    expect(firstAllowedRouteName(ctx('teacher', ['dashboard.view']))).toBe('dashboard')
    expect(canAccess(ctx('teacher'), { roles: ['teacher'] })).toBe(true)
    expect(canAccess(ctx('teacher'), { roles: ['superadmin', 'school_admin'] })).toBe(false)
  })
})

describe('2-bosqich marshrutlari', () => {
  const years = { roles: ['superadmin', 'school_admin'] as Role[], permission: 'classes.manage' }
  const classes = {
    roles: ['superadmin', 'school_admin'] as Role[],
    anyPermission: ['classes.manage', 'students.view'],
  }
  const detail = { anyPermission: ['classes.manage', 'students.view', 'scores.create'] }
  const students = { anyPermission: ['students.view', 'students.manage'] }

  it("o'quv yillari: classes.manage kerak", () => {
    expect(
      resolveAccess(route('academic-years', years), ctx('school_admin', ['students.view'])),
    ).toEqual({
      name: 'forbidden',
    })
    expect(
      resolveAccess(route('academic-years', years), ctx('school_admin', ['classes.manage'])),
    ).toBe(true)
    expect(
      resolveAccess(route('academic-years', years), ctx('teacher', ['classes.manage'])),
    ).toEqual({
      name: 'forbidden',
    })
  })

  it('sinflar: ruxsatlardan biri yetarli', () => {
    expect(resolveAccess(route('classes', classes), ctx('school_admin', ['students.view']))).toBe(
      true,
    )
    expect(resolveAccess(route('classes', classes), ctx('school_admin', ['audit.view']))).toEqual({
      name: 'forbidden',
    })
  })

  it("sinf tafsiloti o'qituvchi (scores.create) uchun ochiq, o'quvchilar - students.view bilan", () => {
    expect(resolveAccess(route('class-detail', detail), ctx('teacher', ['scores.create']))).toBe(
      true,
    )
    expect(resolveAccess(route('students', students), ctx('teacher', ['scores.create']))).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('students', students), ctx('teacher', ['students.view']))).toBe(true)
  })

  it('menyu: rol/ruxsatga qarab bandlar', () => {
    const names = (c: AccessContext) => NAV_ITEMS.filter((i) => canAccess(c, i)).map((i) => i.name)
    expect(names(ctx('superadmin'))).toEqual([
      'dashboard',
      'schools',
      'school-admins',
      'academic-years',
      'classes',
      'scoring',
      'scores-history',
      'attendance',
      'attendance-history',
      'students',
      'ratings',
      'reports',
      'teachers',
      'behavior-types',
      'attendance-statuses',
      'audit-logs',
      'settings',
    ])
    expect(names(ctx('teacher', ['students.view']))).toEqual(['my-classes', 'students'])
    expect(names(ctx('teacher', ['scores.create']))).toEqual(['my-classes', 'my-scores'])
    expect(names(ctx('school_admin', ['scores.create']))).toEqual(['scoring'])
    expect(names(ctx('school_admin', ['reports.view']))).toEqual([
      'scores-history',
      'ratings',
      'reports',
    ])
    expect(names(ctx('school_admin', ['classes.manage']))).toEqual(['academic-years', 'classes'])
  })
})

describe('3-bosqich marshrutlari', () => {
  const scoring = { permission: 'scores.create' }
  const myScores = { roles: ['teacher'] as Role[], permission: 'scores.create' }
  const history = {
    roles: ['superadmin', 'school_admin'] as Role[],
    anyPermission: ['reports.view', 'scores.edit'],
  }
  const superOnly = { roles: ['superadmin'] as Role[] }

  it('baholash sahifasi: scores.create kerak', () => {
    expect(resolveAccess(route('class-scoring', scoring), ctx('teacher', ['scores.create']))).toBe(
      true,
    )
    expect(
      resolveAccess(route('class-scoring', scoring), ctx('teacher', ['students.view'])),
    ).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('class-scoring', scoring), ctx('superadmin'))).toBe(true)
  })

  it("/my-scores faqat o'qituvchi uchun", () => {
    expect(resolveAccess(route('my-scores', myScores), ctx('teacher', ['scores.create']))).toBe(
      true,
    )
    expect(
      resolveAccess(route('my-scores', myScores), ctx('school_admin', ['scores.create'])),
    ).toEqual({
      name: 'forbidden',
    })
  })

  it('baholar tarixi: reports.view yoki scores.edit', () => {
    expect(
      resolveAccess(route('scores-history', history), ctx('school_admin', ['scores.edit'])),
    ).toBe(true)
    expect(
      resolveAccess(route('scores-history', history), ctx('school_admin', ['students.view'])),
    ).toEqual({
      name: 'forbidden',
    })
    expect(
      resolveAccess(route('scores-history', history), ctx('teacher', ['reports.view'])),
    ).toEqual({
      name: 'forbidden',
    })
  })

  it('xulq turlari va sozlamalar faqat superadmin', () => {
    for (const name of ['behavior-types', 'settings']) {
      expect(resolveAccess(route(name, superOnly), ctx('superadmin'))).toBe(true)
      expect(
        resolveAccess(route(name, superOnly), ctx('school_admin', ['teachers.manage'])),
      ).toEqual({
        name: 'forbidden',
      })
    }
  })
})

describe('6-bosqich marshrutlari: hisobotlar va audit', () => {
  const reports = { anyPermission: ['reports.view'] }
  const audit = { anyPermission: ['audit.view'] }
  const names = (c: AccessContext) => NAV_ITEMS.filter((i) => canAccess(c, i)).map((i) => i.name)

  it("/reports: reports.view kerak (o'qituvchi ham)", () => {
    expect(resolveAccess(route('reports', reports), ctx('teacher', ['reports.view']))).toBe(true)
    expect(resolveAccess(route('reports', reports), ctx('school_admin', []))).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('reports', reports), ctx('superadmin'))).toBe(true)
  })

  it("/audit-logs: audit.view yoki superadmin; o'qituvchiga yopiq", () => {
    expect(resolveAccess(route('audit-logs', audit), ctx('superadmin'))).toBe(true)
    expect(resolveAccess(route('audit-logs', audit), ctx('school_admin', ['audit.view']))).toBe(
      true,
    )
    expect(
      resolveAccess(route('audit-logs', audit), ctx('school_admin', ['reports.view'])),
    ).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('audit-logs', audit), ctx('teacher', []))).toEqual({
      name: 'forbidden',
    })
  })

  it('menyu: Hisobotlar reports.view bilan, Audit log audit.view bilan', () => {
    expect(names(ctx('teacher', ['reports.view']))).toContain('reports')
    expect(names(ctx('teacher', ['reports.view', 'audit.view']))).not.toContain('audit-logs')
    expect(names(ctx('school_admin', ['audit.view']))).toEqual(['audit-logs'])
    expect(names(ctx('school_admin', []))).not.toContain('reports')
  })
})
