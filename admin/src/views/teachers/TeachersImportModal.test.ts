import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { teachersApi } from '@/api/teachers.api'
import { useAuthStore } from '@/stores/auth'
import type { Teacher, TeacherImportPreview, TeacherImportResult } from '@/api/types'
import TeachersImportModal from './TeachersImportModal.vue'
import TeachersView from './TeachersView.vue'

vi.mock('@/api/teachers.api', () => ({
  teachersApi: {
    list: vi.fn(),
    update: vi.fn(),
    importPreview: vi.fn(),
    importConfirm: vi.fn(),
    downloadCredentials: vi.fn(),
    downloadImportTemplate: vi.fn(),
  },
}))
vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}))

const row = (over: Record<string, unknown>) => ({
  rowNo: 2,
  fullName: 'Raxmanova Zilola Shuxrat qizi',
  phone: '+998 93 944 00 89',
  login: 'zilola.r',
  loginGenerated: true,
  passwordGenerated: true,
  status: 'create',
  messages: [],
  password: 'zilolar12345',
  ...over,
})

const preview: TeacherImportPreview = {
  summary: { total: 3, create: 1, skipExisting: 1, error: 1 },
  rows: [
    row({ messages: ['Ismi takrorlangani uchun login ajratildi: zilola.r'] }),
    row({
      rowNo: 3,
      fullName: 'Mavjud Odam Bor',
      login: 'odam',
      status: 'skip_existing',
      password: null,
      messages: ["Allaqachon mavjud — o'tkaziladi"],
    }),
    row({
      rowNo: 4,
      fullName: 'Xato Qator',
      login: null,
      loginGenerated: false,
      passwordGenerated: false,
      status: 'error',
      password: null,
      messages: ['Parol yaroqsiz'],
    }),
  ] as TeacherImportPreview['rows'],
}

const result: TeacherImportResult = {
  summary: { total: 3, created: 1, skipped: 1, failed: 1 },
  results: [
    {
      rowNo: 2,
      fullName: 'Raxmanova Zilola Shuxrat qizi',
      phone: null,
      login: 'zilola.r',
      password: 'zilolar12345',
      status: 'created',
      message: null,
    },
    {
      rowNo: 3,
      fullName: 'Mavjud Odam Bor',
      phone: null,
      login: 'odam',
      password: null,
      status: 'skipped',
      message: null,
    },
    {
      rowNo: 4,
      fullName: 'Xato Qator',
      phone: null,
      login: null,
      password: null,
      status: 'failed',
      message: 'Parol yaroqsiz',
    },
  ],
}

function mountModal(open = true) {
  setActivePinia(createPinia())
  return mount(TeachersImportModal, {
    props: { open },
    global: { plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })] },
    attachTo: document.body,
  })
}

const q = (sel: string) => document.body.querySelector(sel) as HTMLElement | null

async function pickFile(name = 'oqituvchilar.xlsx') {
  const input = q('[data-testid="ti-file"]') as HTMLInputElement
  const file = new File([new Uint8Array(10)], name)
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
  await flushPromises()
}

describe('TeachersImportModal', () => {
  let w: VueWrapper

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(teachersApi.importPreview).mockResolvedValue(preview)
    vi.mocked(teachersApi.importConfirm).mockResolvedValue(result)
    vi.mocked(teachersApi.downloadCredentials).mockResolvedValue('login-parollar.xlsx')
  })

  it('1-qadam: qoida tushuntirilgan, shablon yuklanadi, noto`g`ri fayl rad etiladi', async () => {
    w = mountModal()
    await flushPromises()
    expect(document.body.textContent).toContain('Login va parol qoidasi')
    expect(document.body.textContent).toContain('12345')
    q('[data-testid="ti-template"]')!.click()
    expect(teachersApi.downloadImportTemplate).toHaveBeenCalled()

    expect((q('[data-testid="ti-check"]') as HTMLButtonElement).disabled).toBe(true)
    await pickFile('a.csv')
    expect(document.body.textContent).toContain('Faqat .xlsx')
    expect((q('[data-testid="ti-check"]') as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
  })

  it('oqim: yuklash -> ko`rish (holatlar, avto belgilar) -> yaratish -> natija + ogohlantirish + yuklab olish', async () => {
    w = mountModal()
    await flushPromises()
    await pickFile()
    expect(document.body.textContent).toContain('oqituvchilar.xlsx')
    q('[data-testid="ti-check"]')!.click()
    await flushPromises()

    expect(teachersApi.importPreview).toHaveBeenCalledTimes(1)
    // hech narsa yaratilmagan
    expect(teachersApi.importConfirm).not.toHaveBeenCalled()
    const body = document.body.textContent ?? ''
    expect(body).toContain('Hozircha hech narsa yaratilmadi')
    const statuses = [...document.body.querySelectorAll('[data-testid="row-status"]')].map((e) =>
      e.textContent?.trim(),
    )
    expect(statuses).toEqual(['Yangi', "Mavjud — o'tkaziladi", 'Xato'])
    expect(document.body.querySelectorAll('[data-testid="auto-login"]')).toHaveLength(2)
    expect(document.body.querySelectorAll('[data-testid="auto-password"]')).toHaveLength(1)
    expect(body).toContain('Ismi takrorlangani uchun login ajratildi')
    expect(body).toContain('Parol yaroqsiz')
    expect(q('[data-testid="ti-confirm"]')!.textContent).toContain('Yaratish (1)')

    q('[data-testid="ti-confirm"]')!.click()
    await flushPromises()
    expect(teachersApi.importConfirm).toHaveBeenCalledTimes(1)
    expect(vi.mocked(teachersApi.importConfirm).mock.calls[0]![0]).toBeInstanceOf(File)
    expect(w.emitted('imported')).toHaveLength(1)

    const warn = q('[data-testid="ti-warning"]')!
    expect(warn.textContent).toContain(
      "Bu fayl parollarni o'z ichiga oladi — xavfsiz saqlang va tarqatgandan keyin o'chiring.",
    )
    q('[data-testid="ti-credentials"]')!.click()
    await flushPromises()
    expect(teachersApi.downloadCredentials).toHaveBeenCalledWith(result.results)

    q('[data-testid="ti-close"]')!.click()
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })

  it('yangi qator bo`lmasa "Yaratish" o`chiq', async () => {
    vi.mocked(teachersApi.importPreview).mockResolvedValue({
      summary: { total: 1, create: 0, skipExisting: 1, error: 0 },
      rows: [preview.rows[1]!],
    })
    w = mountModal()
    await flushPromises()
    await pickFile()
    q('[data-testid="ti-check"]')!.click()
    await flushPromises()
    expect((q('[data-testid="ti-confirm"]') as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
  })

  it('ochilganda holat tozalanadi: natijadagi parollar xotirada qolmaydi', async () => {
    w = mountModal()
    await flushPromises()
    await pickFile()
    q('[data-testid="ti-check"]')!.click()
    await flushPromises()
    q('[data-testid="ti-confirm"]')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('zilolar12345')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    expect(document.body.textContent).not.toContain('zilolar12345')
    expect(q('[data-testid="ti-upload"]')).not.toBeNull()
    w.unmount()
  })
})

describe('TeachersView: import tugmasi ruxsatga bog`liq', () => {
  const mountView = (permissions: string[]) => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setSession('tok', {
      id: 'u',
      fullName: 'Admin',
      username: 'admin',
      role: 'school_admin',
      schoolId: 's1',
      permissions,
      isActive: true,
      lastLoginAt: null,
      createdAt: '',
    })
    vi.mocked(teachersApi.list).mockResolvedValue({
      items: [] as Teacher[],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    })
    return mount(TeachersView, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })],
        stubs: { TeacherActionModals: true, RouterLink: true },
      },
      attachTo: document.body,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('teachers.manage bor: tugma ko`rinadi va modalni ochadi', async () => {
    const w = mountView(['teachers.manage'])
    await flushPromises()
    const btn = w.get('[data-testid="teachers-import"]')
    expect(btn.text()).toContain("Excel'dan import")
    await btn.trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain("O'qituvchilarni Excel'dan yuklash")
    w.unmount()
  })

  it('teachers.manage yo`q: tugma ham, modal ham yo`q', async () => {
    const w = mountView(['students.view'])
    await flushPromises()
    expect(w.find('[data-testid="teachers-import"]').exists()).toBe(false)
    expect(document.body.textContent).not.toContain("O'qituvchilarni Excel'dan yuklash")
    w.unmount()
  })
})
