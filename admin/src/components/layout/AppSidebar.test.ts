import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import uz from '@/locales/uz.json'
import type { Role, User } from '@/api/types'
import { NAV_GROUPS, NAV_ITEMS } from '@/constants/navigation'
import { useAuthStore } from '@/stores/auth'
import { SIDEBAR_COLLAPSED_KEY, useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const OPEN_KEY = 'sidebar-open-group'

const PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  'my-classes': '/my-classes',
  'my-scores': '/my-scores',
  schools: '/schools',
  'school-admins': '/school-admins',
  'academic-years': '/academic-years',
  classes: '/classes',
  scoring: '/scoring',
  grading: '/grading',
  journal: '/journal',
  'scores-history': '/scores',
  attendance: '/attendance',
  'attendance-history': '/attendance/history',
  students: '/students',
  ratings: '/ratings',
  reports: '/reports',
  teachers: '/teachers',
  'behavior-types': '/behavior-types',
  subjects: '/subjects',
  'attendance-statuses': '/attendance-statuses',
  'audit-logs': '/audit-logs',
  settings: '/settings',
  timetable: '/timetable',
  'my-timetable': '/my-timetable',
}

const SCHOOL_ADMIN_PERMS = [
  'dashboard.view',
  'classes.manage',
  'students.view',
  'students.manage',
  'teachers.manage',
  'scores.create',
  'scores.edit',
  'grades.create',
  'reports.view',
  'attendance.view',
  'subjects.manage',
  'audit.view',
  'attendance.settings',
]
const TEACHER_PERMS = [
  'dashboard.view',
  'students.view',
  'scores.create',
  'grades.create',
  'reports.view',
  'attendance.view',
]

interface Opts {
  role?: Role
  permissions?: string[]
  path?: string
  desktop?: boolean
}

function stubMedia(desktop: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: desktop,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
}

async function setup({ role, permissions = [], path = '/dashboard', desktop = false }: Opts = {}) {
  stubMedia(desktop)
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  if (role) auth.setSession('t', { id: 'u1', role, permissions } as unknown as User)
  const empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...Object.entries(PATHS).map(([name, p]) => ({ path: p, name, component: empty })),
      { path: '/classes/:id', name: 'class-detail', component: empty },
      { path: '/profile', name: 'profile', component: empty },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(AppSidebar, { global: { plugins: [pinia, i18n, router] } })
  return { w, router, ui: useUiStore() }
}

type Wrapper = Awaited<ReturnType<typeof setup>>['w']

const TOGGLE = '[data-testid="sidebar-collapse-toggle"]'
const label = (k: string) => (uz.nav.groups as Record<string, string>)[k]
const headers = (w: Wrapper) => w.findAll('nav button[aria-expanded]')
const headerTexts = (w: Wrapper) => headers(w).map((h) => h.text())
const header = (w: Wrapper, key: string) => w.get(`button[aria-controls="nav-group-${key}"]`)
const isOpen = (w: Wrapper, key: string) => header(w, key).attributes('aria-expanded') === 'true'
/** Guruh sarlavhalari va ular ichidagi/tashqaridagi bandlar ko'rinish tartibida. */
function structure(w: Wrapper): string[] {
  const out: string[] = []
  for (const el of w.findAll('nav > a, nav > div[data-testid="nav-group"]')) {
    if (el.element.tagName === 'A') out.push(el.text())
    else
      out.push(
        `${el.get('button').text()}: ${el
          .findAll('a')
          .map((a) => a.text())
          .join(', ')}`,
      )
  }
  return out
}
/** Yopiq guruh ro'yxati klaviatura/ekran o'quvchidan yashiriladi (jsdom da inert="false" atributi qoladi). */
const inert = (w: Wrapper, key: string) => {
  const v = w.get(`#nav-group-${key}`).attributes('inert')
  return v !== undefined && v !== 'false'
}
const T = uz.nav

describe('AppSidebar yig`ish', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('standart holatda yoyilgan', async () => {
    const { w } = await setup()
    const btn = w.get(TOGGLE)
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(btn.attributes('aria-label')).toBe(uz.nav.collapse)
    expect(
      w
        .get('[data-testid="sidebar-brand-label"]')
        .element.parentElement!.classList.value.split(' '),
    ).not.toContain('lg:hidden')
  })

  it('bosilganda yig`iladi, saqlanadi, yorliq yashirinadi', async () => {
    const { w, ui } = await setup()
    await w.get(TOGGLE).trigger('click')
    expect(ui.sidebarCollapsed).toBe(true)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1')
    expect(w.get(TOGGLE).attributes('aria-expanded')).toBe('false')
    expect(w.get(TOGGLE).attributes('aria-label')).toBe(uz.nav.expand)
    expect(
      w
        .get('[data-testid="sidebar-brand-label"]')
        .element.parentElement!.classList.value.split(' '),
    ).toContain('lg:hidden')
    await w.get(TOGGLE).trigger('click')
    expect(ui.sidebarCollapsed).toBe(false)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0')
  })

  it('saqlangan holat tiklanadi va havolalarda tooltip (title) bor', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    const { w, ui } = await setup({ role: 'superadmin', desktop: true })
    expect(ui.sidebarCollapsed).toBe(true)
    const labels = w.findAll('[data-testid="nav-label"]')
    expect(labels.length).toBeGreaterThan(0)
    for (const l of labels) expect(l.classes()).toContain('lg:hidden')
    for (const a of w.findAll('nav a')) {
      expect(a.attributes('title')).toBeTruthy()
      expect(a.attributes('aria-label')).toBe(a.attributes('title'))
    }
  })
})

describe('AppSidebar guruhlash', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('har bir NAV_ITEMS bandi guruhga biriktirilgan (dashboard bundan mustasno)', () => {
    const keys = NAV_GROUPS.map((g) => g.key)
    for (const i of NAV_ITEMS) {
      if (i.name === 'dashboard') expect(i.group).toBeUndefined()
      else expect(keys, i.name).toContain(i.group)
    }
  })

  it('superadmin: 6 ta guruh, tartib spetsifikatsiyaga mos', async () => {
    const { w } = await setup({ role: 'superadmin' })
    expect(structure(w)).toEqual([
      T.dashboard,
      `${label('academic')}: ${T.classes}, ${T.timetable}, ${T.students}, ${T.teachers}, ${T.academicYears}`,
      `${label('grading')}: ${T.scoring}, ${T.grading}, ${T.journal}, ${T.scoresHistory}`,
      `${label('attendance')}: ${T.attendance}, ${T.attendanceHistory}`,
      `${label('results')}: ${T.ratings}, ${T.reports}`,
      `${label('reference')}: ${T.subjects}, ${T.behaviorTypes}, ${T.attendanceStatuses}`,
      `${label('system')}: ${T.schools}, ${T.schoolAdmins}, ${T.settings}, ${T.audit}`,
    ])
  })

  it('school_admin (odatiy ruxsatlar): "Ma`lumotnomalar" 1 ta band, tekis havola', async () => {
    const { w } = await setup({ role: 'school_admin', permissions: SCHOOL_ADMIN_PERMS })
    expect(structure(w)).toEqual([
      T.dashboard,
      `${label('academic')}: ${T.classes}, ${T.students}, ${T.teachers}, ${T.academicYears}`,
      `${label('grading')}: ${T.scoring}, ${T.grading}, ${T.journal}, ${T.scoresHistory}`,
      `${label('attendance')}: ${T.attendance}, ${T.attendanceHistory}`,
      `${label('results')}: ${T.ratings}, ${T.reports}`,
      T.subjects,
      `${label('system')}: ${T.settings}, ${T.audit}`,
    ])
  })

  it("o'qituvchi: Mening ishim guruhi, bitta bandli guruhlar tekis", async () => {
    const { w } = await setup({ role: 'teacher', permissions: TEACHER_PERMS })
    expect(structure(w)).toEqual([
      T.dashboard,
      `${label('myWork')}: ${T.myClasses}, ${T.myTimetable}, ${T.myScores}`,
      T.students,
      `${label('grading')}: ${T.grading}, ${T.journal}`,
      `${label('attendance')}: ${T.attendance}, ${T.attendanceHistory}`,
      `${label('results')}: ${T.ratings}, ${T.reports}`,
    ])
  })

  it('bitta bandli guruh sarlavhasiz tekis havola (Reyting)', async () => {
    const { w } = await setup({ role: 'school_admin', permissions: ['reports.view'] })
    // scores-history, ratings, reports: Baholash (1 band) tekis, Natijalar (2 band) guruh
    expect(structure(w)).toEqual([
      `${label('grading')}: ${T.journal}, ${T.scoresHistory}`,
      `${label('results')}: ${T.ratings}, ${T.reports}`,
    ])
    expect(headerTexts(w)).not.toContain(label('academic'))
  })

  it("bandi yo'q guruhlar yashiriladi", async () => {
    const { w } = await setup({ role: 'school_admin', permissions: ['audit.view'] })
    expect(headers(w)).toHaveLength(0)
    expect(structure(w)).toEqual([T.audit])
    const none = await setup({ role: 'teacher', permissions: [] })
    expect(headerTexts(none.w)).not.toContain(label('academic'))
    expect(headerTexts(none.w)).not.toContain(label('system'))
  })

  it("sarlavha a11y: <button>, aria-expanded va aria-controls ro'yxat id'siga ishora qiladi", async () => {
    const { w } = await setup({ role: 'superadmin' })
    const h = header(w, 'academic')
    expect(h.element.tagName).toBe('BUTTON')
    expect(h.attributes('type')).toBe('button')
    expect(w.find(`#${h.attributes('aria-controls')}`).exists()).toBe(true)
  })
})

describe('AppSidebar akkordeon', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('bittasini ochish boshqasini yopadi, ochiq sarlavha bosilsa yopiladi', async () => {
    const { w } = await setup({ role: 'superadmin', path: '/profile' })
    expect(headers(w).every((h) => h.attributes('aria-expanded') === 'false')).toBe(true)

    await header(w, 'academic').trigger('click')
    expect(isOpen(w, 'academic')).toBe(true)
    expect(inert(w, 'academic')).toBe(false)
    expect(inert(w, 'grading')).toBe(true)

    await header(w, 'grading').trigger('click')
    expect(isOpen(w, 'grading')).toBe(true)
    expect(isOpen(w, 'academic')).toBe(false)
    expect(headers(w).filter((h) => h.attributes('aria-expanded') === 'true')).toHaveLength(1)

    await header(w, 'grading').trigger('click')
    expect(isOpen(w, 'grading')).toBe(false)
  })

  it('marshrut o`zgarganda faol guruh ochiladi, boshqalari yopiladi', async () => {
    const { w, router } = await setup({ role: 'superadmin', path: '/profile' })
    await header(w, 'system').trigger('click')
    await router.push('/reports')
    await w.vm.$nextTick()
    expect(isOpen(w, 'results')).toBe(true)
    expect(isOpen(w, 'system')).toBe(false)
    // batafsil sahifa (nav bandi emas) ham o'z guruhini ochadi
    await router.push('/classes/42')
    await w.vm.$nextTick()
    expect(isOpen(w, 'academic')).toBe(true)
    expect(isOpen(w, 'results')).toBe(false)
  })

  it('yopiq faol guruh sarlavhasida "faol" belgisi bor', async () => {
    const { w } = await setup({ role: 'superadmin', path: '/attendance/history' })
    expect(isOpen(w, 'attendance')).toBe(true)
    expect(w.find('[data-testid="nav-group-dot"]').exists()).toBe(false)
    await header(w, 'attendance').trigger('click')
    expect(isOpen(w, 'attendance')).toBe(false)
    expect(header(w, 'attendance').attributes('data-active')).toBe('true')
    expect(header(w, 'attendance').classes()).toContain('text-primary-700')
    expect(header(w, 'attendance').find('[data-testid="nav-group-dot"]').exists()).toBe(true)
    expect(header(w, 'system').find('[data-testid="nav-group-dot"]').exists()).toBe(false)
  })

  it('oxirgi ochilgan guruh localStorage ga yoziladi va tiklanadi', async () => {
    const first = await setup({ role: 'superadmin', path: '/profile' })
    await header(first.w, 'reference').trigger('click')
    expect(localStorage.getItem(OPEN_KEY)).toBe('reference')
    first.w.unmount()

    const second = await setup({ role: 'superadmin', path: '/profile' })
    expect(isOpen(second.w, 'reference')).toBe(true)
  })

  it('yuklanganda faol marshrut guruhi saqlanganidan ustun', async () => {
    localStorage.setItem(OPEN_KEY, 'reference')
    const { w } = await setup({ role: 'superadmin', path: '/reports' })
    expect(isOpen(w, 'results')).toBe(true)
    expect(isOpen(w, 'reference')).toBe(false)
  })

  it("noto'g'ri saqlangan qiymat e`tiborga olinmaydi", async () => {
    localStorage.setItem(OPEN_KEY, 'nope')
    const { w } = await setup({ role: 'superadmin', path: '/profile' })
    expect(headers(w).every((h) => h.attributes('aria-expanded') === 'false')).toBe(true)
  })

  it('localStorage xato bersa ham ishlaydi', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { w } = await setup({ role: 'superadmin', path: '/profile' })
    await header(w, 'system').trigger('click')
    expect(isOpen(w, 'system')).toBe(true)
    await header(w, 'academic').trigger('click')
    expect(isOpen(w, 'academic')).toBe(true)
    expect(isOpen(w, 'system')).toBe(false)
  })
})

describe('AppSidebar ixcham (rail) rejim', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('barcha ikonkalar guruh tartibida, guruhlar orasida ajratgich, sarlavhalarsiz', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    const { w } = await setup({ role: 'superadmin', desktop: true })
    expect(headers(w)).toHaveLength(0)
    const links = w.findAll('nav a')
    expect(links.map((a) => a.attributes('aria-label'))).toEqual([
      T.dashboard,
      T.classes,
      T.timetable,
      T.students,
      T.teachers,
      T.academicYears,
      T.scoring,
      T.grading,
      T.journal,
      T.scoresHistory,
      T.attendance,
      T.attendanceHistory,
      T.ratings,
      T.reports,
      T.subjects,
      T.behaviorTypes,
      T.attendanceStatuses,
      T.schools,
      T.schoolAdmins,
      T.settings,
      T.audit,
    ])
    for (const a of links) expect(a.attributes('title')).toBe(a.attributes('aria-label'))
    // dashboard + 6 guruh -> 6 ta ajratgich
    expect(w.findAll('[data-testid="nav-separator"]')).toHaveLength(6)
  })

  it('bitta bandli guruh ham rail rejimida ikonka sifatida ko`rinadi', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    const { w } = await setup({ role: 'teacher', permissions: TEACHER_PERMS, desktop: true })
    expect(w.findAll('nav a').map((a) => a.attributes('aria-label'))).toEqual([
      T.dashboard,
      T.myClasses,
      T.myTimetable,
      T.myScores,
      T.students,
      T.grading,
      T.journal,
      T.attendance,
      T.attendanceHistory,
      T.ratings,
      T.reports,
    ])
    expect(w.findAll('[data-testid="nav-separator"]')).toHaveLength(5)
  })

  it('mobil (lg dan kichik) drawer yig`ilgan holatda ham akkordeon va to`liq yorliqlar', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    const { w } = await setup({ role: 'superadmin', desktop: false })
    expect(headers(w).length).toBeGreaterThan(0)
    expect(w.findAll('[data-testid="nav-separator"]')).toHaveLength(0)
  })
})
