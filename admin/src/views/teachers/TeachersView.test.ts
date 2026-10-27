import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { teachersApi } from '@/api/teachers.api'
import { useAuthStore } from '@/stores/auth'
import type { Teacher } from '@/api/types'
import TeachersView from './TeachersView.vue'

vi.mock('@/api/teachers.api', () => ({
  teachersApi: { list: vi.fn(), update: vi.fn() },
}))
vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}))

const asg = (classId: string, className: string, subjectId: string, subjectName: string) => ({
  classId,
  className,
  subjectId,
  subjectName,
})
const classes = Array.from({ length: 11 }, (_, i) => ({ id: `c${i}`, name: `${i + 1}-A` }))

const busy = {
  id: 't1',
  fullName: 'Karimov Karim Karimovich',
  username: 'karimov',
  phone: '+998901234567',
  role: 'teacher',
  schoolId: 's1',
  permissions: ['students.view'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
  classes,
  subjectAssignments: classes.map((c) => asg(c.id, c.name, 'inf', 'Informatika')),
  homeroomClasses: [{ id: 'c0', name: '1-A' }],
} as unknown as Teacher
const idle = {
  ...busy,
  id: 't2',
  fullName: 'Bo`sh O`qituvchi',
  username: 'bosh',
  phone: null,
  isActive: false,
  lastLoginAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  classes: [],
  subjectAssignments: [],
  homeroomClasses: [],
} as unknown as Teacher

const ModalsStub = {
  props: ['actions'],
  template:
    '<div data-testid="modals">{{ actions.formOpen }}|{{ actions.editing?.id }}|{{ actions.permTarget?.id }}</div>',
}

function mountView(items: Teacher[]) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.setSession('tok', {
    id: 'u',
    fullName: 'Admin',
    username: 'admin',
    role: 'school_admin',
    schoolId: 's1',
    permissions: ['teachers.manage'],
    isActive: true,
    lastLoginAt: null,
    createdAt: '',
  })
  vi.mocked(teachersApi.list).mockResolvedValue({
    items,
    meta: { page: 1, limit: 10, total: items.length, totalPages: 1 },
  })
  return mount(TeachersView, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
      stubs: {
        RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
        TeacherActionModals: ModalsStub,
      },
    },
    attachTo: document.body,
  })
}

describe('TeachersView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('11 sinfli o`qituvchi: bitta ixcham fan chipi, ism va `login · telefon`', async () => {
    const w = await (async () => {
      const m = mountView([busy, idle])
      await flushPromises()
      return m
    })()
    const table = w.get('[data-testid="teachers-table"]')
    const firstRow = table.findAll('tbody tr')[0]!
    const chips = firstRow.findAll('[data-testid="workload-chip"]')
    expect(chips.map((c) => c.text())).toEqual(['Informatika · 11 sinf', 'Rahbar: 1-A'])
    expect(firstRow.text()).toContain('11 ta sinf')
    expect(firstRow.text()).not.toContain('2-A')
    expect(firstRow.text()).toContain('karimov · +998901234567')
    const link = firstRow.get('[data-testid="teacher-link"]')
    expect(link.attributes('title')).toBe('Karimov Karim Karimovich')
    expect(JSON.parse(link.attributes('data-to')!)).toEqual({
      name: 'teacher-detail',
      params: { id: 't1' },
    })
    w.unmount()
  })

  it('ustunlar: tartib, table-fixed va eski keng ustunlar yo`q', async () => {
    const w = mountView([busy])
    await flushPromises()
    const heads = w.findAll('thead th').map((th) => th.text())
    expect(heads).toEqual(["O'qituvchi", 'Yuklama', 'Oxirgi kirish', 'Holati', 'Amallar'])
    expect(w.get('table').classes()).toContain('table-fixed')
    w.unmount()
  })

  it('oxirgi kirish: nisbiy vaqt, aniq vaqt tooltipda; kirmagan bo`lsa matn', async () => {
    const w = mountView([busy, idle])
    await flushPromises()
    const rows = w.get('[data-testid="teachers-table"]').findAll('tbody tr')
    expect(rows[0]!.text()).toContain('Hali kirmagan')
    const time = rows[1]!.get('time')
    expect(time.text()).toBe('3 kun oldin')
    expect(time.attributes('title')).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
    w.unmount()
  })

  it('amallar: Tahrirlash ko`rinadi, qolgani menyuda; tahrirlash modalni ochadi', async () => {
    const w = mountView([busy])
    await flushPromises()
    const row = w.get('[data-testid="teachers-table"] tbody tr')
    expect(row.findAll('button[aria-haspopup="menu"]')).toHaveLength(1)
    await row.get('[data-testid="teacher-edit"]').trigger('click')
    expect(w.get('[data-testid="modals"]').text()).toBe('true|t1|')

    await row.get('[data-testid="menu-trigger"]').trigger('click')
    document.body.querySelector<HTMLElement>('[data-testid="menu-item-permissions"]')!.click()
    await flushPromises()
    expect(w.get('[data-testid="modals"]').text()).toBe('true|t1|t1')
    w.unmount()
  })

  it('menyudan faolsizlantirish update ni chaqiradi va ro`yxatni qayta yuklaydi', async () => {
    const w = mountView([busy])
    await flushPromises()
    vi.mocked(teachersApi.update).mockResolvedValue(busy)
    await w.get('[data-testid="teachers-table"] [data-testid="menu-trigger"]').trigger('click')
    document.body.querySelector<HTMLElement>('[data-testid="menu-item-toggle"]')!.click()
    await flushPromises()
    expect(teachersApi.update).toHaveBeenCalledWith('t1', { isActive: false })
    expect(teachersApi.list).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('mobil kartalar: har bir o`qituvchi uchun karta, holat va menyu', async () => {
    const w = mountView([busy, idle])
    await flushPromises()
    const cards = w.findAll('[data-testid="teacher-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Informatika · 11 sinf')
    expect(cards[1]!.text()).toContain('Nofaol')
    expect(cards[0]!.find('button[aria-haspopup="menu"]').exists()).toBe(true)
    w.unmount()
  })

  it('bo`sh ro`yxat: EmptyState', async () => {
    const w = mountView([])
    await flushPromises()
    expect(w.text()).toContain("O'qituvchilar topilmadi")
    expect(w.find('[data-testid="teachers-table"]').exists()).toBe(false)
    w.unmount()
  })

  it('yuklanayotganda skeleton ko`rsatiladi', async () => {
    const w = mountView([busy])
    await nextTick() // so'rov hali tugamagan
    expect(w.findAll('[aria-hidden="true"].animate-pulse').length).toBeGreaterThan(0)
    await flushPromises()
    w.unmount()
  })
})
