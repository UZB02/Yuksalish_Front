import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { classesApi } from '@/api/classes.api'
import { academicYearsApi } from '@/api/academicYears.api'
import { teachersApi } from '@/api/teachers.api'
import { useAuthStore } from '@/stores/auth'
import type { ClassSubjectAssignment, SchoolClass } from '@/api/types'
import ClassDetailView from './ClassDetailView.vue'

vi.mock('@/api/classes.api', () => ({ classesApi: { get: vi.fn() } }))
vi.mock('@/api/academicYears.api', () => ({ academicYearsApi: { list: vi.fn() } }))
vi.mock('@/api/teachers.api', () => ({ teachersApi: { list: vi.fn() } }))
vi.mock('../students/StudentsPanel.vue', () => ({
  default: { template: '<div data-testid="students-panel" />' },
}))
vi.mock('./ClassTeachersModal.vue', () => ({
  default: {
    props: ['open'],
    template: '<div v-if="open" data-testid="assign-modal" />',
  },
}))

const person = (id: string, fullName: string) => ({ id, fullName })
const assignment = (
  subjectId: string,
  subjectName: string,
  teacherId: string,
  teacherName: string,
): ClassSubjectAssignment => ({
  subjectId,
  subject: { id: subjectId, name: subjectName },
  teacherId,
  teacher: person(teacherId, teacherName),
})

const base: SchoolClass = {
  id: 'c1',
  name: '3-Abu Nasr Forobiy',
  grade: 3,
  section: null,
  academicYearId: 'y1',
  homeroomTeacherId: null,
  homeroomTeacher: null,
  teacherIds: [],
  teachers: [],
  subjects: [],
  studentsCount: 14,
  isArchived: false,
  createdAt: '',
}

async function mountView(
  klass: SchoolClass,
  permissions: string[] = ['classes.manage'],
  role: 'school_admin' | 'teacher' = 'school_admin',
) {
  vi.mocked(classesApi.get).mockResolvedValue(klass)
  setActivePinia(createPinia())
  useAuthStore().setSession('tok', {
    id: 'u',
    fullName: 'U',
    username: 'u',
    role,
    schoolId: 's',
    permissions,
    isActive: true,
    lastLoginAt: null,
    createdAt: '',
  })
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/classes', name: 'classes', component: stub },
      { path: '/my-classes', name: 'my-classes', component: stub },
      { path: '/classes/:id', name: 'class-detail', component: ClassDetailView },
      { path: '/classes/:id/edit', name: 'class-edit', component: stub },
      { path: '/classes/:id/scoring', name: 'class-scoring', component: stub },
      { path: '/classes/:id/attendance', name: 'class-attendance', component: stub },
      { path: '/classes/:id/timetable', name: 'class-timetable', component: stub },
      { path: '/grading', name: 'grading', component: stub },
      { path: '/reports', name: 'reports', component: stub },
      { path: '/teachers/:id', name: 'teacher-detail', component: stub },
    ],
  })
  await router.push('/classes/c1')
  const w = mount(
    { template: '<RouterView />' },
    {
      attachTo: document.body,
      global: {
        plugins: [router, createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
      },
    },
  )
  await flushPromises()
  return { w, router }
}

const ALL = [
  'classes.manage',
  'scores.create',
  'grades.create',
  'attendance.take',
  'timetable.view',
  'reports.view',
  'teachers.manage',
]

describe('ClassDetailView sarlavhasi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(academicYearsApi.list).mockResolvedValue({
      items: [{ id: 'y1', name: '2026-2027' }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    } as never)
    vi.mocked(teachersApi.list).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
    } as never)
  })

  it("meta qator: o'quv yili, o'quvchilar va fanlar soni", async () => {
    const { w } = await mountView({
      ...base,
      subjects: [assignment('s1', 'Algebra', 't1', 'Aliyeva Gulnora')],
    })
    const meta = w.get('[data-testid="class-meta"]').text()
    expect(meta).toContain('2026-2027')
    expect(meta).toContain("14 o'quvchi")
    expect(meta).toContain('1 fan')
  })

  it("sinf rahbari yo'q: ogohlantirish va Tayinlash modalni ochadi", async () => {
    const { w } = await mountView(base)
    expect(w.get('[data-testid="class-no-homeroom"]').text()).toContain(
      'Sinf rahbari tayinlanmagan',
    )
    await w.get('[data-testid="class-homeroom-assign"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="assign-modal"]').exists()).toBe(true)
  })

  it("sinf rahbari yo'q va ruxsat yo'q: faqat belgi, tugma yo'q", async () => {
    const { w } = await mountView(base, ['timetable.view'])
    expect(w.find('[data-testid="class-no-homeroom"]').exists()).toBe(true)
    expect(w.find('[data-testid="class-homeroom-assign"]').exists()).toBe(false)
  })

  it('sinf rahbari tayinlangan: ismi (havola) ko`rinadi', async () => {
    const { w } = await mountView(
      {
        ...base,
        homeroomTeacherId: 't9',
        homeroomTeacher: person('t9', 'Karimov Anvar'),
      },
      ALL,
    )
    const hr = w.get('[data-testid="class-homeroom"]')
    expect(hr.text()).toContain('Sinf rahbari: Karimov Anvar')
    expect(hr.find('a').attributes('href')).toBe('/teachers/t9')
    expect(w.find('[data-testid="class-no-homeroom"]').exists()).toBe(false)
  })

  it('asosiy tugmalar va "⋮" menyu (barcha ruxsatlar)', async () => {
    const { w, router } = await mountView(
      { ...base, homeroomTeacherId: 'x', homeroomTeacher: person('x', 'X Y') },
      ALL,
    )
    const actions = w.get('[data-testid="class-actions"]')
    expect(actions.get('[data-testid="class-scoring-link"]').text()).toContain('Xulq bahosi')
    expect(actions.find('[data-testid="class-subject-grading-link"]').exists()).toBe(true)
    expect(actions.find('[data-testid="class-attendance-link"]').exists()).toBe(true)
    expect(actions.find('[data-testid="class-timetable-link"]').exists()).toBe(true)
    // Eski keng tugmalar endi menyuda
    expect(actions.find('[data-testid="class-report-link"]').exists()).toBe(false)

    await w.get('[data-testid="class-more-menu"]').trigger('click')
    await flushPromises()
    const labels = Array.from(document.querySelectorAll('[role="menuitem"]')).map((e) =>
      e.textContent?.trim(),
    )
    expect(labels).toEqual(['Sinf hisoboti', 'Tahrirlash', "O'qituvchilarni biriktirish"])

    ;(document.querySelector('[data-testid="menu-item-edit"]') as HTMLElement).click()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('class-edit')
  })

  it('menyudan "O`qituvchilarni biriktirish" modalni ochadi', async () => {
    const { w } = await mountView(base, ALL)
    await w.get('[data-testid="class-more-menu"]').trigger('click')
    await flushPromises()
    ;(document.querySelector('[data-testid="menu-item-assign"]') as HTMLElement).click()
    await flushPromises()
    expect(w.find('[data-testid="assign-modal"]').exists()).toBe(true)
  })

  it('ruxsatlar cheklangan: tugmalar qisqaradi, menyu faqat ruxsatli bandlar', async () => {
    const { w } = await mountView(base, ['reports.view'])
    expect(w.find('[data-testid="class-scoring-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="class-subject-grading-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="class-attendance-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="class-timetable-link"]').exists()).toBe(false)
    await w.get('[data-testid="class-more-menu"]').trigger('click')
    await flushPromises()
    const labels = Array.from(document.querySelectorAll('[role="menuitem"]')).map((e) =>
      e.textContent?.trim(),
    )
    expect(labels).toEqual(['Sinf hisoboti'])
  })

  it('menyu bo`sh bo`lsa "⋮" ko`rsatilmaydi', async () => {
    const { w } = await mountView(base, ['timetable.view'])
    expect(w.find('[data-testid="class-more-menu"]').exists()).toBe(false)
  })
})

describe('ClassDetailView fanlar kartasi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(academicYearsApi.list).mockResolvedValue({ items: [] } as never)
  })

  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      assignment(`s${i}`, `Fan ${String(i).padStart(2, '0')}`, `t${i}`, `Familiya${i} Ism`),
    )

  it("bir fanning o'qituvchilari bitta qatorda vergul bilan; chip ro'yxati yo'q", async () => {
    const { w } = await mountView(
      {
        ...base,
        teachers: [person('t1', 'Aliyeva Gulnora'), person('t2', "G'aniyeva Zilola")],
        subjects: [
          assignment('s1', 'Ingliz tili', 't1', 'Aliyeva Gulnora'),
          assignment('s1', 'Ingliz tili', 't2', "G'aniyeva Zilola"),
        ],
      },
      ALL,
    )
    const rows = w.findAll('[data-testid="class-subject-group"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Ingliz tili')
    expect(rows[0]!.get('[data-testid="class-subject-teachers"]').text()).toBe(
      "Aliyeva G., G'aniyeva Z.",
    )
    expect(w.get('#class-subjects-card-title').text()).toBe("Fanlar va o'qituvchilar (1)")
    // Qisqa nomning tooltipi to'liq ism
    expect(rows[0]!.find('[title="Aliyeva Gulnora"]').exists()).toBe(true)
    // Eski takroriy "O'qituvchilar:" chiplari yo'q
    expect(w.text()).not.toContain("O'qituvchilar:")
    expect(w.find('dl').exists()).toBe(false)
  })

  it("fansiz o'qituvchilar alohida qatorda", async () => {
    const { w } = await mountView(
      {
        ...base,
        teachers: [person('t1', 'Aliyeva Gulnora'), person('t5', 'Soliyev Bobur')],
        subjects: [assignment('s1', 'Algebra', 't1', 'Aliyeva Gulnora')],
      },
      ALL,
    )
    const rows = w.findAll('[data-testid="class-subject-group"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]!.text()).toContain('Fansiz')
    expect(rows[1]!.text()).toContain('Soliyev B.')
  })

  it("6 tadan ortiq: birinchi 6 ta, 'Yana N tasini ko'rsatish' / 'Yig'ish'", async () => {
    const { w } = await mountView({ ...base, subjects: many(11) }, ALL)
    expect(w.findAll('[data-testid="class-subject-group"]')).toHaveLength(6)
    const toggle = w.get('[data-testid="class-subjects-toggle"]')
    expect(toggle.text()).toBe("Yana 5 tasini ko'rsatish")
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(w.findAll('[data-testid="class-subject-group"]')).toHaveLength(11)
    expect(toggle.text()).toBe("Yig'ish")
    await toggle.trigger('click')
    expect(w.findAll('[data-testid="class-subject-group"]')).toHaveLength(6)
  })

  it('6 ta va undan kam: tugma ko`rinmaydi', async () => {
    const { w } = await mountView({ ...base, subjects: many(6) }, ALL)
    expect(w.find('[data-testid="class-subjects-toggle"]').exists()).toBe(false)
  })

  it('bo`sh holat: matn va Biriktirish tugmasi modalni ochadi', async () => {
    const { w } = await mountView(base, ALL)
    const empty = w.get('[data-testid="class-subjects-empty"]')
    expect(empty.text()).toContain('Fanlar biriktirilmagan')
    await empty.get('[data-testid="class-subjects-assign"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="assign-modal"]').exists()).toBe(true)
  })

  it("o'qituvchi nomi havola: teachers.manage bo`lmasa oddiy matn", async () => {
    const klass = { ...base, subjects: [assignment('s1', 'Algebra', 't1', 'Aliyeva Gulnora')] }
    const a = await mountView(klass, ALL)
    expect(a.w.get('[data-testid="class-subject-teachers"] a').attributes('href')).toBe(
      '/teachers/t1',
    )
    const b = await mountView(klass, ['classes.manage'])
    expect(b.w.find('[data-testid="class-subject-teachers"] a').exists()).toBe(false)
  })
})
