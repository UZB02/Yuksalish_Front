import { describe, expect, it } from 'vitest'
import type { Role } from '@/api/types'
import uz from '@/locales/uz.json'
import { NAV_GROUPS, NAV_ITEMS } from '@/constants/navigation'
import { canAccess, type AccessContext } from './guards'
import router from './index'

function ctx(
  role: Role,
  permissions: string[],
  opts: { exams?: boolean; teacherQuizzes?: boolean } = {},
): AccessContext {
  const exams = opts.exams ?? true
  return {
    isAuthenticated: true,
    hasRole: (roles) => !roles || roles.length === 0 || roles.includes(role),
    hasPermission: (p) => !p || role === 'superadmin' || permissions.includes(p),
    isFeatureEnabled: (f) =>
      f === 'exams' ? exams : f === 'teacherQuizzes' ? exams && !!opts.teacherQuizzes : false,
  }
}

/** "Imtihonlar" guruhida shu foydalanuvchiga ko'rinadigan bandlar nomi */
const examMenu = (c: AccessContext) =>
  NAV_ITEMS.filter((i) => i.group === 'exams' && canAccess(c, i))
    .map((i) => i.name)
    .sort()

describe('Imtihonlar yon menyusi: rol va ruxsatga qarab', () => {
  it('superadmin va maktab admini (exams.manage yoki exams.questions): faqat "Imtihonlar" va "Savollar banki"', () => {
    const expected = ['exam-questions', 'exam-sessions']
    expect(examMenu(ctx('superadmin', []))).toEqual(expected)
    expect(examMenu(ctx('school_admin', ['exams.manage']))).toEqual(expected)
    expect(examMenu(ctx('school_admin', ['exams.questions']))).toEqual(expected)
  })

  it('imtihon ruxsati yo`q yoki modul o`chiq: guruh bo`sh', () => {
    expect(examMenu(ctx('school_admin', ['students.view']))).toEqual([])
    expect(examMenu(ctx('school_admin', ['exams.manage'], { exams: false }))).toEqual([])
    expect(examMenu(ctx('superadmin', [], { exams: false }))).toEqual([])
    expect(examMenu(ctx('teacher', ['exams.questions'], { exams: false }))).toEqual([])
  })

  it('o`qituvchi (quiz yaratish o`chiq): vazifalarim + Savollar banki, "Imtihonlar" yo`q', () => {
    expect(examMenu(ctx('teacher', ['exams.questions']))).toEqual(['exam-questions', 'exam-tasks'])
  })

  it('o`qituvchi (quiz yaratish yoqilgan): vazifalarim + Imtihonlar + Savollar banki', () => {
    expect(examMenu(ctx('teacher', ['exams.questions'], { teacherQuizzes: true }))).toEqual([
      'exam-questions',
      'exam-sessions',
      'exam-tasks',
    ])
  })

  it('administratorga "Mening imtihon vazifalarim" ko`rinmaydi', () => {
    expect(examMenu(ctx('school_admin', ['exams.manage']))).not.toContain('exam-tasks')
  })
})

describe('Eski bandlar olib tashlangan, havolalar ishlaydi', () => {
  it('"Natijalar" ro`yxati va "Nomzodlar" yon menyuda yo`q', () => {
    const names = NAV_ITEMS.map((i) => i.name)
    expect(names).not.toContain('exam-results-list')
    expect(names).not.toContain('exam-candidates')
  })

  it('"Imtihonlar" guruhi ichida "Natijalar" nomli band yo`q; yuqori darajadagi "Natijalar" guruhi saqlangan', () => {
    const labels = NAV_ITEMS.filter((i) => i.group === 'exams').map((i) =>
      i.labelKey.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], uz),
    )
    expect([...labels].sort()).toEqual([
      'Imtihonlar',
      'Mening imtihon vazifalarim',
      'Savollar banki',
    ])
    expect(labels).not.toContain('Natijalar')
    const results = NAV_GROUPS.find((g) => g.key === 'results')
    expect(results).toBeTruthy()
    expect(uz.nav.groups.results).toBe('Natijalar')
  })

  it('/exams/results "Imtihonlar" sahifasining natijalar bo`limiga yo`naltiriladi', () => {
    const rec = router.getRoutes().find((x) => x.name === 'exam-results-list')!
    expect(rec.redirect).toEqual({ name: 'exam-sessions', query: { tab: 'results' } })
  })

  it('/exams/candidates marshruti saqlangan (faqat ishtirokchilar panelidagi havola orqali)', () => {
    expect(router.resolve('/exams/candidates').name).toBe('exam-candidates')
    expect(NAV_ITEMS.find((i) => i.name === 'exam-sessions')?.activePrefixes).toContain(
      '/exams/candidates',
    )
  })

  it('/exams/sessions marshruti o`qituvchiga quiz bayrog`isiz yopiq', () => {
    const meta = router.resolve('/exams/sessions').meta
    expect(canAccess(ctx('teacher', ['exams.questions']), meta)).toBe(false)
    expect(canAccess(ctx('teacher', ['exams.questions'], { teacherQuizzes: true }), meta)).toBe(
      true,
    )
    expect(canAccess(ctx('school_admin', ['exams.manage']), meta)).toBe(true)
  })
})
