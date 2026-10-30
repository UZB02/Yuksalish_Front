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

const route = (name: string, meta: RouteMeta = {}) => ({ name, fullPath: `/${name}`, meta })

describe('dars jadvali (P1) marshrutlari va menyusi', () => {
  const names = (c: AccessContext) => NAV_ITEMS.filter((i) => canAccess(c, i)).map((i) => i.name)
  const home = { anyPermission: ['timetable.view', 'timetable.manage'] }
  const mine = { roles: ['teacher'] as Role[] }

  it("menyu: timetable view/manage bilan; my-timetable faqat o'qituvchiga", () => {
    expect(names(ctx('school_admin', ['timetable.view']))).toEqual(['timetable'])
    expect(names(ctx('school_admin', ['timetable.manage']))).toEqual(['timetable'])
    expect(names(ctx('school_admin', ['classes.manage']))).not.toContain('timetable')
    expect(names(ctx('school_admin', ['timetable.manage']))).not.toContain('my-timetable')
    expect(names(ctx('teacher'))).toEqual(['my-classes', 'my-timetable'])
    expect(names(ctx('teacher', ['timetable.view']))).toEqual([
      'my-classes',
      'timetable',
      'my-timetable',
    ])
    expect(names(ctx('superadmin'))).toContain('timetable')
    expect(names(ctx('superadmin'))).not.toContain('my-timetable')
  })

  it('/timetable: view yoki manage kerak', () => {
    expect(resolveAccess(route('timetable', home), ctx('school_admin', ['timetable.view']))).toBe(
      true,
    )
    expect(resolveAccess(route('timetable', home), ctx('school_admin', ['timetable.manage']))).toBe(
      true,
    )
    expect(resolveAccess(route('timetable', home), ctx('school_admin', ['audit.view']))).toEqual({
      name: 'forbidden',
    })
    expect(resolveAccess(route('timetable', home), ctx('teacher'))).toEqual({ name: 'forbidden' })
  })

  it('almashtirishlar: faqat timetable.substitute bilan (view/manage yetmaydi)', () => {
    const sub = { permission: 'timetable.substitute' }
    expect(names(ctx('school_admin', ['timetable.substitute']))).toEqual(['substitutions'])
    expect(names(ctx('school_admin', ['timetable.view', 'timetable.manage']))).not.toContain(
      'substitutions',
    )
    expect(names(ctx('teacher', ['timetable.substitute']))).toContain('substitutions')
    expect(names(ctx('superadmin'))).toContain('substitutions')
    expect(
      resolveAccess(route('substitutions', sub), ctx('school_admin', ['timetable.substitute'])),
    ).toBe(true)
    expect(
      resolveAccess(route('substitutions', sub), ctx('school_admin', ['timetable.view'])),
    ).toEqual({ name: 'forbidden' })
  })

  it('/my-timetable faqat o`qituvchi uchun', () => {
    expect(resolveAccess(route('my-timetable', mine), ctx('teacher'))).toBe(true)
    expect(
      resolveAccess(route('my-timetable', mine), ctx('school_admin', ['timetable.view'])),
    ).toEqual({ name: 'forbidden' })
  })

  it("birinchi ruxsat etilgan sahifa: faqat timetable.view bo'lgan admin /timetable ga tushadi", () => {
    expect(firstAllowedRouteName(ctx('school_admin', ['timetable.view']))).toBe('timetable')
    expect(firstAllowedRouteName(ctx('teacher'))).toBe('my-classes')
  })
})
