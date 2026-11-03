import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type { User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import PersonalInfoCard from './PersonalInfoCard.vue'

const api = vi.hoisted(() => ({
  updateMe: vi.fn(),
  usernameAvailable: vi.fn(),
  setOwnPhoto: vi.fn(),
  removeOwnPhoto: vi.fn(),
}))
vi.mock('@/api/auth.api', () => ({ authApi: api }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const baseUser: User = {
  id: 'u1',
  fullName: 'Ali Valiyev',
  username: 'ali',
  role: 'superadmin',
  schoolId: null,
  permissions: [],
  phone: null,
  isActive: true,
  isOwner: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

/** vee-validate tekshiruvni qisqa kechikish (debounce) bilan bajaradi: haqiqiy vaqt ham kutiladi */
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await new Promise((r) => setTimeout(r, 15))
  }
}

const mounted: { unmount: () => void }[] = []

async function mountCard(user: Partial<User> = {}) {
  useAuthStore().user = { ...baseUser, ...user }
  const w = mount(PersonalInfoCard, { global: { plugins: [i18n] }, attachTo: document.body })
  await flushPromises()
  mounted.push(w)
  return w
}
type W = Awaited<ReturnType<typeof mountCard>>
const q = (w: W, id: string) => w.find(`[data-testid="${id}"]`)
const setVal = async (w: W, id: string, value: string) => {
  await q(w, id).setValue(value)
  await settle()
}
const startEdit = async (w: W) => {
  await q(w, 'profile-edit').trigger('click')
  await flushPromises()
}
const submit = async (w: W) => {
  await q(w, 'profile-form').trigger('submit')
  // vee-validate asinxron tekshiradi: bir necha mikro-vazifa kutiladi
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.useRealTimers()
  mounted.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
})

describe('PersonalInfoCard: tahrirlash', () => {
  it("ko'rish rejimida ma'lumotlar va asosiy superadmin belgisi, forma yo'q", async () => {
    const w = await mountCard()
    expect(w.text()).toContain('Ali Valiyev')
    expect(w.text()).toContain('ali')
    expect(q(w, 'owner-badge').exists()).toBe(true)
    expect(q(w, 'profile-form').exists()).toBe(false)
  })

  it('oddiy superadmin va o`qituvchida "Asosiy superadmin" belgisi yo`q', async () => {
    const w = await mountCard({ isOwner: false })
    expect(q(w, 'owner-badge').exists()).toBe(false)
    const t = await mountCard({ role: 'teacher', isOwner: false })
    expect(t.find('[data-testid="owner-badge"]').exists()).toBe(false)
  })

  it('F.I.Sh. va telefonni parolsiz saqlaydi va store ni yangilaydi', async () => {
    const updated = { ...baseUser, fullName: 'Yangi Ism', phone: '+998901234567' }
    api.updateMe.mockResolvedValue(updated)
    const w = await mountCard()
    await startEdit(w)
    expect(q(w, 'profile-currentPassword').exists()).toBe(false)
    await setVal(w, 'profile-fullName', 'Yangi Ism')
    await setVal(w, 'profile-phone', '+998901234567')
    await submit(w)

    expect(api.updateMe).toHaveBeenCalledWith({
      fullName: 'Yangi Ism',
      phone: '+998901234567',
    })
    expect(useAuthStore().user?.fullName).toBe('Yangi Ism')
    expect(toast.success).toHaveBeenCalled()
    expect(q(w, 'profile-form').exists()).toBe(false)
  })

  it("telefonni bo'shatish null yuboradi; o'zgarish bo'lmasa so'rov yo'q", async () => {
    api.updateMe.mockResolvedValue({ ...baseUser, phone: null })
    const w = await mountCard({ phone: '+998901234567' })
    await startEdit(w)
    await submit(w)
    expect(api.updateMe).not.toHaveBeenCalled()

    await startEdit(w)
    await setVal(w, 'profile-phone', '')
    await submit(w)
    expect(api.updateMe).toHaveBeenCalledWith({ phone: null })
  })

  it('joriy parol maydoni faqat login o`zgarganda chiqadi va majburiy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.usernameAvailable.mockResolvedValue({ username: 'newname', available: true })
    const w = await mountCard()
    await startEdit(w)
    expect(q(w, 'profile-currentPassword').exists()).toBe(false)

    await setVal(w, 'profile-username', 'newname')
    expect(q(w, 'profile-currentPassword').exists()).toBe(true)
    await submit(w)
    expect(api.updateMe).not.toHaveBeenCalled()
    expect(w.text()).toContain(uz.profile.currentPasswordRequired)

    // asl loginga qaytsa maydon yo'qoladi
    await setVal(w, 'profile-username', 'ali')
    expect(q(w, 'profile-currentPassword').exists()).toBe(false)
  })

  it('login o`zgarishi currentPassword bilan yuboriladi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.usernameAvailable.mockResolvedValue({ username: 'newname', available: true })
    api.updateMe.mockResolvedValue({ ...baseUser, username: 'newname' })
    const w = await mountCard()
    await startEdit(w)
    await setVal(w, 'profile-username', 'NewName')
    await setVal(w, 'profile-currentPassword', 'Secret123')
    await submit(w)
    expect(api.updateMe).toHaveBeenCalledWith({ username: 'newname', currentPassword: 'Secret123' })
    expect(useAuthStore().user?.username).toBe('newname')
  })

  it('bandlik tekshiruvi: debounce, "bo`sh" / "band" xabari, band bo`lsa saqlanmaydi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.usernameAvailable.mockImplementation(async (u: string) => ({
      username: u,
      available: u !== 'taken1',
    }))
    const w = await mountCard()
    await startEdit(w)
    expect(w.text()).toContain(uz.profile.usernameHint)

    await setVal(w, 'profile-username', 'fre')
    await setVal(w, 'profile-username', 'free1')
    expect(api.usernameAvailable).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(api.usernameAvailable).toHaveBeenCalledTimes(1)
    expect(api.usernameAvailable).toHaveBeenCalledWith('free1')
    expect(w.text()).toContain(uz.profile.usernameAvailable)

    await setVal(w, 'profile-username', 'taken1')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(w.text()).toContain(uz.profile.usernameTaken)
    await setVal(w, 'profile-currentPassword', 'Secret123')
    await submit(w)
    expect(api.updateMe).not.toHaveBeenCalled()
  })

  it("noto'g'ri formatdagi yoki o'zining logini uchun tekshiruv yuborilmaydi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const w = await mountCard()
    await startEdit(w)
    await setVal(w, 'profile-username', 'a b')
    await setVal(w, 'profile-username', 'ALI')
    await vi.advanceTimersByTimeAsync(600)
    expect(api.usernameAvailable).not.toHaveBeenCalled()
  })

  it('serverdagi currentPassword xatosi maydonga yoziladi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.usernameAvailable.mockResolvedValue({ username: 'newname', available: true })
    api.updateMe.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'Joriy parol xato', 400, [
        { path: 'currentPassword', message: 'Joriy parol xato' },
      ]),
    )
    const w = await mountCard()
    await startEdit(w)
    await setVal(w, 'profile-username', 'newname')
    await setVal(w, 'profile-currentPassword', 'Wrong1234')
    await submit(w)
    expect(w.text()).toContain('Joriy parol xato')
    expect(useAuthStore().user?.username).toBe('ali')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('bekor qilish formani yopadi, store o`zgarmaydi', async () => {
    const w = await mountCard()
    await startEdit(w)
    await setVal(w, 'profile-fullName', 'Boshqa Ism')
    await q(w, 'profile-cancel').trigger('click')
    expect(q(w, 'profile-form').exists()).toBe(false)
    expect(useAuthStore().user?.fullName).toBe('Ali Valiyev')
  })
})
