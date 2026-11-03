import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { ApiError } from '@/api/errors'
import type { Superadmin, User } from '@/api/types'
import { NAV_ITEMS } from '@/constants/navigation'
import { useAuthStore } from '@/stores/auth'
import SuperadminsView from './SuperadminsView.vue'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transferOwnership: vi.fn(),
}))
vi.mock('@/api/superadmins.api', () => ({ superadminsApi: api }))
const authApi = vi.hoisted(() => ({ me: vi.fn() }))
vi.mock('@/api/auth.api', () => ({ authApi }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const row = (o: Partial<Superadmin>): Superadmin => ({
  id: 'x',
  fullName: 'Ism',
  username: 'login',
  isActive: true,
  isOwner: false,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...o,
})
const OWNER = row({ id: 'o1', fullName: 'Asosiy Admin', username: 'boss', isOwner: true })
const SECOND = row({ id: 's2', fullName: 'Ikkinchi Admin', username: 'second' })
const SLEEPING = row({ id: 's3', fullName: 'Uxlayotgan', username: 'sleep', isActive: false })

/** vee-validate tekshiruvni qisqa kechikish (debounce) bilan bajaradi: haqiqiy vaqt ham kutiladi */
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await new Promise((r) => setTimeout(r, 15))
  }
}

const mounted: { unmount: () => void }[] = []

async function mountView(me: { id: string; isOwner: boolean }) {
  api.list.mockResolvedValue([OWNER, SECOND, SLEEPING])
  useAuthStore().user = { id: me.id, role: 'superadmin', isOwner: me.isOwner } as unknown as User
  const w = mount(SuperadminsView, { global: { plugins: [i18n] }, attachTo: document.body })
  await flushPromises()
  mounted.push(w)
  return w
}
const body = (id: string) => document.body.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)
const fill = async (id: string, value: string) => {
  const el = body(id)!
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
}
const click = async (el: Element | null) => {
  ;(el as HTMLElement).click()
  await flushPromises()
}
const submitForm = async (formId: string) => {
  document.body
    .querySelector<HTMLFormElement>(`#${formId}`)!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
})

describe('Superadminlar sahifasi', () => {
  it('navigatsiya: faqat superadmin uchun, "Tizim" guruhining oxirgi bandi', () => {
    const item = NAV_ITEMS.find((i) => i.name === 'superadmins')!
    expect(item.roles).toEqual(['superadmin'])
    expect(item.group).toBe('system')
    expect(NAV_ITEMS.at(-1)!.name).toBe('superadmins')
  })

  it('oddiy superadmin: faqat o`qiydi, eslatma bor, amallar va qo`shish tugmasi yo`q', async () => {
    const w = await mountView({ id: 's2', isOwner: false })
    expect(w.find('[data-testid="readonly-note"]').text()).toContain(uz.superadmins.readOnlyNote)
    expect(w.find('[data-testid="superadmin-add"]').exists()).toBe(false)
    expect(w.find('[data-testid="act-toggle"]').exists()).toBe(false)
    expect(w.text()).toContain('Asosiy Admin')
    expect(w.find('[data-testid="badge-owner"]').text()).toContain('Asosiy')
    expect(w.find('[data-testid="badge-inactive"]').text()).toContain('Nofaol')
  })

  it('asosiy superadmin: qo`shish tugmasi va amallar bor (asosiy qatordan tashqari)', async () => {
    const w = await mountView({ id: 'o1', isOwner: true })
    expect(w.find('[data-testid="readonly-note"]').exists()).toBe(false)
    expect(w.find('[data-testid="superadmin-add"]').exists()).toBe(true)
    // 2 ta qator (Ikkinchi, Uxlayotgan): faqat faolga "topshirish" tugmasi
    expect(w.findAll('[data-testid="act-toggle"]')).toHaveLength(2)
    expect(w.findAll('[data-testid="act-reset"]')).toHaveLength(2)
    expect(w.findAll('[data-testid="act-transfer"]')).toHaveLength(1)
  })

  it('qo`shish modali currentPassword bilan yuboradi', async () => {
    api.create.mockResolvedValue(row({ id: 'n' }))
    const w = await mountView({ id: 'o1', isOwner: true })
    await w.get('[data-testid="superadmin-add"]').trigger('click')
    await flushPromises()
    await fill('create-fullName', 'Yangi Admin')
    await fill('create-username', 'NewSA')
    await fill('create-password', 'Newpass123')

    // joriy parolsiz yuborilmaydi
    await submitForm('superadmin-create-form')
    expect(api.create).not.toHaveBeenCalled()

    await fill('create-currentPassword', 'Owner1234')
    await submitForm('superadmin-create-form')
    expect(api.create).toHaveBeenCalledWith({
      fullName: 'Yangi Admin',
      username: 'newsa',
      password: 'Newpass123',
      currentPassword: 'Owner1234',
    })
    expect(toast.success).toHaveBeenCalled()
    expect(api.list).toHaveBeenCalledTimes(2)
  })

  it('serverdagi currentPassword xatosi modalda ko`rinadi, modal yopilmaydi', async () => {
    api.create.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'Joriy parol noto`g`ri', 400, [
        { path: 'currentPassword', message: 'Joriy parol noto`g`ri' },
      ]),
    )
    const w = await mountView({ id: 'o1', isOwner: true })
    await w.get('[data-testid="superadmin-add"]').trigger('click')
    await flushPromises()
    await fill('create-fullName', 'Yangi Admin')
    await fill('create-username', 'newsa')
    await fill('create-password', 'Newpass123')
    await fill('create-currentPassword', 'Wrong1234')
    await submitForm('superadmin-create-form')
    expect(document.body.textContent).toContain('Joriy parol noto`g`ri')
    expect(body('create-submit')).not.toBeNull()
  })

  it('nofaol qilish va faollashtirish: currentPassword bilan update', async () => {
    api.update.mockResolvedValue(SECOND)
    const w = await mountView({ id: 'o1', isOwner: true })
    await click(w.findAll('[data-testid="act-toggle"]')[0]!.element)
    expect(document.body.textContent).toContain(uz.superadmins.deactivateTitle)
    await fill('action-currentPassword', 'Owner1234')
    await submitForm('superadmin-action-form')
    expect(api.update).toHaveBeenCalledWith('s2', { isActive: false, currentPassword: 'Owner1234' })

    await click(w.findAll('[data-testid="act-toggle"]')[1]!.element)
    expect(document.body.textContent).toContain(uz.superadmins.activateTitle)
    await fill('action-currentPassword', 'Owner1234')
    await submitForm('superadmin-action-form')
    expect(api.update).toHaveBeenLastCalledWith('s3', {
      isActive: true,
      currentPassword: 'Owner1234',
    })
  })

  it('parolni tiklash: yangi parol + tasdiq + joriy parol', async () => {
    api.update.mockResolvedValue(SECOND)
    const w = await mountView({ id: 'o1', isOwner: true })
    await click(w.findAll('[data-testid="act-reset"]')[0]!.element)
    await fill('action-newPassword', 'Reset12345')
    await fill('action-confirmPassword', 'Mismatch123')
    await fill('action-currentPassword', 'Owner1234')
    await submitForm('superadmin-action-form')
    expect(api.update).not.toHaveBeenCalled()

    await fill('action-confirmPassword', 'Reset12345')
    await submitForm('superadmin-action-form')
    expect(api.update).toHaveBeenCalledWith('s2', {
      password: 'Reset12345',
      currentPassword: 'Owner1234',
    })
  })

  it('asosiylikni topshirish: kuchli ogohlantirish, tasdiqdan keyin transfer va profil yangilanadi', async () => {
    api.transferOwnership.mockResolvedValue([])
    authApi.me.mockResolvedValue({ id: 'o1', role: 'superadmin', isOwner: false })
    const w = await mountView({ id: 'o1', isOwner: true })
    await click(w.get('[data-testid="act-transfer"]').element)
    const warning = body('action-warning')!
    expect(warning.textContent).toContain('Ikkinchi Admin')
    expect(warning.textContent).toContain("yo'qotasiz")

    // joriy parolsiz yuborilmaydi
    await submitForm('superadmin-action-form')
    expect(api.transferOwnership).not.toHaveBeenCalled()

    await fill('action-currentPassword', 'Owner1234')
    await submitForm('superadmin-action-form')
    expect(api.transferOwnership).toHaveBeenCalledWith('s2', 'Owner1234')
    expect(useAuthStore().isOwner).toBe(false)
    expect(w.find('[data-testid="readonly-note"]').exists()).toBe(true)
  })
})
