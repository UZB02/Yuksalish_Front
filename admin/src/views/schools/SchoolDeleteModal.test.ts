import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import { schoolsApi } from '@/api/schools.api'
import type { School, SchoolDeletePreview, User } from '@/api/types'
import { __resetBodyLock } from '@/composables/useBodyLock'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import SchoolsView from './SchoolsView.vue'
import SchoolDeleteModal from './SchoolDeleteModal.vue'
import SchoolFormModal from './SchoolFormModal.vue'

vi.mock('@/api/ratings.api', () => ({ ratingsApi: { schools: vi.fn().mockResolvedValue([]) } }))
vi.mock('@/api/schools.api', () => ({
  schoolsApi: {
    list: vi.fn(),
    deletePreview: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn(),
  },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const inactive: School = {
  id: 's1',
  name: 'Demo Maktab',
  slug: 'demo',
  address: null,
  phone: null,
  logoUrl: null,
  isActive: false,
  createdAt: '',
}
const active: School = { ...inactive, isActive: true }

const preview: SchoolDeletePreview = {
  school: { id: 's1', name: 'Demo Maktab', slug: 'demo', isActive: false, deletingAt: null },
  items: [
    { key: 'students', label: "O'quvchilar", count: 376 },
    { key: 'classes', label: 'Sinflar', count: 24 },
    { key: 'scores', label: 'Xulq baholari', count: 0 },
  ],
  total: 400,
  users: { teachers: 10, schoolAdmins: 1 },
  superadminsSkipped: 0,
}

const body = () => document.body
const q = <T extends HTMLElement>(sel: string) => body().querySelector<T>(sel)!
const submitBtn = () => q<HTMLButtonElement>('[data-testid="school-delete-submit"]')

async function typeInto(sel: string, value: string) {
  const el = q<HTMLInputElement>(sel)
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
async function check() {
  const box = q<HTMLInputElement>('[data-testid="school-delete-ack"] input[type="checkbox"]')
  box.checked = true
  box.dispatchEvent(new Event('change'))
  await flushPromises()
}
async function fillAll(name = 'Demo Maktab', password = 'Parol123') {
  await typeInto('[data-testid="school-delete-name"]', name)
  await typeInto('[data-testid="school-delete-password"]', password)
  await check()
}
const mountModal = (school: School | null = inactive) =>
  mount(SchoolDeleteModal, {
    props: { open: true, school },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
const clickSubmit = async () => {
  submitBtn().click()
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(schoolsApi.deletePreview).mockResolvedValue(preview)
  vi.mocked(schoolsApi.remove).mockResolvedValue({
    deleted: true,
    school: { id: 's1', name: 'Demo Maktab' },
    counts: {},
    total: 400,
    resumed: false,
  })
})
afterEach(() => {
  document.body.innerHTML = ''
  __resetBodyLock()
  vi.clearAllMocks()
})

describe('SchoolDeleteModal', () => {
  it("ogohlantirish, preview sonlari (nolsizlari) va maktab nomi ko'rinadi", async () => {
    const w = mountModal()
    await flushPromises()
    expect(schoolsApi.deletePreview).toHaveBeenCalledWith('s1')
    expect(q('[data-testid="school-delete-warning"]').textContent).toContain(
      "Bu amalni qaytarib bo'lmaydi. Barcha ma'lumotlar butunlay o'chiriladi.",
    )
    expect(q('[data-testid="preview-students"]').textContent).toContain('376')
    expect(q('[data-testid="preview-classes"]').textContent).toContain('24')
    expect(body().querySelector('[data-testid="preview-scores"]')).toBeNull()
    expect(q('[data-testid="school-delete-name-hint"]').textContent).toBe('Demo Maktab')
    expect(body().textContent).toContain('Tasdiqlash uchun maktab nomini kiriting')
    w.unmount()
  })

  it("boshida tugma o'chiq; faqat nom + parol + belgi bo'lsa yoqiladi", async () => {
    const w = mountModal()
    await flushPromises()
    expect(submitBtn().disabled).toBe(true)

    await typeInto('[data-testid="school-delete-name"]', 'Demo Maktab')
    expect(submitBtn().disabled).toBe(true) // parol va belgi yo'q
    await typeInto('[data-testid="school-delete-password"]', 'Parol123')
    expect(submitBtn().disabled).toBe(true) // belgi yo'q
    await check()
    expect(submitBtn().disabled).toBe(false)
    w.unmount()
  })

  it("nom mos kelmasa (registr ham) tugma o'chiq va xato ko'rinadi; ikki chetdagi bo'shliq e'tiborsiz", async () => {
    const w = mountModal()
    await flushPromises()
    await fillAll('demo maktab')
    expect(submitBtn().disabled).toBe(true)
    expect(body().textContent).toContain('Maktab nomi aynan mos kelishi kerak')
    await typeInto('[data-testid="school-delete-name"]', '  Demo Maktab  ')
    expect(submitBtn().disabled).toBe(false)
    expect(body().textContent).not.toContain('Maktab nomi aynan mos kelishi kerak')
    w.unmount()
  })

  it("parol bo'sh bo'lsa tugma o'chiq", async () => {
    const w = mountModal()
    await flushPromises()
    await fillAll('Demo Maktab', '')
    expect(submitBtn().disabled).toBe(true)
    w.unmount()
  })

  it("tasdiqlash belgisisiz tugma o'chiq", async () => {
    const w = mountModal()
    await flushPromises()
    await typeInto('[data-testid="school-delete-name"]', 'Demo Maktab')
    await typeInto('[data-testid="school-delete-password"]', 'Parol123')
    expect(submitBtn().disabled).toBe(true)
    w.unmount()
  })

  it("faol maktab uchun hamma narsa to'g'ri bo'lsa ham tugma o'chiq", async () => {
    const w = mountModal(active)
    await flushPromises()
    await fillAll()
    expect(body().textContent).toContain('Avval uni nofaol qiling')
    expect(submitBtn().disabled).toBe(true)
    w.unmount()
  })

  it("muvaffaqiyat: to'g'ri payload yuboriladi, toast, 'deleted' va 'close' emit qilinadi", async () => {
    const w = mountModal()
    await flushPromises()
    await fillAll('  Demo Maktab ', 'Parol123')
    await clickSubmit()
    expect(schoolsApi.remove).toHaveBeenCalledWith('s1', {
      confirmName: 'Demo Maktab',
      password: 'Parol123',
      acknowledge: true,
    })
    expect(w.emitted('deleted')?.[0]).toEqual(['s1'])
    expect(w.emitted('close')).toBeTruthy()
    expect(useToast().toasts.some((t) => t.message === "Maktab butunlay o'chirildi")).toBe(true)
    w.unmount()
  })

  it("noto'g'ri parol: parol maydonida xato, modal ochiq qoladi, emit yo'q", async () => {
    vi.mocked(schoolsApi.remove).mockRejectedValue(
      new ApiError('INVALID_PASSWORD', "Parol noto'g'ri", 400, [
        { path: 'password', message: "Parol noto'g'ri" },
      ]),
    )
    const w = mountModal()
    await flushPromises()
    await fillAll()
    await clickSubmit()
    expect(body().textContent).toContain("Parol noto'g'ri")
    expect(w.emitted('deleted')).toBeUndefined()
    expect(w.emitted('close')).toBeUndefined()
    // Parolni o'zgartirgach xato tozalanadi
    await typeInto('[data-testid="school-delete-password"]', 'Boshqa123')
    expect(body().textContent).not.toContain("Parol noto'g'ri")
    w.unmount()
  })

  it("429: server xabari umumiy xato sifatida ko'rinadi", async () => {
    vi.mocked(schoolsApi.remove).mockRejectedValue(
      new ApiError('RATE_LIMITED', "Parol urinishlari juda ko'p. 14 daqiqadan so'ng", 429),
    )
    const w = mountModal()
    await flushPromises()
    await fillAll()
    await clickSubmit()
    expect(q('[data-testid="school-delete-error"]').textContent).toContain(
      "Parol urinishlari juda ko'p. 14 daqiqadan so'ng",
    )
    expect(w.emitted('deleted')).toBeUndefined()
    w.unmount()
  })

  it("serverda nom mos kelmasa (400 confirmName) nom maydonida xato; 409 xabari ko'rinadi", async () => {
    vi.mocked(schoolsApi.remove).mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', 'x', 400, [{ path: 'confirmName', message: 'x' }]),
    )
    const w = mountModal()
    await flushPromises()
    await fillAll()
    await clickSubmit()
    expect(body().textContent).toContain('Maktab nomi aynan mos kelishi kerak')

    vi.mocked(schoolsApi.remove).mockRejectedValueOnce(
      new ApiError('CONFLICT', 'Avval maktabni nofaol qiling', 409),
    )
    await typeInto('[data-testid="school-delete-name"]', 'Demo Maktab ')
    await clickSubmit()
    expect(q('[data-testid="school-delete-error"]').textContent).toContain(
      'Avval maktabni nofaol qiling',
    )
    w.unmount()
  })

  it("preview yuklanmasa xato ko'rinadi, lekin o'chirish imkoniyati to'sib qo'yilmaydi", async () => {
    vi.mocked(schoolsApi.deletePreview).mockRejectedValue(new ApiError('INTERNAL', 'x', 500))
    const w = mountModal()
    await flushPromises()
    expect(body().textContent).toContain("O'chiriladigan ma'lumotlar sonini yuklab bo'lmadi")
    w.unmount()
  })
})

describe('SchoolFormModal: Xavfli hudud', () => {
  const superadmin: User = {
    id: 'u1',
    fullName: 'Root',
    username: 'root',
    role: 'superadmin',
    schoolId: null,
    permissions: [],
  } as unknown as User

  const mountForm = (school: School | null, role: 'superadmin' | 'school_admin' = 'superadmin') => {
    const auth = useAuthStore()
    auth.setSession('tok', { ...superadmin, role } as User)
    return mount(SchoolFormModal, {
      props: { open: true, school },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
  }
  const openBtn = () =>
    body().querySelector<HTMLButtonElement>('[data-testid="school-delete-open"]')

  it("superadmin + nofaol maktab: tugma yoqilgan, bosilganda o'chirish modali ochiladi", async () => {
    const w = mountForm(inactive)
    await flushPromises()
    expect(body().querySelector('[data-testid="school-danger-zone"]')).toBeTruthy()
    expect(body().textContent).toContain('Xavfli hudud')
    expect(openBtn()!.disabled).toBe(false)
    openBtn()!.click()
    await flushPromises()
    expect(schoolsApi.deletePreview).toHaveBeenCalledWith('s1')
    expect(body().querySelector('[data-testid="school-delete-form"]')).toBeTruthy()
    w.unmount()
  })

  it("faol maktab: tugma o'chiq va izoh 'Avval maktabni nofaol qiling'", async () => {
    const w = mountForm(active)
    await flushPromises()
    expect(openBtn()!.disabled).toBe(true)
    expect(openBtn()!.getAttribute('title')).toBe('Avval maktabni nofaol qiling')
    expect(body().querySelector('[data-testid="school-danger-zone"]')!.textContent).toContain(
      'Avval maktabni nofaol qiling',
    )
    w.unmount()
  })

  it("yangi maktab yaratishda va superadmin bo'lmaganda hudud ko'rinmaydi", async () => {
    const w1 = mountForm(null)
    await flushPromises()
    expect(body().querySelector('[data-testid="school-danger-zone"]')).toBeNull()
    w1.unmount()
    document.body.innerHTML = ''
    const w2 = mountForm(inactive, 'school_admin')
    await flushPromises()
    expect(body().querySelector('[data-testid="school-danger-zone"]')).toBeNull()
    w2.unmount()
  })

  it("o'chirish muvaffaqiyatli bo'lsa forma 'deleted' va 'close' ni emit qiladi", async () => {
    const w = mountForm(inactive)
    await flushPromises()
    openBtn()!.click()
    await flushPromises()
    await fillAll()
    await clickSubmit()
    expect(w.emitted('deleted')?.[0]).toEqual(['s1'])
    expect(w.emitted('close')).toBeTruthy()
    w.unmount()
  })
})

describe("SchoolsView: muvaffaqiyatli o'chirishdan keyin", () => {
  it("ro'yxat va switcher qayta yuklanadi; o'chirilgan maktab tanlangan bo'lsa tanlov tozalanadi", async () => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setSession('tok', {
      id: 'u1',
      role: 'superadmin',
      fullName: 'R',
      username: 'r',
    } as unknown as User)
    const ctx = useSchoolContextStore()
    ctx.select('s1')
    vi.mocked(schoolsApi.list).mockResolvedValue({
      items: [inactive],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never)
    const w = mount(SchoolsView, {
      global: { plugins: [i18n], stubs: { PublicLink: true } },
      attachTo: document.body,
    })
    await flushPromises()
    const calls = vi.mocked(schoolsApi.list).mock.calls.length
    w.findComponent(SchoolFormModal).vm.$emit('deleted', 's1')
    await flushPromises()
    expect(ctx.schoolId).toBeNull()
    // ro'yxat (SchoolsView) va switcher (store) qayta yuklangan
    expect(vi.mocked(schoolsApi.list).mock.calls.length).toBeGreaterThanOrEqual(calls + 2)
    w.unmount()
  })

  it("boshqa maktab o'chirilsa tanlov saqlanadi", async () => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setSession('tok', {
      id: 'u1',
      role: 'superadmin',
      fullName: 'R',
      username: 'r',
    } as unknown as User)
    const ctx = useSchoolContextStore()
    ctx.select('keep')
    vi.mocked(schoolsApi.list).mockResolvedValue({
      items: [inactive, { ...inactive, id: 'keep' }],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    } as never)
    const w = mount(SchoolsView, {
      global: { plugins: [i18n], stubs: { PublicLink: true } },
      attachTo: document.body,
    })
    await flushPromises()
    w.findComponent(SchoolFormModal).vm.$emit('deleted', 's1')
    await flushPromises()
    expect(ctx.schoolId).toBe('keep')
    w.unmount()
  })
})
