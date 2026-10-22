import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uz from '@/locales/uz.json'
import { classesApi } from '@/api/classes.api'
import { academicYearsApi } from '@/api/academicYears.api'
import { teachersApi } from '@/api/teachers.api'
import { subjectsApi } from '@/api/subjects.api'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import type { SchoolClass } from '@/api/types'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { selectOption } from '@/test-utils/selectOption'
import ClassFormView from './ClassFormView.vue'

vi.mock('@/api/classes.api', () => ({
  classesApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/api/academicYears.api', () => ({ academicYearsApi: { list: vi.fn() } }))
vi.mock('@/api/teachers.api', () => ({ teachersApi: { list: vi.fn() } }))
vi.mock('@/api/subjects.api', () => ({ subjectsApi: { list: vi.fn() } }))

const page = <T>(items: T[]) => ({
  items,
  meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
})
const year = (isActive: boolean) => ({
  id: 'y1',
  name: '2026/2027',
  startDate: '',
  endDate: '',
  isActive,
  periods: [],
  createdAt: '',
})
const klass: SchoolClass = {
  id: 'c1',
  name: '7-A',
  grade: 7,
  section: 'A',
  academicYearId: 'y1',
  homeroomTeacherId: null,
  homeroomTeacher: null,
  teacherIds: [],
  teachers: [],
  subjects: [],
  studentsCount: 0,
  isArchived: false,
  createdAt: '',
}

async function mountAt(path: string) {
  setActivePinia(createPinia())
  useAuthStore().setSession('tok', {
    id: 'u',
    fullName: 'U',
    username: 'u',
    role: 'school_admin',
    schoolId: 's',
    permissions: ['classes.manage'],
    isActive: true,
    lastLoginAt: null,
    createdAt: '',
  })
  const stub = { template: '<div data-testid="stub" />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/classes', name: 'classes', component: stub },
      { path: '/classes/new', name: 'class-create', component: ClassFormView },
      { path: '/classes/:id/edit', name: 'class-edit', component: ClassFormView },
      { path: '/classes/:id', name: 'class-detail', component: stub },
      { path: '/academic-years', name: 'academic-years', component: stub },
    ],
  })
  await router.push(path)
  const w = mount(
    { template: '<RouterView />' },
    {
      global: {
        plugins: [router, createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
      },
    },
  )
  await flushPromises()
  return { w, router }
}

describe('ClassFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(academicYearsApi.list).mockResolvedValue(page([year(true)]))
    vi.mocked(teachersApi.list).mockResolvedValue(page([]))
    vi.mocked(subjectsApi.list).mockResolvedValue(page([]))
    vi.mocked(classesApi.get).mockResolvedValue(klass)
    useConfirm().settle(false)
  })

  it("yaratish: saqlangach sinf tafsilot sahifasiga o'tadi", async () => {
    vi.mocked(classesApi.create).mockResolvedValue({ ...klass, id: 'new1', name: '5-B' })
    const { w, router } = await mountAt('/classes/new')
    expect(w.text()).toContain("Asosiy ma'lumotlar")
    await selectOption(w.findComponent(BaseSelect), '5')
    await w.findAll('input')[0]!.setValue('b')
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('class-detail'))
    expect(classesApi.create).toHaveBeenCalledWith({
      name: '5-B',
      grade: 5,
      section: 'b',
      academicYearId: 'y1',
    })
    expect(router.currentRoute.value.name).toBe('class-detail')
    expect(router.currentRoute.value.params.id).toBe('new1')
    // Muvaffaqiyatli saqlashdan keyin "saqlanmagan o'zgarishlar" so'rovi chiqmaydi
    expect(useConfirm().state.open).toBe(false)
  })

  it("faol o'quv yili yo'q bo'lsa yaratish o'rniga bo'sh holat", async () => {
    vi.mocked(academicYearsApi.list).mockResolvedValue(page([year(false)]))
    const { w } = await mountAt('/classes/new')
    expect(w.text()).toContain("Avval o'quv yilini faollashtiring")
    expect(w.find('form').exists()).toBe(false)
  })

  it("tahrirlash: mavjud qiymatlar bilan to'ldiriladi va update chaqiriladi", async () => {
    vi.mocked(classesApi.update).mockResolvedValue(klass)
    const { w, router } = await mountAt('/classes/c1/edit')
    expect(classesApi.get).toHaveBeenCalledWith('c1')
    expect(w.text()).toContain('Sinfni tahrirlash: 7-A')
    expect(w.findComponent(BaseSelect).get('[role="combobox"]').text()).toBe('7-sinf')
    expect((w.findAll('input')[0]!.element as HTMLInputElement).value).toBe('A')
    expect((w.findAll('input')[1]!.element as HTMLInputElement).value).toBe('7-A')
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('class-detail'))
    expect(classesApi.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ name: '7-A', grade: 7, section: 'A', subjects: [] }),
    )
    expect(router.currentRoute.value.name).toBe('class-detail')
  })

  it('tahrirlash: sinf yuklanmasa xato holati', async () => {
    vi.mocked(classesApi.get).mockRejectedValue(new Error('x'))
    const { w } = await mountAt('/classes/c1/edit')
    expect(w.text()).toContain("Sinfni yuklab bo'lmadi")
    expect(w.find('form').exists()).toBe(false)
  })

  it("saqlanmagan o'zgarish bilan chiqishda tasdiq so'raydi; bekor qilsa qoladi", async () => {
    const { w, router } = await mountAt('/classes/c1/edit')
    await w.findAll('input')[1]!.setValue('7-Z')
    const nav = router.push('/classes')
    await flushPromises()
    expect(useConfirm().state.open).toBe(true)
    useConfirm().settle(false)
    await nav
    expect(router.currentRoute.value.name).toBe('class-edit')

    const nav2 = router.push('/classes')
    await flushPromises()
    useConfirm().settle(true)
    await nav2
    expect(router.currentRoute.value.name).toBe('classes')
  })

  it("o'zgarish bo'lmasa so'rovsiz chiqadi", async () => {
    const { router } = await mountAt('/classes/c1/edit')
    await router.push('/classes')
    expect(useConfirm().state.open).toBe(false)
    expect(router.currentRoute.value.name).toBe('classes')
  })
})
