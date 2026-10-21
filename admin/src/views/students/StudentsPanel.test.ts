import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { studentsApi } from '@/api/students.api'
import { classesApi } from '@/api/classes.api'
import { useAuthStore } from '@/stores/auth'
import type { Role, Student } from '@/api/types'
import StudentsPanel from './StudentsPanel.vue'

vi.mock('@/api/students.api', () => ({ studentsApi: { list: vi.fn(), exportXlsx: vi.fn() } }))
vi.mock('@/api/classes.api', () => ({ classesApi: { list: vi.fn() } }))

const student: Student = {
  id: 's1',
  fullName: 'Aliyev Vali',
  studentCode: null,
  birthDate: null,
  gender: null,
  classId: 'c1',
  class: { id: 'c1', name: '7-A' },
  parentPhone: null,
  photoUrl: null,
  status: 'active',
  createdAt: '',
}

async function mountAs(role: Role, permissions: string[]) {
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
  vi.mocked(studentsApi.list).mockResolvedValue({
    items: [student],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  })
  vi.mocked(classesApi.list).mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
  })
  const w = mount(StudentsPanel, {
    props: { classId: 'c1', className: '7-A' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
      stubs: { RouterLink: { template: '<a><slot /></a>' }, Teleport: true },
    },
  })
  await flushPromises()
  return w
}

describe("StudentsPanel: ruxsat bo'yicha tugmalar", () => {
  beforeEach(() => vi.clearAllMocks())

  it("students.manage bo'lmasa yozish tugmalari ko'rinmaydi, eksport qoladi", async () => {
    const w = await mountAs('teacher', ['students.view'])
    const text = w.text()
    expect(text).toContain('Aliyev Vali')
    expect(text).not.toContain("O'quvchi qo'shish")
    expect(text).not.toContain('Excel orqali yuklash')
    expect(text).toContain('Eksport')
    expect(w.find('[aria-label^="Tahrirlash"]').exists()).toBe(false)
  })

  it("students.manage bilan qo'shish, Excel va tahrirlash tugmalari bor", async () => {
    const w = await mountAs('school_admin', ['students.view', 'students.manage'])
    const text = w.text()
    expect(text).toContain("O'quvchi qo'shish")
    expect(text).toContain('Excel orqali yuklash')
    expect(w.find('[aria-label^="Tahrirlash"]').exists()).toBe(true)
  })
})
