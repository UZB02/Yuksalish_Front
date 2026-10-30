import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { selectOption } from '@/test-utils/selectOption'
import { timetableApi, type ClassVersions, type TimetableVersion } from '@/api/timetable.api'
import type { User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import ClassTimetableView from './ClassTimetableView.vue'

vi.mock('@/api/timetable.api', () => ({
  timetableApi: {
    overview: vi.fn(),
    options: vi.fn(),
    versions: vi.fn(),
    version: vi.fn(),
    busyTeachers: vi.fn(),
    saveDraft: vi.fn(),
  },
}))
const api = vi.mocked(timetableApi)
const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const manager: User = {
  id: 'u1',
  fullName: 'U',
  username: 'u',
  role: 'school_admin',
  schoolId: 's1',
  permissions: ['timetable.manage'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
}

let wrapper: VueWrapper | null = null
async function mountDraft() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', manager)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/timetable/classes/:id', name: 'class-timetable', component: ClassTimetableView },
      { path: '/timetable', name: 'timetable', component: empty },
      { path: '/classes/:id', name: 'class-detail', component: empty },
    ],
  })
  await router.push('/timetable/classes/c1')
  await router.isReady()
  wrapper = mount(ClassTimetableView, {
    global: { plugins: [pinia, i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const draftSummary = {
  id: 'd1',
  classId: 'c1',
  status: 'draft',
  phase: 'draft',
  validFrom: '2026-09-01',
  validTo: null,
  entryCount: 2,
  note: null,
  forced: false,
  activatedAt: null,
  updatedAt: '2026-10-01T00:00:00Z',
}
const entry = (weekday: number, subjectId: string, subject: string) => ({
  weekday,
  lessonNo: 1,
  subjectId,
  teacherId: 't1',
  room: null,
  subject: { id: subjectId, name: subject },
  teacher: { id: 't1', fullName: 'Aliyev' },
})
const draftVersion = () =>
  ({
    ...draftSummary,
    academicYearId: 'y',
    weekPattern: 'weekly',
    basedOnVersionId: null,
    entries: [entry(1, 'math', 'Matematika'), entry(2, 'eng', 'Ingliz tili')],
  }) as unknown as TimetableVersion

const OPTS = {
  subjects: [
    { id: 'math', name: 'Matematika' },
    { id: 'eng', name: 'Ingliz tili' },
  ],
  teachers: [
    { id: 't1', fullName: 'Aliyev' },
    { id: 't2', fullName: 'Karimov' },
  ],
  classAssignments: [{ subjectId: 'eng', teacherId: 't2' }],
  subjectTeachers: { eng: ['t2'] },
}

const other = { classId: 'c9', className: '1-B', versionId: 'v9', validFrom: '', validTo: null }
const dbl = (over: Record<string, unknown> = {}) => ({
  code: 'teacher_double_booked' as const,
  severity: 'error' as const,
  weekday: 1,
  lessonNo: 1,
  subjectId: 'math',
  teacherId: 't1',
  message: 'server',
  other,
  ...over,
})
const unassigned = () => ({
  code: 'teacher_not_assigned' as const,
  severity: 'warning' as const,
  weekday: 2,
  lessonNo: 1,
  subjectId: 'eng',
  teacherId: 't1',
  message: 'server',
})

const body = (sel: string) => document.body.querySelector<HTMLElement>(sel)

beforeEach(() => {
  vi.clearAllMocks()
  api.versions.mockResolvedValue({
    class: { id: 'c1', name: '5-A', grade: 5, isArchived: false },
    academicYear: { id: 'y', name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-01' },
    settings: { workingWeekdays: [1, 2, 3, 4, 5, 6], lessonsPerDay: 4 },
    today: '2026-10-30',
    versions: [draftSummary],
  } as unknown as ClassVersions)
  api.options.mockResolvedValue(OPTS)
  api.busyTeachers.mockResolvedValue({ items: [] })
})

describe('ClassTimetableView: muammolar', () => {
  it("sarlavha xulosasi noyob muammolarni sanaydi; bo'sh bo'lsa 'Muammo yo'q'", async () => {
    api.version.mockResolvedValue({
      version: draftVersion(),
      warnings: [dbl(), dbl(), unassigned()],
    })
    const w = await mountDraft()
    const sm = w.get('[data-testid="issue-summary"]')
    expect(sm.get('[data-testid="summary-errors"]').text()).toBe('1 xato')
    expect(sm.get('[data-testid="summary-warnings"]').text()).toBe('1 ogohlantirish')
    expect(w.get('[data-testid="activate-blocked-hint"]').text()).toContain('1 ta xato')
    w.unmount()
    wrapper = null

    api.version.mockResolvedValue({ version: draftVersion(), warnings: [] })
    const clean = await mountDraft()
    expect(clean.find('[data-testid="issue-summary"]').exists()).toBe(false)
    expect(clean.get('[data-testid="issue-summary-ok"]').text()).toContain("Muammo yo'q")
    expect(clean.find('[data-testid="activate-blocked-hint"]').exists()).toBe(false)
  })

  it("katak: chap chiziq va belgi, aria-label da xato soni, to'liq qizil fon yo'q", async () => {
    api.version.mockResolvedValue({ version: draftVersion(), warnings: [dbl(), unassigned()] })
    const w = await mountDraft()
    const err = w.get('[data-cell="1:1"]')
    expect(err.attributes('data-severity')).toBe('error')
    expect(err.get('[data-testid="cell-stripe"]').classes()).toContain('bg-danger')
    expect(err.classes()).not.toContain('bg-danger-soft/60')
    const btn = w.get('[data-testid="cell-1-1"]')
    expect(btn.attributes('aria-label')).toContain('1 ta xato')
    expect(btn.find('[data-testid="cell-error"]').exists()).toBe(true)
    expect(btn.get('[title]').attributes('title')).toContain("O'qituvchi band")
    const warnCell = w.get('[data-cell="2:1"]')
    expect(warnCell.get('[data-testid="cell-stripe"]').classes()).toContain('bg-warning')
    expect(w.get('[data-testid="cell-2-1"]').attributes('aria-label')).toContain(
      '1 ta ogohlantirish',
    )
  })

  it("panel: filtr, guruhlash, matnlar, katakka o'tish, tahrirlash va Esc", async () => {
    const versions = [
      { versionId: 'a', validFrom: '', validTo: null },
      { versionId: 'b', validFrom: '', validTo: null },
    ]
    api.version.mockResolvedValue({
      version: draftVersion(),
      warnings: [unassigned(), dbl({ other: { ...other, versions } })],
    })
    const w = await mountDraft()
    expect(body('[data-testid="issues-drawer"]')).toBeNull()
    await w.get('[data-testid="issue-summary"]').trigger('click')
    await flushPromises()
    const drawer = body('[data-testid="issues-drawer"]')!
    expect(drawer.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.activeElement).toBe(drawer)
    expect(drawer.textContent).toContain('Hammasi (2)')
    expect(drawer.textContent).toContain('Xatolar (1)')
    expect(drawer.textContent).toContain('Ogohlantirishlar (1)')
    const groups = Array.from(drawer.querySelectorAll('[data-testid^="issues-group-"]'))
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual([
      'issues-group-error',
      'issues-group-warning',
    ])
    expect(drawer.textContent).toContain('Aliyev dushanba, 1-darsda 1-B sinfida ham dars beradi.')
    expect(drawer.textContent).toContain('2 ta versiyasida')
    expect(drawer.textContent).toContain('Dush · 1-dars · Matematika')
    expect(drawer.textContent).toContain('1-B jadvalini ochish')
    expect(drawer.textContent).toContain("Boshqa o'qituvchi biriktirilgan")
    expect(drawer.textContent).toContain('biriktirilgan: Karimov')

    body('[data-testid="issues-tab-warning"]')!.click()
    await flushPromises()
    expect(drawer.querySelector('[data-testid="issues-group-error"]')).toBeNull()
    expect(drawer.querySelector('[data-testid="issue-2-1"]')).not.toBeNull()
    body('[data-testid="issues-tab-all"]')!.click()
    await flushPromises()

    const cell = w.get('[data-cell="1:1"]').element as HTMLElement
    cell.scrollIntoView = vi.fn()
    drawer
      .querySelector<HTMLElement>('[data-testid="issue-1-1"] [data-testid="issue-jump"]')!
      .click()
    await flushPromises()
    expect(cell.scrollIntoView).toHaveBeenCalled()
    expect(cell.classList.contains('tt-pulse')).toBe(true)
    expect(body('[data-testid="issues-drawer"]')).not.toBeNull() // desktop: ochiq qoladi

    drawer
      .querySelector<HTMLElement>('[data-testid="issue-1-1"] [data-testid="issue-edit"]')!
      .click()
    await flushPromises()
    expect(body('[data-testid="cell-editor"]')).not.toBeNull()
    expect(api.busyTeachers).toHaveBeenCalledWith('d1', 1, 1, '2026-09-01')
    // modal ichidagi saqlangan muammo bir marta
    expect(document.querySelectorAll('[data-testid="cell-issues"] li')).toHaveLength(1)

    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(body('[data-testid="issues-drawer"]')).toBeNull()
  })

  it('faollashtirish yonidagi havola panelni ochadi', async () => {
    api.version.mockResolvedValue({ version: draftVersion(), warnings: [dbl()] })
    const w = await mountDraft()
    await w.get('[data-testid="activate-hint-open"]').trigger('click')
    await flushPromises()
    expect(body('[data-testid="issues-drawer"]')).not.toBeNull()
  })

  it("katak oynasi: band o'qituvchi belgilanadi, jonli xato bir marta chiqadi", async () => {
    api.version.mockResolvedValue({ version: draftVersion(), warnings: [] })
    api.busyTeachers.mockResolvedValue({
      items: [
        { teacherId: 't2', classId: 'c9', className: '1-B' },
        { teacherId: 't2', classId: 'c9', className: '1-B' },
      ],
    })
    const w = await mountDraft()
    await w.get('[data-testid="cell-3-1"]').trigger('click')
    await flushPromises()
    const editor = body('[data-testid="cell-editor"]')!
    expect(api.busyTeachers).toHaveBeenCalledWith('d1', 3, 1, '2026-09-01')
    await selectOption(new DOMWrapper(editor), 'Ingliz tili')
    await flushPromises()
    const items = Array.from(editor.querySelectorAll('[data-testid="cell-issues"] li'))
    expect(items).toHaveLength(1)
    expect(items[0]!.getAttribute('data-severity')).toBe('error')
    expect(items[0]!.textContent).toContain(
      'Karimov chorshanba, 1-darsda 1-B sinfida ham dars beradi.',
    )
    expect(editor.textContent).toContain('band · 1-B')
  })
})
