import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { teachersApi } from '@/api/teachers.api'
import { useAuthStore } from '@/stores/auth'
import type { Teacher } from '@/api/types'
import TeacherDetailView from './TeacherDetailView.vue'

vi.mock('@/api/teachers.api', () => ({
  teachersApi: { get: vi.fn(), update: vi.fn() },
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 't1' } }) }))

const asg = (classId: string, className: string, subjectId: string, subjectName: string) => ({
  classId,
  className,
  subjectId,
  subjectName,
})

const teacher = {
  id: 't1',
  fullName: 'Karimov Karim',
  username: 'karimov',
  phone: '+998901234567',
  role: 'teacher',
  schoolId: 's1',
  permissions: ['students.view', 'scores.create', 'custom.key'],
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
  classes: [
    { id: 'c1', name: '1-A' },
    { id: 'c2', name: '2-A' },
    { id: 'c3', name: '3-A' },
  ],
  subjectAssignments: [
    asg('c1', '1-A', 'inf', 'Informatika'),
    asg('c2', '2-A', 'inf', 'Informatika'),
    asg('c1', '1-A', 'mat', 'Matematika'),
  ],
  homeroomClasses: [{ id: 'c1', name: '1-A' }],
} as unknown as Teacher

function mountView() {
  setActivePinia(createPinia())
  useAuthStore().setSession('tok', {
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
  return mount(TeacherDetailView, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        TeacherActionModals: { template: '<div />' },
      },
    },
  })
}

describe('TeacherDetailView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sarlavha: ism, holat, login, telefon, oxirgi kirish', async () => {
    vi.mocked(teachersApi.get).mockResolvedValue(teacher)
    const w = mountView()
    expect(w.find('[data-testid="detail-skeleton"]').exists()).toBe(true)
    await flushPromises()
    expect(teachersApi.get).toHaveBeenCalledWith('t1')
    const header = w.get('[data-testid="teacher-header"]')
    expect(header.get('h1').text()).toBe('Karimov Karim')
    expect(header.text()).toContain('Faol')
    const meta = w.get('[data-testid="teacher-meta"]').text()
    expect(meta).toContain('karimov')
    expect(meta).toContain('+998901234567')
    expect(meta).toContain('Hali kirmagan')
  })

  it('KPI: sinflar, fanlar va rahbar sinflar soni', async () => {
    vi.mocked(teachersApi.get).mockResolvedValue(teacher)
    const w = mountView()
    await flushPromises()
    expect(w.get('[data-testid="kpi-classes"]').text()).toBe('3')
    expect(w.get('[data-testid="kpi-subjects"]').text()).toBe('2')
    expect(w.get('[data-testid="kpi-homeroom"]').text()).toBe('1')
  })

  it('sinf x fan taqsimoti: fan bo`yicha guruh, rahbarlik va fansiz sinflar', async () => {
    vi.mocked(teachersApi.get).mockResolvedValue(teacher)
    const w = mountView()
    await flushPromises()
    const subjects = w.findAll('[data-testid="breakdown-subject"]')
    expect(subjects).toHaveLength(2)
    expect(subjects[0]!.text()).toContain('Informatika')
    expect(subjects[0]!.text()).toContain('2 ta sinf')
    expect(subjects[0]!.text()).toContain('1-A')
    expect(subjects[0]!.text()).toContain('2-A')
    expect(w.get('[data-testid="breakdown-homeroom"]').text()).toContain('1-A')
    expect(w.get('[data-testid="breakdown-nosubject"]').text()).toContain('3-A')
  })

  it('ruxsatlar xulosasi: tarjima qilingan nomlar, noma`lum kalit o`z holida', async () => {
    vi.mocked(teachersApi.get).mockResolvedValue(teacher)
    const w = mountView()
    await flushPromises()
    const text = w.get('[data-testid="teacher-permissions"]').text()
    expect(text).toContain('3 ta ruxsat')
    expect(text).toContain("O'quvchilarni ko'rish")
    expect(text).toContain("Ball qo'yish")
    expect(text).toContain('custom.key')
  })

  it('amallar: tahrirlash tugmasi va menyu mavjud', async () => {
    vi.mocked(teachersApi.get).mockResolvedValue(teacher)
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-testid="detail-edit"]').exists()).toBe(true)
    expect(w.find('button[aria-haspopup="menu"]').exists()).toBe(true)
  })

  it('yuklab bo`lmasa xato holati va qayta urinish', async () => {
    vi.mocked(teachersApi.get).mockRejectedValueOnce(new Error('boom'))
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain("O'qituvchini yuklab bo'lmadi")
    vi.mocked(teachersApi.get).mockResolvedValue(teacher)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Qayta urinish')!
      .trigger('click')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Karimov Karim')
  })

  it('hech narsa biriktirilmagan: bo`sh xabar', async () => {
    vi.mocked(teachersApi.get).mockResolvedValue({
      ...teacher,
      classes: [],
      subjectAssignments: [],
      homeroomClasses: [],
    })
    const w = mountView()
    await flushPromises()
    expect(w.get('[data-testid="teacher-breakdown"]').text()).toContain(
      'Hali sinf yoki fan biriktirilmagan',
    )
  })
})
