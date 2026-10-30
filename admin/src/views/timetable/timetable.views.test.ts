import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import {
  timetableApi,
  type ClassVersions,
  type TimetableOverview,
  type TimetableVersion,
} from '@/api/timetable.api'
import type { Role, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import ClassTimetableView from './ClassTimetableView.vue'
import MyTimetableView from './MyTimetableView.vue'
import TimetableHomeView from './TimetableHomeView.vue'
import TimetableTeacherView from './TimetableTeacherView.vue'
import { useToast } from '@/composables/useToast'

vi.mock('@/api/timetable.api', () => ({
  timetableApi: {
    overview: vi.fn(),
    options: vi.fn(),
    versions: vi.fn(),
    version: vi.fn(),
    saveDraft: vi.fn(),
    createVersion: vi.fn(),
    activateBulk: vi.fn(),
    bulkPreview: vi.fn(),
    myWeek: vi.fn(),
    teacherWeek: vi.fn(),
    day: vi.fn(),
    exportClass: vi.fn(),
    exportTeacher: vi.fn(),
    exportMine: vi.fn(),
    exportSchool: vi.fn(),
  },
}))
const api = vi.mocked(timetableApi)
const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const user = (role: Role, permissions: string[]): User => ({
  id: 'u1',
  fullName: 'U',
  username: 'u',
  role,
  schoolId: 's1',
  permissions,
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
})

let wrapper: VueWrapper | null = null
async function mountView(
  comp: object,
  path: string,
  routePath: string,
  role: Role,
  perms: string[],
  name = 'x',
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', user(role, perms))
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, name, component: comp },
      { path: '/timetable', name: 'timetable', component: empty },
      { path: '/timetable/classes/:id', name: 'class-timetable', component: empty },
      { path: '/timetable/teachers/:id', name: 'teacher-timetable', component: empty },
      { path: '/classes/:id', name: 'class-detail', component: empty },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(comp, { global: { plugins: [pinia, i18n, router] }, attachTo: document.body })
  await flushPromises()
  return { w: wrapper, router }
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})
beforeEach(() => vi.clearAllMocks())

const sum = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  classId: 'c1',
  status: 'active',
  phase: 'current',
  validFrom: '2026-09-01',
  validTo: null,
  entryCount: 2,
  note: null,
  forced: false,
  activatedAt: null,
  updatedAt: '2026-10-01T00:00:00Z',
  ...over,
})

const OVERVIEW: TimetableOverview = {
  today: '2026-10-30',
  classes: [
    {
      classId: 'c1',
      name: '5-A',
      grade: 5,
      current: sum('a1') as never,
      upcoming: null,
      draft: sum('d1', { status: 'draft', phase: 'draft', validFrom: '2026-11-02' }) as never,
      warningsCount: 3,
      errorsCount: 1,
    },
    {
      classId: 'c2',
      name: '5-B',
      grade: 5,
      current: null,
      upcoming: null,
      draft: sum('d2', {
        classId: 'c2',
        status: 'draft',
        phase: 'draft',
        validFrom: '2026-11-02',
      }) as never,
      warningsCount: 0,
      errorsCount: 0,
    },
    {
      classId: 'c3',
      name: '6-A',
      grade: 6,
      current: sum('a3', { classId: 'c3' }) as never,
      upcoming: null,
      draft: null,
      warningsCount: 0,
      errorsCount: 0,
    },
  ],
}

describe('TimetableHomeView', () => {
  it('sinflar: holat, ogohlantirishlar; ommaviy faollashtirish tanlangan qoralamalar bilan', async () => {
    api.overview.mockResolvedValue(OVERVIEW)
    api.bulkPreview.mockResolvedValue({ warnings: [] })
    api.activateBulk.mockResolvedValue({
      activated: [
        { versionId: 'd1', classId: 'c1', className: '5-A' },
        { versionId: 'd2', classId: 'c2', className: '5-B' },
      ],
    })
    const { w } = await mountView(
      TimetableHomeView,
      '/timetable',
      '/timetable',
      'school_admin',
      ['timetable.manage', 'timetable.view'],
      'timetable',
    )
    expect(w.get('[data-testid="row-c1"]').text()).toContain('5-A')
    expect(w.get('[data-testid="row-c3"]').find('input').exists()).toBe(false) // qoralamasiz sinf
    expect(w.get('[data-testid="row-c2"]').text()).toContain(uz.timetable.none)
    const bulk = w.get('[data-testid="bulk-open"]')
    expect((bulk.element as HTMLButtonElement).disabled).toBe(true)

    await w.get('[data-testid="select-all"] input').setValue(true)
    expect(bulk.text()).toContain('2')
    expect((bulk.element as HTMLButtonElement).disabled).toBe(false)
    await bulk.trigger('click')
    await flushPromises()
    expect(api.bulkPreview).toHaveBeenCalledWith({
      versionIds: ['d1', 'd2'],
      validFrom: '2026-10-31',
    })
    const submit = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="activate-submit"]',
    )!
    expect(submit.disabled).toBe(false)
    submit.click()
    await flushPromises()
    expect(api.activateBulk).toHaveBeenCalledWith(
      expect.objectContaining({ versionIds: ['d1', 'd2'], validFrom: '2026-10-31' }),
    )
    expect(api.overview).toHaveBeenCalledTimes(2) // qayta yuklandi
  })

  it('timetable.view foydalanuvchisiga tanlash/ommaviy tugma ko`rinmaydi', async () => {
    api.overview.mockResolvedValue(OVERVIEW)
    const { w } = await mountView(
      TimetableHomeView,
      '/timetable',
      '/timetable',
      'school_admin',
      ['timetable.view'],
      'timetable',
    )
    expect(w.find('[data-testid="bulk-open"]').exists()).toBe(false)
    expect(w.find('[data-testid="select-all"]').exists()).toBe(false)
    expect(w.find('[data-testid="row-c1"]').exists()).toBe(true)
  })

  it("kun bo'yicha tab va o'qituvchilar tab", async () => {
    api.day.mockResolvedValue({
      date: '2026-11-02',
      weekday: 1,
      today: '2026-10-30',
      working: true,
      settings: { workingWeekdays: [1], lessonsPerDay: 2 },
      classes: [
        {
          classId: 'c1',
          name: '5-A',
          grade: 5,
          lessons: [
            {
              classId: 'c1',
              date: '2026-11-02',
              weekday: 1,
              lessonNo: 2,
              subjectId: 'm',
              teacherId: 't',
              room: null,
              source: 'timetable',
              cancelled: false,
              versionId: 'v',
              class: { id: 'c1', name: '5-A', grade: 5 },
              subject: { id: 'm', name: 'Matematika' },
              teacher: { id: 't', fullName: 'Aliyev' },
            },
          ],
        },
      ],
    })
    api.options.mockResolvedValue({
      subjects: [],
      classAssignments: [],
      subjectTeachers: {},
      teachers: [
        { id: 't1', fullName: 'Aliyev Ali' },
        { id: 't2', fullName: 'Karimov Karim' },
      ],
    })
    const { w } = await mountView(
      TimetableHomeView,
      '/timetable?tab=day',
      '/timetable',
      'school_admin',
      ['timetable.view'],
      'timetable',
    )
    expect(w.get('[data-testid="day-cell-c1-2"]').text()).toContain('Matematika')
    expect(w.get('[data-testid="day-cell-c1-1"]').text()).toBe('')
    await w.get('[data-testid="tab-teachers"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="teacher-list"]').text()).toContain('Karimov Karim')
    await w.get('[data-testid="teacher-search"]').setValue('aliyev')
    expect(w.get('[data-testid="teacher-list"]').text()).not.toContain('Karimov')
  })
})

describe('TimetableHomeView kun jadvali qatorlari', () => {
  it("lessonsPerDay (2) dan katta dars (8) bo'lsa qatorlar 8 gacha ko'rsatiladi", async () => {
    api.day.mockResolvedValue({
      date: '2026-11-02',
      weekday: 1,
      today: '2026-10-30',
      working: true,
      settings: { workingWeekdays: [1], lessonsPerDay: 2 },
      classes: [
        {
          classId: 'c1',
          name: '5-A',
          grade: 5,
          lessons: [
            {
              classId: 'c1',
              date: '2026-11-02',
              weekday: 1,
              lessonNo: 8,
              subjectId: 'm',
              teacherId: 't',
              room: null,
              source: 'timetable',
              cancelled: false,
              versionId: 'v',
              class: { id: 'c1', name: '5-A', grade: 5 },
              subject: { id: 'm', name: 'Matematika' },
              teacher: { id: 't', fullName: 'Aliyev' },
            },
          ],
        },
      ],
    })
    api.options.mockResolvedValue({
      subjects: [],
      classAssignments: [],
      subjectTeachers: {},
      teachers: [],
    })
    const { w } = await mountView(
      TimetableHomeView,
      '/timetable?tab=day',
      '/timetable',
      'school_admin',
      ['timetable.view'],
      'timetable',
    )
    expect(w.get('[data-testid="day-cell-c1-8"]').text()).toContain('Matematika')
    expect(w.find('[data-testid="day-cell-c1-9"]').exists()).toBe(false)
  })
})

const classInfo = (versions: ReturnType<typeof sum>[], archived = false): ClassVersions =>
  ({
    class: { id: 'c1', name: '5-A', grade: 5, isArchived: archived },
    academicYear: { id: 'y', name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-01' },
    settings: { workingWeekdays: [1, 2, 3, 4, 5, 6], lessonsPerDay: 4 },
    today: '2026-10-30',
    versions,
  }) as ClassVersions

const ver = (id: string, over: Partial<TimetableVersion> = {}): TimetableVersion =>
  ({
    ...sum(id),
    academicYearId: 'y',
    weekPattern: 'weekly',
    basedOnVersionId: null,
    entries: [
      {
        weekday: 1,
        lessonNo: 1,
        subjectId: 'math',
        teacherId: 't1',
        room: null,
        subject: { id: 'math', name: 'Matematika' },
        teacher: { id: 't1', fullName: 'Aliyev' },
      },
    ],
    ...over,
  }) as TimetableVersion

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

describe('ClassTimetableView', () => {
  it('qoralama muharriri: katak tahriri -> saqlash paneli -> PUT', async () => {
    api.versions.mockResolvedValue(classInfo([sum('d1', { status: 'draft', phase: 'draft' })]))
    api.options.mockResolvedValue(OPTS)
    api.version.mockResolvedValue({
      version: ver('d1', { status: 'draft', phase: 'draft' }),
      warnings: [
        {
          code: 'teacher_double_booked',
          severity: 'error',
          weekday: 1,
          lessonNo: 1,
          subjectId: 'math',
          teacherId: 't1',
          message: 'Aliyev 5-B da ham',
        },
      ],
    })
    api.saveDraft.mockResolvedValue({
      version: ver('d1', { status: 'draft', phase: 'draft' }),
      warnings: [],
    })
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
    expect(w.get('[data-testid="tt-title"]').text()).toContain('5-A')
    expect(w.get('[data-testid="cell-1-1"]').find('[data-testid="cell-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="warning-list"]').exists()).toBe(false)
    expect(w.get('[data-testid="issue-summary"]').text()).toContain('1 xato')
    expect(document.body.querySelector('[data-testid="save-bar-message"]')).toBeNull()

    await w.get('[data-testid="cell-2-1"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="cell-editor"]')).not.toBeNull()
    // Fan tanlanganda o'qituvchi ClassSubject dan avtomatik
    const subj = document.body.querySelector('[data-testid="cell-editor"]')!
    const { selectOption } = await import('@/test-utils/selectOption')
    const { DOMWrapper } = await import('@vue/test-utils')
    await selectOption(new DOMWrapper(subj), 'Ingliz tili')
    await flushPromises()
    ;(document.body.querySelector('[data-testid="cell-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(w.get('[data-testid="cell-2-1"]').text()).toContain('Ingliz tili')
    expect(w.get('[data-testid="cell-2-1"]').text()).toContain('Karimov')
    expect(document.body.textContent).toContain(uz.timetable.unsavedBar)

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Saqlash'),
    )!
    saveBtn.click()
    await flushPromises()
    expect(api.saveDraft).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        entries: [
          { weekday: 1, lessonNo: 1, subjectId: 'math', teacherId: 't1', room: null },
          { weekday: 2, lessonNo: 1, subjectId: 'eng', teacherId: 't2', room: null },
        ],
      }),
    )
  })

  it("faol versiya faqat ko'rish; 'Tuzatish' ogohlantirish bilan; manage yo'q bo'lsa tugma yo'q", async () => {
    api.versions.mockResolvedValue(classInfo([sum('a1')]))
    api.options.mockResolvedValue(OPTS)
    api.version.mockResolvedValue({ version: ver('a1'), warnings: [] })
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
    expect(w.find('button[data-testid="cell-1-1"]').exists()).toBe(false)
    expect(w.find('[data-testid="new-change"]').exists()).toBe(true)
    await w.get('[data-testid="correct-start"]').trigger('click')
    expect(w.get('[data-testid="correct-banner"]').text()).toContain(
      uz.timetable.correctWarning.slice(0, 20),
    )
    expect(w.find('button[data-testid="cell-1-1"]').exists()).toBe(true)
  })

  it("almashtirilgan versiya: ro'yxatda 'Almashtirilgan', tuzatib bo'lmaydi, nusxalash bor", async () => {
    const rep = sum('r1', {
      status: 'replaced',
      phase: 'replaced',
      validFrom: '2026-10-31',
      replacedBy: 'a1',
    })
    api.versions.mockResolvedValue(
      classInfo([sum('a1', { validFrom: '2026-10-30', activatedAt: '2026-10-30T06:50:00Z' }), rep]),
    )
    api.options.mockResolvedValue(OPTS)
    api.version.mockImplementation(async (id: string) => ({
      version: id === 'r1' ? ver('r1', rep as Partial<TimetableVersion>) : ver('a1'),
      warnings: [],
    }))
    api.createVersion.mockResolvedValue({
      version: ver('d1', { status: 'draft', phase: 'draft' }),
      warnings: [],
    })
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
    const labels = w.findAll('[data-testid="version-select"] option').map((o) => o.text())
    expect(labels).toContain('Almashtirilgan · 31.10.2026 – (yangi versiya bilan almashtirilgan)')
    await w.get('[data-testid="version-select"]').setValue('r1')
    await flushPromises()
    expect(w.find('[data-testid="replaced-banner"]').exists()).toBe(true)
    expect(w.find('[data-testid="correct-start"]').exists()).toBe(false)
    await w.get('[data-testid="replaced-copy"]').trigger('click')
    await flushPromises()
    expect(api.createVersion).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ copyFrom: 'r1' }),
    )
  })

  it("tuzatish rejimi: keyingi versiya bo'lsa ogohlantirish va unga o'tish havolasi", async () => {
    api.versions.mockResolvedValue(
      classInfo([
        sum('a1', { validFrom: '2026-10-30', validTo: '2026-10-30', phase: 'current' }),
        sum('b1', { validFrom: '2026-10-31', phase: 'future', status: 'active' }),
      ]),
    )
    api.options.mockResolvedValue(OPTS)
    api.version.mockImplementation(async (id: string) => ({
      version: ver(id, id === 'a1' ? { validFrom: '2026-10-30', validTo: '2026-10-30' } : {}),
      warnings: [],
    }))
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
    expect(w.find('[data-testid="correct-later-notice"]').exists()).toBe(false)
    await w.get('[data-testid="correct-start"]').trigger('click')
    expect(w.get('[data-testid="correct-later-notice"]').text()).toContain(
      'Bu tuzatish faqat shu versiyaga tegishli. 31.10.2026 dan boshlab boshqa versiya amal qiladi.',
    )
    await w.get('[data-testid="correct-later-open"]').trigger('click')
    await flushPromises()
    expect(api.version).toHaveBeenCalledWith('b1')
  })

  it("o'qituvchi (ruxsatsiz) faqat ko'radi; options so'ralmaydi", async () => {
    api.versions.mockResolvedValue(classInfo([sum('a1')]))
    api.version.mockResolvedValue({ version: ver('a1'), warnings: [] })
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'teacher',
      [],
      'class-timetable',
    )
    expect(api.options).not.toHaveBeenCalled()
    expect(w.find('[data-testid="new-change"]').exists()).toBe(false)
    expect(w.find('[data-testid="correct-start"]').exists()).toBe(false)
    expect(w.find('button[data-testid="cell-1-1"]').exists()).toBe(false)
    expect(w.get('[data-testid="cell-1-1"]').text()).toContain('Matematika')
  })

  it("jadval yo'q: boshqaruvchiga 'Jadval tuzish' tugmasi", async () => {
    api.versions.mockResolvedValue(classInfo([]))
    api.options.mockResolvedValue(OPTS)
    api.createVersion.mockResolvedValue({
      version: ver('d9', { status: 'draft', phase: 'draft', entries: [] }),
      warnings: [],
    })
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
    expect(w.find('[data-testid="no-versions"]').exists()).toBe(true)
    api.versions.mockResolvedValue(classInfo([sum('d9', { status: 'draft', phase: 'draft' })]))
    await w.get('[data-testid="create-first"]').trigger('click')
    await flushPromises()
    expect(api.createVersion).toHaveBeenCalledWith('c1', {
      copyFrom: undefined,
      validFrom: undefined,
    })
    expect(w.find('[data-testid="no-versions"]').exists()).toBe(false)
  })
})

describe('MyTimetableView', () => {
  it("o'qituvchi haftasini yuklaydi va hafta bo'ylab yuradi", async () => {
    api.myWeek.mockResolvedValue({
      teacher: { id: 'u1', fullName: 'U' },
      from: '2026-11-02',
      to: '2026-11-08',
      today: '2026-11-03',
      settings: { workingWeekdays: [1], lessonsPerDay: 2 },
      weeklyCount: 7,
      days: [{ date: '2026-11-02', weekday: 1, lessons: [] }],
    })
    const { w } = await mountView(
      MyTimetableView,
      '/my-timetable',
      '/my-timetable',
      'teacher',
      [],
      'my-timetable',
    )
    expect(w.get('[data-testid="week-count"]').text()).toContain('7')
    expect(w.get('[data-testid="week-range"]').text()).toBe('02.11.2026 – 08.11.2026')
    await w.get('[data-testid="week-next"]').trigger('click')
    await flushPromises()
    expect(api.myWeek).toHaveBeenLastCalledWith('2026-11-09')
  })
})

// ---------- Excel/PDF yuklab olish ----------
async function pickExport(w: VueWrapper, key: string) {
  await w.get('[data-testid="export-trigger"]').trigger('click')
  await flushPromises()
  const item = document.body.querySelector<HTMLButtonElement>(`[data-testid="menu-item-${key}"]`)
  expect(item).not.toBeNull()
  item!.click()
  await flushPromises()
}
const WEEK = {
  teacher: { id: 't1', fullName: 'Aliyev Ali' },
  from: '2026-11-02',
  to: '2026-11-08',
  today: '2026-11-03',
  settings: { workingWeekdays: [1], lessonsPerDay: 2 },
  weeklyCount: 1,
  days: [{ date: '2026-11-02', weekday: 1, lessons: [] }],
}
const toastsOf = (kind: string) =>
  useToast()
    .toasts.filter((x) => x.kind === kind)
    .map((x) => x.message)

describe('Jadvalni yuklab olish (Excel/PDF)', () => {
  it('sinf jadvali: tanlangan versiya (versionId) bilan yuklaydi, muvaffaqiyat toast', async () => {
    api.versions.mockResolvedValue(classInfo([sum('a1')]))
    api.options.mockResolvedValue(OPTS)
    api.version.mockResolvedValue({ version: ver('a1'), warnings: [] })
    api.exportClass.mockResolvedValue('dars-jadvali-5-A-2026-10-30.pdf')
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.view'],
      'class-timetable',
    )
    expect(w.get('[data-testid="export-trigger"]').text()).toContain(uz.timetable.download)
    await pickExport(w, 'pdf')
    expect(api.exportClass).toHaveBeenCalledWith('c1', 'pdf', { versionId: 'a1' })
    expect(toastsOf('success')).toContain('Fayl yuklandi: dars-jadvali-5-A-2026-10-30.pdf')
    await pickExport(w, 'xlsx')
    expect(api.exportClass).toHaveBeenLastCalledWith('c1', 'xlsx', { versionId: 'a1' })
  })

  it('sinf jadvali: qoralama ham yuklanadi; xatoda toast, tugma yana ishlaydi', async () => {
    api.versions.mockResolvedValue(classInfo([sum('d1', { status: 'draft', phase: 'draft' })]))
    api.options.mockResolvedValue(OPTS)
    api.version.mockResolvedValue({
      version: ver('d1', { status: 'draft', phase: 'draft' }),
      warnings: [],
    })
    api.exportClass.mockRejectedValueOnce(new Error('boom')).mockResolvedValue('x.xlsx')
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
    await pickExport(w, 'xlsx')
    expect(api.exportClass).toHaveBeenCalledWith('c1', 'xlsx', { versionId: 'd1' })
    expect(toastsOf('error').length).toBeGreaterThan(0)
    await pickExport(w, 'xlsx')
    expect(api.exportClass).toHaveBeenCalledTimes(2)
  })

  it("yuklanayotganda tugmada spinner, menyu elementlari o'chiq", async () => {
    api.versions.mockResolvedValue(classInfo([sum('a1')]))
    api.options.mockResolvedValue(OPTS)
    api.version.mockResolvedValue({ version: ver('a1'), warnings: [] })
    let done: (n: string) => void = () => {}
    api.exportClass.mockReturnValue(new Promise<string>((r) => (done = r)))
    const { w } = await mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.view'],
      'class-timetable',
    )
    await pickExport(w, 'pdf')
    const trigger = w.get('[data-testid="export-trigger"]')
    expect(trigger.find('svg.animate-spin, [role="status"]').exists()).toBe(true)
    await trigger.trigger('click')
    await flushPromises()
    const item = document.body.querySelector<HTMLButtonElement>('[data-testid="menu-item-pdf"]')!
    expect(item.disabled).toBe(true)
    done('f.pdf')
    await flushPromises()
    expect(trigger.find('svg.animate-spin, [role="status"]').exists()).toBe(false)
  })

  it("o'qituvchi sahifasi: o'qituvchi id va ko'rinib turgan hafta sanasi bilan", async () => {
    api.teacherWeek.mockResolvedValue(WEEK)
    api.exportTeacher.mockResolvedValue('t.pdf')
    const { w } = await mountView(
      TimetableTeacherView,
      '/timetable/teachers/t1',
      '/timetable/teachers/:id',
      'school_admin',
      ['timetable.view'],
      'teacher-timetable',
    )
    await pickExport(w, 'pdf')
    expect(api.exportTeacher).toHaveBeenCalledWith('t1', 'pdf', '2026-11-02')
  })

  it('Mening jadvalim: /me eksport, 403 da ruxsat xabari', async () => {
    api.myWeek.mockResolvedValue(WEEK)
    const { ApiError } = await import('@/api/errors')
    api.exportMine.mockRejectedValueOnce(new ApiError('FORBIDDEN', 'Forbidden', 403))
    const { w } = await mountView(
      MyTimetableView,
      '/my-timetable',
      '/my-timetable',
      'teacher',
      [],
      'my-timetable',
    )
    await pickExport(w, 'xlsx')
    expect(api.exportMine).toHaveBeenCalledWith('xlsx', '2026-11-02')
    expect(toastsOf('error')).toContain(uz.reports.exportForbidden)
  })

  it("bosh sahifa: butun maktab sinflar/o'qituvchilar; view bo'lmasa tugma yo'q", async () => {
    api.overview.mockResolvedValue(OVERVIEW)
    api.exportSchool.mockResolvedValue('m.xlsx')
    const { w } = await mountView(
      TimetableHomeView,
      '/timetable',
      '/timetable',
      'school_admin',
      ['timetable.view'],
      'timetable',
    )
    await pickExport(w, 'classes:xlsx')
    expect(api.exportSchool).toHaveBeenLastCalledWith('classes', 'xlsx')
    await pickExport(w, 'teachers:pdf')
    expect(api.exportSchool).toHaveBeenLastCalledWith('teachers', 'pdf')
    await w.get('[data-testid="export-trigger"]').trigger('click')
    await flushPromises()
    const labels = Array.from(document.body.querySelectorAll('[role="menuitem"]')).map((x) =>
      x.textContent?.trim(),
    )
    expect(labels).toEqual([
      uz.timetable.exportClassesExcel,
      uz.timetable.exportClassesPdf,
      uz.timetable.exportTeachersExcel,
      uz.timetable.exportTeachersPdf,
    ])
  })

  it("bosh sahifa: timetable.view/manage yo'q foydalanuvchida yuklab olish tugmasi yo'q", async () => {
    api.overview.mockResolvedValue(OVERVIEW)
    const { w } = await mountView(
      TimetableHomeView,
      '/timetable',
      '/timetable',
      'school_admin',
      ['timetable.substitute'],
      'timetable',
    )
    expect(w.find('[data-testid="export-trigger"]').exists()).toBe(false)
  })
})

describe("ClassTimetableView: eski tarix va avtomatik o'chirish", () => {
  const old = sum('old', {
    status: 'superseded',
    phase: 'past',
    validFrom: '2026-01-01',
    validTo: '2026-06-30',
  })
  const recent = sum('rec', {
    status: 'superseded',
    phase: 'past',
    validFrom: '2026-07-01',
    validTo: '2026-10-15',
  })
  const cur = sum('a1', { validFrom: '2026-10-16' })
  const mount1 = (extra: ReturnType<typeof sum>[] = []) => {
    api.versions.mockResolvedValue(classInfo([cur, recent, old, ...extra]))
    api.options.mockResolvedValue(OPTS)
    api.version.mockImplementation(async (id: string) => ({
      version: ver(
        id,
        ([cur, recent, old, ...extra].find((x) => x.id === id) ?? {}) as Partial<TimetableVersion>,
      ),
      warnings: [],
    }))
    return mountView(
      ClassTimetableView,
      '/timetable/classes/c1',
      '/timetable/classes/:id',
      'school_admin',
      ['timetable.manage'],
      'class-timetable',
    )
  }
  const optionValues = (w: VueWrapper) =>
    w
      .findAll('[data-testid="version-select"] option')
      .map((o) => (o.element as HTMLOptionElement).value)

  it('30 kundan oshgan tugagan versiya yashiriladi, tugma soni bilan ochadi', async () => {
    const { w } = await mount1()
    expect(optionValues(w)).toEqual(['a1', 'rec'])
    const toggle = w.get('[data-testid="history-toggle"]')
    expect(toggle.text()).toBe("Tarixni ko'rsatish (1)")
    await toggle.trigger('click')
    expect(optionValues(w)).toEqual(['a1', 'rec', 'old'])
    expect(w.get('[data-testid="history-toggle"]').text()).toBe('Tarixni yashirish')
    await w.get('[data-testid="history-toggle"]').trigger('click')
    expect(optionValues(w)).toEqual(['a1', 'rec'])
  })

  it('yashirin versiya tanlansa tarix avtomatik ochiladi', async () => {
    const { w } = await mount1()
    expect(optionValues(w)).not.toContain('old')
    await w.get('[data-testid="history"] summary').trigger('click')
    // tarix panelida eski versiya yo'q; to'g'ridan-to'g'ri yuklash (havola) simulyatsiyasi:
    await (
      w.vm as unknown as { $: { setupState: { selectVersion: (id: string) => Promise<void> } } }
    ).$.setupState.selectVersion('old')
    await flushPromises()
    expect(optionValues(w)).toContain('old')
    expect(w.get('[data-testid="history-toggle"]').text()).toBe('Tarixni yashirish')
  })

  it("o'chirilish sanasi: almashtirilgan versiyada doim, qoralamada 7 kun qolganda", async () => {
    const rep = sum('r1', {
      status: 'replaced',
      phase: 'replaced',
      validFrom: '2026-10-31',
      purgeAt: '2026-11-20',
    })
    const { w } = await mount1([rep])
    await w.get('[data-testid="version-select"]').setValue('r1')
    await flushPromises()
    expect(w.get('[data-testid="purge-notice"]').text()).toBe(
      "30 kundan so'ng avtomatik o'chiriladi (20.11.2026)",
    )
  })

  it("qoralama: 7 kundan ko'p qolgan bo'lsa eslatma yo'q, yaqin bo'lsa bor", async () => {
    const far = sum('d1', {
      status: 'draft',
      phase: 'draft',
      validFrom: '2026-11-02',
      purgeAt: '2026-11-25',
    })
    const { w } = await mount1([far])
    expect(w.find('[data-testid="purge-notice"]').exists()).toBe(false)
    wrapper?.unmount()
    const near = sum('d2', {
      status: 'draft',
      phase: 'draft',
      validFrom: '2026-11-02',
      purgeAt: '2026-11-03',
    })
    const m = await mount1([near])
    expect(m.w.get('[data-testid="purge-notice"]').text()).toBe(
      "O'zgartirilmasa, 03.11.2026 da o'chiriladi",
    )
  })
})
