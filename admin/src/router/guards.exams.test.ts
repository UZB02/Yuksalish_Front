import { describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import type { Role } from '@/api/types'
import { NAV_GROUPS, NAV_ITEMS } from '@/constants/navigation'
import { PERMISSIONS } from '@/constants/permissions'
import { canAccess, firstAllowedRouteName, resolveAccess, type AccessContext } from './guards'
import router from './index'

function ctx(role: Role | null, permissions: string[] = [], examsOn = false): AccessContext {
  return {
    isAuthenticated: role !== null,
    hasRole: (roles) => !roles || roles.length === 0 || (role !== null && roles.includes(role)),
    hasPermission: (p) => !p || role === 'superadmin' || permissions.includes(p),
    isFeatureEnabled: (f) => f === 'exams' && examsOn,
  }
}
const item = NAV_ITEMS.find((i) => i.name === 'exam-questions')!
const route = (name: string, meta: RouteMeta) => ({ name, fullPath: `/${name}`, meta })

describe('Imtihonlar menyusi: ruxsat + modul bayrog`i', () => {
  it('menyu bandi mavjud, "exams" guruhida, feature=exams va ikkita ruxsatdan biri bilan', () => {
    expect(item).toBeTruthy()
    expect(item.feature).toBe('exams')
    expect(item.anyPermission).toEqual([PERMISSIONS.EXAMS_QUESTIONS, PERMISSIONS.EXAMS_MANAGE])
    expect(NAV_GROUPS.map((g) => g.key)).toContain(item.group)
  })

  it("modul o'chiq bo'lsa hech kimga ko'rinmaydi (superadmin ham, o'qituvchi ham)", () => {
    expect(canAccess(ctx('superadmin', [], false), item)).toBe(false)
    expect(canAccess(ctx('teacher', ['exams.questions'], false), item)).toBe(false)
    expect(canAccess(ctx('school_admin', ['exams.manage'], false), item)).toBe(false)
  })

  it('modul yoqilgan: exams.questions yoki exams.manage bor foydalanuvchiga ko`rinadi', () => {
    expect(canAccess(ctx('teacher', ['exams.questions'], true), item)).toBe(true)
    expect(canAccess(ctx('school_admin', ['exams.manage'], true), item)).toBe(true)
    expect(canAccess(ctx('superadmin', [], true), item)).toBe(true)
  })

  it("modul yoqilgan, lekin ruxsat yo'q: ko'rinmaydi", () => {
    expect(canAccess(ctx('school_admin', ['students.view'], true), item)).toBe(false)
    expect(canAccess(ctx('teacher', ['exams.grade'], true), item)).toBe(false)
  })

  it('isFeatureEnabled berilmasa feature talab qilgan band yopiq (xavfsiz standart)', () => {
    const noFeature = { hasRole: () => true, hasPermission: () => true }
    expect(canAccess(noFeature, item)).toBe(false)
    // feature talab qilmaydigan bandlar o'zgarmagan
    expect(
      canAccess(
        noFeature,
        NAV_ITEMS.find((i) => i.name === 'classes')!,
      ),
    ).toBe(true)
  })

  it('marshrut guard: modul o`chiq -> forbidden; yoqiq -> o`tadi', () => {
    const meta: RouteMeta = { anyPermission: ['exams.questions', 'exams.manage'], feature: 'exams' }
    expect(
      resolveAccess(route('exam-questions', meta), ctx('teacher', ['exams.questions'], false)),
    ).toEqual({
      name: 'forbidden',
    })
    expect(
      resolveAccess(route('exam-questions', meta), ctx('teacher', ['exams.questions'], true)),
    ).toBe(true)
    expect(resolveAccess(route('exam-questions', meta), ctx('teacher', [], true))).toEqual({
      name: 'forbidden',
    })
  })

  it("haqiqiy marshrutlar feature va ruxsat bilan e'lon qilingan", () => {
    for (const name of [
      'exam-questions',
      'exam-subject',
      'exam-topic',
      'exam-question-create',
      'exam-question-edit',
      'exam-question-import',
    ]) {
      const r = router.getRoutes().find((x) => x.name === name)!
      expect(r, name).toBeTruthy()
      expect(r.meta.feature, name).toBe('exams')
      expect(r.meta.anyPermission, name).toEqual(['exams.questions', 'exams.manage'])
    }
  })

  it("bosh sahifa yo'naltirishi imtihon bandini tanlamaydi, modul o'chiq bo'lsa", () => {
    expect(firstAllowedRouteName(ctx('teacher', ['exams.questions'], false))).not.toBe(
      'exam-questions',
    )
  })
})
