import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { teachersApi } from '@/api/teachers.api'
import type { Teacher } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useTeacherActions } from './useTeacherActions'

vi.mock('@/api/teachers.api', () => ({
  teachersApi: { usage: vi.fn(), remove: vi.fn(), update: vi.fn() },
}))
const h = vi.hoisted(() => ({ confirm: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('./useConfirm', () => ({ useConfirm: () => ({ confirm: h.confirm }) }))
vi.mock('./useToast', () => ({ useToast: () => ({ success: h.success, error: h.error }) }))
vi.mock('./useLookups', () => ({
  useClassLookup: () => ({ items: [], loading: false, load: vi.fn() }),
}))

const tc = (isActive = true) =>
  ({ id: 't1', fullName: 'Karimov Karim', isActive }) as unknown as Teacher
const noCounts = {
  scores: 0,
  subjectGrades: 0,
  attendance: 0,
  timetableEntries: 0,
  lessonOverrides: 0,
  auditActions: 0,
}

function setup(permissions: string[], reload = vi.fn(), onDeleted?: () => unknown) {
  setActivePinia(createPinia())
  useAuthStore().setSession('tok', {
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
  let actions!: ReturnType<typeof useTeacherActions>
  const app = createApp({
    setup() {
      actions = useTeacherActions(reload, onDeleted)
      return () => null
    },
  })
  app.use(createI18n({ legacy: false, locale: 'uz', messages: { uz } }))
  app.mount(document.createElement('div'))
  return { actions, reload }
}

describe('useTeacherActions.removeForever', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tarixsiz: tasdiq matni, DELETE, toast va reload', async () => {
    const { actions, reload } = setup(['teachers.manage'])
    vi.mocked(teachersApi.usage).mockResolvedValue({ deletable: true, counts: noCounts })
    vi.mocked(teachersApi.remove).mockResolvedValue({ deleted: true })
    h.confirm.mockResolvedValue(true)
    await actions.removeForever(tc())
    expect(h.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Karimov Karim butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi. Sinf va fan biriktirishlari ham olib tashlanadi.",
        confirmText: "Butunlay o'chirish",
        variant: 'danger',
      }),
    )
    expect(teachersApi.remove).toHaveBeenCalledWith('t1')
    expect(h.success).toHaveBeenCalledWith("O'qituvchi o'chirildi")
    expect(reload).toHaveBeenCalled()
  })

  it('onDeleted berilsa reload o`rniga u chaqiriladi (batafsil sahifa)', async () => {
    const onDeleted = vi.fn()
    const { actions, reload } = setup(['teachers.manage'], vi.fn(), onDeleted)
    vi.mocked(teachersApi.usage).mockResolvedValue({ deletable: true, counts: noCounts })
    vi.mocked(teachersApi.remove).mockResolvedValue({ deleted: true })
    h.confirm.mockResolvedValue(true)
    await actions.removeForever(tc())
    expect(onDeleted).toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('bekor qilinsa DELETE yuborilmaydi', async () => {
    const { actions } = setup(['teachers.manage'])
    vi.mocked(teachersApi.usage).mockResolvedValue({ deletable: true, counts: noCounts })
    h.confirm.mockResolvedValue(false)
    await actions.removeForever(tc())
    expect(teachersApi.remove).not.toHaveBeenCalled()
  })

  it('tarixi bor: hisoblar ko`rsatiladi, "Nofaol qilish" update(isActive:false) ni chaqiradi', async () => {
    const { actions, reload } = setup(['teachers.manage'])
    vi.mocked(teachersApi.usage).mockResolvedValue({
      deletable: false,
      counts: { ...noCounts, scores: 12, attendance: 30, timetableEntries: 5 },
    })
    vi.mocked(teachersApi.update).mockResolvedValue(tc(false))
    h.confirm.mockResolvedValue(true)
    await actions.removeForever(tc())
    const opts = h.confirm.mock.calls[0]![0]
    expect(opts.message).toContain('12 ta baho, 30 ta davomat, 5 ta jadval darsi')
    expect(opts.confirmText).toBe('Nofaol qilish')
    expect(teachersApi.remove).not.toHaveBeenCalled()
    expect(teachersApi.update).toHaveBeenCalledWith('t1', { isActive: false })
    expect(h.success).toHaveBeenCalledWith("O'qituvchi nofaol qilindi")
    expect(reload).toHaveBeenCalled()
  })

  it('tarixi bor, "Yopish" bosilsa hech narsa o`zgarmaydi', async () => {
    const { actions } = setup(['teachers.manage'])
    vi.mocked(teachersApi.usage).mockResolvedValue({
      deletable: false,
      counts: { ...noCounts, scores: 1 },
    })
    h.confirm.mockResolvedValue(false)
    await actions.removeForever(tc())
    expect(teachersApi.update).not.toHaveBeenCalled()
  })

  it('allaqachon nofaol bo`lsa "Nofaol qilish" taklif qilinmaydi', async () => {
    const { actions } = setup(['teachers.manage'])
    vi.mocked(teachersApi.usage).mockResolvedValue({
      deletable: false,
      counts: { ...noCounts, scores: 1 },
    })
    h.confirm.mockResolvedValue(true)
    await actions.removeForever(tc(false))
    expect(h.confirm.mock.calls[0]![0].confirmText).toBe('Yopish')
    expect(teachersApi.update).not.toHaveBeenCalled()
  })

  it('ruxsatsiz foydalanuvchi: canDelete=false va hech narsa chaqirilmaydi', async () => {
    const { actions } = setup(['dashboard.view'])
    expect(actions.canDelete).toBe(false)
    await actions.removeForever(tc())
    expect(teachersApi.usage).not.toHaveBeenCalled()
  })

  it('usage xatosi toast bilan ko`rsatiladi', async () => {
    const { actions } = setup(['teachers.manage'])
    vi.mocked(teachersApi.usage).mockRejectedValue(new Error('boom'))
    await actions.removeForever(tc())
    expect(h.error).toHaveBeenCalled()
    expect(h.confirm).not.toHaveBeenCalled()
  })
})
