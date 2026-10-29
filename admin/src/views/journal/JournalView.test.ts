import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { journalApi, type JournalGridData, type JournalOptions } from '@/api/journal.api'
import type { Role, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { selectOption } from '@/test-utils/selectOption'
import JournalView from './JournalView.vue'

vi.mock('@/api/journal.api', () => ({
  journalApi: { options: vi.fn(), subject: vi.fn(), export: vi.fn() },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const OPTIONS: JournalOptions = {
  today: '2026-10-06',
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  mode: 'assigned',
  periods: [{ id: 'p1', name: '1-chorak', from: '2026-09-01', to: '2026-10-31' }],
  classes: [
    {
      id: 'c5',
      name: '5-A',
      grade: 5,
      homeroom: false,
      subjects: [
        { id: 'math', name: 'Matematika', assigned: true },
        { id: 'phys', name: 'Fizika', assigned: true },
      ],
    },
    {
      id: 'c6',
      name: '6-A',
      grade: 6,
      homeroom: false,
      subjects: [{ id: 'art', name: "Tasviriy san'at", assigned: true }],
    },
  ],
}

const GRID: JournalGridData = {
  class: { id: 'c5', name: '5-A' },
  subject: { id: 'math', name: 'Matematika' },
  teacher: { id: 't1', fullName: 'Karimov Karim' },
  school: { id: 's1', name: 'Maktab' },
  from: '2026-10-01',
  to: '2026-10-31',
  dates: [
    { date: '2026-10-01', weekday: 4 },
    { date: '2026-10-02', weekday: 5 },
    { date: '2026-10-05', weekday: 1 },
    { date: '2026-10-06', weekday: 2 },
  ],
  students: [
    { id: 'a', fullName: 'Aliyev Ali', studentCode: null, photo: null, transferred: false },
    { id: 'b', fullName: 'Valiyev Vali', studentCode: null, photo: null, transferred: false },
    { id: 'z', fullName: 'Zokirov Zoir', studentCode: null, photo: null, transferred: true },
  ],
  cells: {
    a: {
      '2026-10-01': { grade: 5, gradeId: 'g1' },
      '2026-10-02': { grade: 4, gradeId: 'g2', absence: 'B' },
      '2026-10-05': { grade: 3, gradeId: 'g3' },
      '2026-10-06': { absence: 'partial' },
    },
    b: {
      '2026-10-01': { grade: 2, gradeId: 'g4' },
      '2026-10-02': { absence: 'N' },
      '2026-10-05': { absence: 'B' },
    },
  },
  summary: {
    perStudent: {
      a: { avg: 4, count: 3, absentN: 0, absentB: 1 },
      b: { avg: 2, count: 1, absentN: 1, absentB: 1 },
      z: { avg: null, count: 0, absentN: 0, absentB: 0 },
    },
    perDate: {
      '2026-10-01': { avg: 3.5, count: 2 },
      '2026-10-02': { avg: 4, count: 1 },
      '2026-10-05': { avg: 3, count: 1 },
      '2026-10-06': { avg: null, count: 0 },
    },
    classAvg: 3.5,
    classCount: 4,
  },
}

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
let router: ReturnType<typeof createRouter>

async function mountView(query: Record<string, string> = {}, role: Role = 'teacher') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setSession('tok', user(role, ['grades.create']))
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/journal', name: 'journal', component: JournalView }],
  })
  await router.push({ path: '/journal', query })
  await router.isReady()
  wrapper = mount(JournalView, {
    global: { plugins: [pinia, i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const FULL = { classId: 'c5', subjectId: 'math', from: '2026-10-01', to: '2026-10-31' }

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
}

beforeEach(() => {
  vi.mocked(journalApi.options).mockResolvedValue(OPTIONS)
  vi.mocked(journalApi.subject).mockResolvedValue(GRID)
  vi.mocked(journalApi.export).mockResolvedValue('jurnal.xlsx')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
  // @ts-expect-error testda matchMedia ni olib tashlaymiz
  delete window.matchMedia
})

const cell = (w: VueWrapper, student: string, date: string) =>
  w.find(`tr[data-student="${student}"] td[data-date="${date}"]`)

describe('JournalView: setka', () => {
  it('sinf/fan tanlanmaguncha bo`sh holat, so`rov yuborilmaydi', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="empty-select"]').exists()).toBe(true)
    expect(journalApi.subject).not.toHaveBeenCalled()
  })

  it('baholar ranglari, N/B, qisman nuqta, baho+yo`qlik belgisi', async () => {
    const w = await mountView(FULL)
    expect(journalApi.subject).toHaveBeenCalledWith(FULL)
    expect(cell(w, 'a', '2026-10-01').classes()).toContain('text-success')
    expect(cell(w, 'a', '2026-10-02').classes()).toContain('text-primary-700')
    expect(cell(w, 'a', '2026-10-05').classes()).toContain('text-warning')
    expect(cell(w, 'b', '2026-10-01').classes()).toContain('text-danger')
    // baho + B belgisi
    expect(cell(w, 'a', '2026-10-02').find('[data-testid="absence-mark"]').text()).toBe('B')
    // faqat yo'qlik
    expect(cell(w, 'b', '2026-10-02').text()).toBe('N')
    expect(cell(w, 'b', '2026-10-02').attributes('data-absence')).toBe('N')
    expect(cell(w, 'b', '2026-10-05').text()).toBe('B')
    // qisman
    expect(cell(w, 'a', '2026-10-06').find('[data-testid="partial-dot"]').exists()).toBe(true)
    expect(cell(w, 'a', '2026-10-06').text()).toBe('')
    // tooltip
    expect(cell(w, 'a', '2026-10-02').attributes('title')).toContain('02.10.2026')
    expect(cell(w, 'a', '2026-10-02').attributes('title')).toContain('Baho: 4')
  })

  it('oy sarlavhasi, yig`indilar, past o`rtacha belgisi, pastki qator, ko`chgan o`quvchi', async () => {
    const w = await mountView(FULL)
    expect(w.find('[data-testid="month-head"]').text()).toBe('Oktabr')
    const rowA = w.find('tr[data-student="a"]')
    expect(rowA.find('[data-testid="sum-avg"]').text()).toBe('4.0')
    expect(rowA.find('[data-testid="sum-count"]').text()).toBe('3')
    expect(rowA.find('[data-testid="sum-b"]').text()).toBe('1')
    expect(rowA.find('[data-testid="low-avg-icon"]').exists()).toBe(false)
    const rowB = w.find('tr[data-student="b"]')
    expect(rowB.find('[data-testid="sum-avg"]').text()).toBe('2.0')
    expect(rowB.find('[data-testid="low-avg-icon"]').exists()).toBe(true)
    expect(rowB.find('[data-testid="sum-n"]').text()).toBe('1')
    expect(w.find('[data-testid="class-avg"]').text()).toBe('3.50')
    expect(w.find('[data-testid="class-count"]').text()).toBe('4')
    expect(w.find('[data-testid="foot-avg"]').text()).toContain('3.5')
    expect(w.find('tr[data-student="z"] [data-testid="transferred"]').exists()).toBe(true)
    expect(w.find('[data-testid="legend"]').exists()).toBe(true)
  })

  it('bugungi ustun ajratib ko`rsatiladi', async () => {
    const w = await mountView(FULL)
    const todayHeads = w.findAll('th[data-today="true"]')
    expect(todayHeads).toHaveLength(1)
    expect(todayHeads[0]!.attributes('data-date')).toBe('2026-10-06')
    expect(cell(w, 'b', '2026-10-06').attributes('data-today')).toBe('true')
    expect(cell(w, 'b', '2026-10-06').classes()).toContain('bg-primary-50')
    expect(cell(w, 'b', '2026-10-05').attributes('data-today')).toBeUndefined()
  })

  it('xato holati va qayta urinish', async () => {
    vi.mocked(journalApi.subject).mockRejectedValueOnce(new Error('x'))
    const w = await mountView(FULL)
    expect(w.find('[data-testid="grid-error"]').exists()).toBe(true)
    await w.find('[data-testid="grid-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="journal-grid"]').exists()).toBe(true)
  })
})

describe('JournalView: filtrlar va URL', () => {
  it('sinf tanlanganda fanlar shu sinf bilan cheklanadi, fan tanlanganda so`rov ketadi', async () => {
    const w = await mountView()
    await selectOption(w.find('[data-testid="filter-class"]'), '5-A')
    const sub = w.find('[data-testid="filter-subject"]').find('select')
    const labels = Array.from((sub.element as HTMLSelectElement).options).map((o) =>
      o.textContent?.trim(),
    )
    expect(labels).toEqual(expect.arrayContaining(['Matematika', 'Fizika']))
    expect(labels).not.toContain("Tasviriy san'at")
    expect(journalApi.subject).not.toHaveBeenCalled()
    await selectOption(w.find('[data-testid="filter-subject"]'), 'Fizika')
    await flushPromises()
    expect(journalApi.subject).toHaveBeenCalledWith({
      classId: 'c5',
      subjectId: 'phys',
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })

  it('bitta fanli sinf tanlansa fan avtomatik tanlanadi; sinf almashsa eski fan tozalanadi', async () => {
    const w = await mountView(FULL)
    await selectOption(w.find('[data-testid="filter-class"]'), '6-A')
    await flushPromises()
    expect(router.currentRoute.value.query.classId).toBe('c6')
    expect(router.currentRoute.value.query.subjectId).toBe('art')
  })

  it('URL: tanlovlar query ga yoziladi; noto`g`ri id lar e`tiborsiz', async () => {
    const w = await mountView()
    await selectOption(w.find('[data-testid="filter-class"]'), '5-A')
    await selectOption(w.find('[data-testid="filter-subject"]'), 'Matematika')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({
      classId: 'c5',
      subjectId: 'math',
      from: '2026-10-01',
      to: '2026-10-31',
    })
    wrapper?.unmount()
    const w2 = await mountView({ classId: 'nope', subjectId: 'math' })
    expect(w2.find('[data-testid="empty-select"]').exists()).toBe(true)
  })

  it('tezkor davrlar: o`tgan oy va chorak', async () => {
    const w = await mountView(FULL)
    vi.mocked(journalApi.subject).mockClear()
    await w.find('[data-pick="lastMonth"]').trigger('click')
    await flushPromises()
    expect(journalApi.subject).toHaveBeenLastCalledWith({
      ...FULL,
      from: '2026-09-01',
      to: '2026-09-30',
    })
    await w.find('[data-pick="period-p1"]').trigger('click')
    await flushPromises()
    expect(journalApi.subject).toHaveBeenLastCalledWith({
      ...FULL,
      from: '2026-09-01',
      to: '2026-10-31',
    })
    expect(w.find('[data-pick="period-p1"]').attributes('aria-checked')).toBe('true')
  })

  it('o`zboshimchalik davr: 93 kundan uzun bo`lsa xato va so`rov yo`q', async () => {
    const w = await mountView(FULL)
    vi.mocked(journalApi.subject).mockClear()
    await w
      .find('[data-testid="filter-to"] input, input[data-testid="filter-to"]')
      .setValue('2027-03-01')
    await flushPromises()
    expect(w.find('[data-testid="range-error"]').exists()).toBe(true)
    expect(journalApi.subject).not.toHaveBeenCalled()
    expect(w.find('[data-testid="export-pdf"]').attributes('disabled')).toBeDefined()
  })
})

describe('JournalView: eksport', () => {
  it('Excel va PDF tugmalari to`g`ri parametrlar bilan chaqiradi', async () => {
    const w = await mountView(FULL)
    await w.find('[data-testid="export-xlsx"]').trigger('click')
    await flushPromises()
    expect(journalApi.export).toHaveBeenCalledWith('xlsx', FULL)
    await w.find('[data-testid="export-pdf"]').trigger('click')
    await flushPromises()
    expect(journalApi.export).toHaveBeenLastCalledWith('pdf', FULL)
  })

  it('tanlov to`liq bo`lmaganda tugmalar o`chiq', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="export-xlsx"]').attributes('disabled')).toBeDefined()
  })
})

describe('JournalView: mobil "kun bo`yicha" rejim', () => {
  it('jadval o`rniga ro`yxat: bugungi kun, chiplar, xulosa, oldingi/keyingi kun', async () => {
    mockMatchMedia(true)
    const w = await mountView(FULL)
    expect(w.find('[data-testid="journal-grid"]').exists()).toBe(false)
    expect(w.find('[data-testid="journal-daylist"]').exists()).toBe(true)
    // bugun 06.10 — oxirgi kun
    expect(w.find('[data-testid="day-label"]').text()).toBe('06.10.2026')
    expect(w.find('tr, li[data-student="a"] [data-testid="chip-partial"]').exists()).toBe(true)
    await w.find('[data-testid="day-prev"]').trigger('click')
    expect(w.find('[data-testid="day-label"]').text()).toBe('05.10.2026')
    const a = w.find('li[data-student="a"]')
    expect(a.find('[data-testid="chip-grade"]').text()).toBe('3')
    const b = w.find('li[data-student="b"]')
    expect(b.find('[data-testid="chip-absence"]').text()).toBe('B')
    expect(a.find('[data-testid="student-summary"]').text()).toContain('4.0')
    await w.find('[data-testid="day-prev"]').trigger('click')
    await w.find('[data-testid="day-prev"]').trigger('click')
    expect(w.find('[data-testid="day-label"]').text()).toBe('01.10.2026')
    expect(w.find('[data-testid="day-prev"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('planshet yoki kompyuterda')
  })

  it('keng ekranda jadval ko`rsatiladi', async () => {
    mockMatchMedia(false)
    const w = await mountView(FULL)
    expect(w.find('[data-testid="journal-grid"]').exists()).toBe(true)
    expect(w.find('[data-testid="journal-daylist"]').exists()).toBe(false)
  })
})
