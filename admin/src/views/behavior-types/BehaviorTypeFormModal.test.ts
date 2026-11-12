import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { BehaviorType } from '@/api/types'
import { behaviorTypesApi } from '@/api/behaviorTypes.api'
import { __resetBodyLock } from '@/composables/useBodyLock'
import BehaviorTypeFormModal from './BehaviorTypeFormModal.vue'

vi.mock('@/api/behaviorTypes.api', () => ({
  behaviorTypesApi: { create: vi.fn(), update: vi.fn() },
}))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const item: BehaviorType = {
  id: 'b1',
  schoolId: null,
  name: 'Darsni buzdi',
  kind: 'negative',
  color: '#dc2626',
  order: 2,
  minScore: null,
  maxScore: null,
  defaultScore: null,
  ratingPenalty: 2.5,
  isActive: true,
  createdAt: '',
}

const mountModal = (it: BehaviorType | null) =>
  mount(BehaviorTypeFormModal, {
    props: { open: true, item: it, schools: [] },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
const field = () => document.body.querySelector<HTMLInputElement>('[data-testid="rating-penalty"]')!
const submit = async () => {
  document.body.querySelector<HTMLFormElement>('#behavior-form')!.dispatchEvent(new Event('submit'))
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
}
const setPenalty = async (v: string) => {
  const el = field()
  el.value = v
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(behaviorTypesApi.create).mockResolvedValue(item)
  vi.mocked(behaviorTypesApi.update).mockResolvedValue(item)
})
afterEach(() => {
  document.body.innerHTML = ''
  __resetBodyLock()
  vi.clearAllMocks()
})

describe('BehaviorTypeFormModal: reyting jarimasi', () => {
  it("maydon va izoh ko'rinadi; yangi turda bo'sh, tahrirda mavjud qiymat", async () => {
    const w = mountModal(null)
    await flushPromises()
    expect(field()).toBeTruthy()
    expect(field().value).toBe('')
    expect(document.body.textContent).toContain(
      'Bu tur tanlangan har bir kun uchun reytingdan shuncha ball ayiriladi',
    )
    expect(document.body.textContent).toContain('Bir kunda bir xil tur bir marta hisoblanadi.')
    w.unmount()
    document.body.innerHTML = ''
    const w2 = mountModal(item)
    await flushPromises()
    expect(field().value).toBe('2.5')
    w2.unmount()
  })

  it("jarima bo'sh bo'lsa 0, kiritilsa son (vergul nuqtaga) sifatida yuboriladi", async () => {
    const w = mountModal(item)
    await flushPromises()
    await setPenalty('')
    await submit()
    expect(vi.mocked(behaviorTypesApi.update).mock.calls[0]![1]).toMatchObject({ ratingPenalty: 0 })
    await setPenalty('7,25')
    await submit()
    expect(vi.mocked(behaviorTypesApi.update).mock.calls[1]![1]).toMatchObject({
      ratingPenalty: 7.25,
    })
    w.unmount()
  })

  it("noto'g'ri qiymat (100 dan katta, manfiy, 3 xonali) yuborilmaydi", async () => {
    const w = mountModal(item)
    await flushPromises()
    for (const bad of ['101', '-1', '1.234', 'abc']) {
      await setPenalty(bad)
      await submit()
      expect(behaviorTypesApi.update).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('Jarima 0 dan 100 gacha')
    }
    w.unmount()
  })
})
