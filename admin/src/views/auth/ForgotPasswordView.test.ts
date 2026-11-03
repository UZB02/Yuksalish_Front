import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ForgotPasswordView from './ForgotPasswordView.vue'
import { ApiError } from '@/api/errors'
import { authApi } from '@/api/auth.api'
import { i18n } from '@/i18n'
import { resolveAccess } from '@/router/guards'
import appRouter from '@/router'
import { useToast } from '@/composables/useToast'

vi.mock('@/api/auth.api', () => ({
  authApi: {
    passwordResetInfo: vi.fn(),
    passwordResetRequest: vi.fn(),
    passwordResetVerify: vi.fn(),
    passwordResetComplete: vi.fn(),
  },
}))

const api = vi.mocked(authApi)

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView },
    ],
  })
  await router.push('/forgot-password')
  await router.isReady()
  const w = mount(ForgotPasswordView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { w, router }
}

/** vee-validate tekshiruvi asinxron (zod): real taymerda biroz kutamiz */
const settle = async () => {
  await new Promise((r) => setTimeout(r, 50))
  await flushPromises()
}

const type = async (w: ReturnType<typeof mount>, testid: string, value: string) => {
  await w.get(`[data-testid="${testid}"]`).setValue(value)
}

async function toStep2() {
  const ctx = await mountView()
  await type(ctx.w, 'forgot-username', 'Teacher1')
  await ctx.w.get('form').trigger('submit')
  await flushPromises()
  return ctx
}

beforeEach(() => {
  vi.clearAllMocks()
  api.passwordResetInfo.mockResolvedValue({ available: true, botUsername: 'yuksalish_bot' })
  api.passwordResetRequest.mockResolvedValue(undefined)
  api.passwordResetVerify.mockResolvedValue('tok-123')
  api.passwordResetComplete.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('ForgotPasswordView', () => {
  it('1-qadam: bo`sh login xato beradi, so`rov yuborilmaydi', async () => {
    const { w } = await mountView()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.passwordResetRequest).not.toHaveBeenCalled()
    expect(w.text()).toContain("Bu maydon to'ldirilishi shart")
  })

  it('1-qadam: login normallashtirib yuboriladi, umumiy xabar va bot havolasi ko`rinadi', async () => {
    const { w } = await toStep2()
    expect(api.passwordResetRequest).toHaveBeenCalledWith('teacher1')
    expect(w.get('[data-testid="forgot-sent-info"]').text()).toContain(
      "Agar hisobingiz Telegram botga ulangan bo'lsa, tasdiqlash kodi yuborildi",
    )
    const link = w.get('[data-testid="forgot-bot-link"]')
    expect(link.text()).toBe('@yuksalish_bot')
    expect(link.attributes('href')).toBe('https://t.me/yuksalish_bot')
    expect(w.get('[data-step="2"]').attributes('aria-current')).toBe('step')
  })

  it('bot mavjud bo`lmasa havola ko`rsatilmaydi, xabar baribir umumiy', async () => {
    api.passwordResetInfo.mockResolvedValue({ available: false, botUsername: null })
    const { w } = await toStep2()
    expect(w.find('[data-testid="forgot-bot-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="forgot-sent-info"]').exists()).toBe(true)
  })

  it('kod inputi faqat raqam qabul qiladi va numeric/one-time-code atributlariga ega', async () => {
    const { w } = await toStep2()
    const input = w.get('[data-testid="forgot-code"]')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('autocomplete')).toBe('one-time-code')
    await input.setValue('12a3-45678')
    expect((input.element as HTMLInputElement).value).toBe('123456')
  })

  it('kod 6 xonali bo`lmasa so`rov yuborilmaydi; noto`g`ri kod xatosi inline ko`rinadi', async () => {
    const { w } = await toStep2()
    await type(w, 'forgot-code', '123')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.passwordResetVerify).not.toHaveBeenCalled()
    expect(w.text()).toContain('6 xonali kodni kiriting')

    api.passwordResetVerify.mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', "Kod noto'g'ri yoki muddati o'tgan", 400),
    )
    await type(w, 'forgot-code', '123456')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain("Kod noto'g'ri yoki muddati o'tgan")
    expect(w.find('[data-step="2"]').attributes('aria-current')).toBe('step')
  })

  it('qayta yuborish: 60 soniyalik hisoblagich, tugagach tugma faollashadi', async () => {
    vi.useFakeTimers()
    const { w } = await toStep2()
    const btn = w.get('[data-testid="forgot-resend"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain('60')

    await vi.advanceTimersByTimeAsync(30_000)
    expect(w.get('[data-testid="forgot-resend"]').text()).toContain('30')

    await vi.advanceTimersByTimeAsync(30_000)
    const ready = w.get('[data-testid="forgot-resend"]')
    expect(ready.attributes('disabled')).toBeUndefined()
    expect(ready.text()).toBe('Kodni qayta yuborish')

    await ready.trigger('click')
    await flushPromises()
    expect(api.passwordResetRequest).toHaveBeenCalledTimes(2)
    expect(w.get('[data-testid="forgot-resend"]').attributes('disabled')).toBeDefined()
  })

  it('Orqaga: 1-qadamga qaytaradi', async () => {
    const { w } = await toStep2()
    const back = w.findAll('button').find((b) => b.text() === 'Orqaga')!
    await back.trigger('click')
    expect(w.find('[data-testid="forgot-username"]').exists()).toBe(true)
  })

  it('3-qadam: parollar mos kelmasa xato, so`rov yuborilmaydi', async () => {
    const { w } = await toStep2()
    await type(w, 'forgot-code', '123456')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.passwordResetVerify).toHaveBeenCalledWith('teacher1', '123456')

    await type(w, 'forgot-password', 'NewPassw0rd')
    await type(w, 'forgot-confirm', 'Different1')
    await w.get('form').trigger('submit')
    await settle()
    expect(api.passwordResetComplete).not.toHaveBeenCalled()
    expect(w.text()).toContain('Parollar mos kelmadi')
  })

  it('muvaffaqiyat: parol yuboriladi, toast chiqadi va loginga o`tadi', async () => {
    const { w, router } = await toStep2()
    await type(w, 'forgot-code', '123456')
    await w.get('form').trigger('submit')
    await flushPromises()

    await type(w, 'forgot-password', 'NewPassw0rd')
    await type(w, 'forgot-confirm', 'NewPassw0rd')
    await w.get('form').trigger('submit')
    await settle()

    expect(api.passwordResetComplete).toHaveBeenCalledWith('tok-123', 'NewPassw0rd')
    expect(router.currentRoute.value.name).toBe('login')
    expect(useToast().toasts.map((x) => x.message)).toContain(
      'Parol yangilandi, yangi parol bilan kiring',
    )
  })

  it('token muddati tugagan bo`lsa 1-qadamga qaytadi', async () => {
    api.passwordResetComplete.mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', 'Sessiya', 400, [{ path: 'resetToken', message: 'x' }]),
    )
    const { w } = await toStep2()
    await type(w, 'forgot-code', '123456')
    await w.get('form').trigger('submit')
    await flushPromises()
    await type(w, 'forgot-password', 'NewPassw0rd')
    await type(w, 'forgot-confirm', 'NewPassw0rd')
    await w.get('form').trigger('submit')
    await settle()
    expect(w.find('[data-testid="forgot-username"]').exists()).toBe(true)
    expect(w.get('[data-testid="forgot-error"]').text()).toContain('Tiklash sessiyasi')
  })

  it('so`rov xatosi (429) serverning xabari bilan ko`rsatiladi', async () => {
    api.passwordResetRequest.mockRejectedValueOnce(
      new ApiError('RATE_LIMITED', "Urinishlar juda ko'p. Keyinroq urinib ko'ring", 429),
    )
    const { w } = await mountView()
    await type(w, 'forgot-username', 'abc')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="forgot-error"]').text()).toContain('Urinishlar juda ko')
    expect(w.find('[data-testid="forgot-username"]').exists()).toBe(true)
  })
})

describe('/forgot-password marshruti', () => {
  const meta = appRouter.getRoutes().find((r) => r.name === 'forgot-password')!.meta
  const ctx = (isAuthenticated: boolean) => ({
    isAuthenticated,
    hasRole: () => true,
    hasPermission: () => true,
  })

  it('mehmonga ochiq', () => {
    expect(
      resolveAccess({ name: 'forgot-password', fullPath: '/forgot-password', meta }, ctx(false)),
    ).toBe(true)
  })
  it('kirgan foydalanuvchi bosh sahifaga yo`naltiriladi', () => {
    expect(
      resolveAccess({ name: 'forgot-password', fullPath: '/forgot-password', meta }, ctx(true)),
    ).toEqual({
      name: 'home',
    })
  })
})
