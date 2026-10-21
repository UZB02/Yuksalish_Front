import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { h } from 'vue'
import uz from '@/locales/uz.json'
import { settingsApi } from '@/api/settings.api'
import type { PublicSettings, RatingSettings } from '@/api/types'
import { useConfirm } from '@/composables/useConfirm'
import { useSchoolContextStore } from '@/stores/school-context'
import { DEFAULT_PUBLIC, GLOBAL_ONLY_KEYS, PUBLIC_KEYS } from '@/utils/publicForm'
import { DEFAULT_RATING, RATING_KEYS } from '@/utils/ratingForm'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

vi.mock('@/api/settings.api', () => ({ settingsApi: { get: vi.fn(), save: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

function setupStore() {
  setActivePinia(createPinia())
  const ctx = useSchoolContextStore()
  ctx.schools = [
    {
      id: 's1',
      name: 'Maktab 1',
      slug: 'm1',
      address: null,
      phone: null,
      logoUrl: null,
      isActive: true,
      createdAt: '',
    },
  ]
  ctx.loaded = true
  ctx.schoolId = 's1'
}

/** Slotlar: har bir kalit uchun tugmalar (qiymat o'rnatish / override belgisi) */
const slots = (keys: readonly string[]) => ({
  fields: (p: {
    scope: string
    set: (k: never, v: never) => void
    toggleFlag: (k: never, on: boolean) => void
  }) =>
    keys.map((k) =>
      h('div', { 'data-scope': p.scope }, [
        h('button', {
          'data-testid': `flag-${p.scope}-${k}`,
          onClick: () => p.toggleFlag(k as never, true),
        }),
        h('button', {
          'data-testid': `set-${p.scope}-${k}`,
          onClick: () => p.set(k as never, (k === 'minScoresCount' ? 7 : 'X') as never),
        }),
      ]),
    ),
  'global-extra': () => h('span', { 'data-testid': 'global-only' }, 'umumiy'),
  'school-extra': () => h('span', { 'data-testid': 'school-extra' }, 'maktab'),
})

const confirmYes = async () => {
  await flushPromises()
  useConfirm().settle(true)
  await flushPromises()
}

describe("SettingsScopeEditor: ochiq ko'rinish (public)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStore()
    vi.mocked(settingsApi.get).mockImplementation(async () => ({
      effective: DEFAULT_PUBLIC,
      global: DEFAULT_PUBLIC,
      override: null,
    }))
  })

  const mountPublic = () =>
    mount(SettingsScopeEditor, {
      props: {
        kind: 'public',
        keys: PUBLIC_KEYS,
        defaults: DEFAULT_PUBLIC,
        validate: () => ({}),
        format: (k: keyof PublicSettings) => String(k),
        globalOnlyKeys: GLOBAL_ONLY_KEYS,
      } as never,
      slots: slots(['title', 'globalRatingEnabled']),
      global: { plugins: [i18n] },
    })

  it("globalRatingEnabled bloki faqat global bo'limda ko'rinadi", async () => {
    const w = mountPublic()
    await flushPromises()
    expect(w.findAll('[data-testid="global-only"]')).toHaveLength(1)
    expect(w.findAll('[data-testid="school-extra"]')).toHaveLength(1)
    // global-extra global bo'lim ichida
    const sections = w.findAll('section')
    expect(sections[0]!.find('[data-testid="global-only"]').exists()).toBe(true)
    expect(sections[1]!.find('[data-testid="global-only"]').exists()).toBe(false)
  })

  it('maktab override: faqat belgilangan maydon yuboriladi, global-only kalit hech qachon', async () => {
    const w = mountPublic()
    await flushPromises()
    await w.find('[data-testid="flag-school-title"]').trigger('click')
    await w.find('[data-testid="set-school-title"]').trigger('click')
    // global-only kalitga belgi qo'yishga urinish ham override ga tushmasligi kerak
    await w.find('[data-testid="flag-school-globalRatingEnabled"]').trigger('click')
    const save = w
      .findAll('button')
      .filter((b) => b.text() === 'Saqlash')
      .at(-1)!
    await save.trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('public', {
      scope: 'school',
      schoolId: 's1',
      values: { title: 'X' },
    })
  })

  it("global saqlash to'liq qiymatlarni yuboradi (globalRatingEnabled bilan)", async () => {
    const w = mountPublic()
    await flushPromises()
    await w.find('[data-testid="set-global-title"]').trigger('click')
    const save = w.findAll('button').filter((b) => b.text() === 'Saqlash')[0]!
    await save.trigger('click')
    await confirmYes()
    const call = vi.mocked(settingsApi.save).mock.calls[0]!
    expect(call[1].scope).toBe('global')
    expect(call[1].values).toMatchObject({ title: 'X', globalRatingEnabled: false })
  })
})

describe('SettingsScopeEditor: reyting (override va qaytarish)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStore()
  })

  const mountRating = () =>
    mount(SettingsScopeEditor, {
      props: {
        kind: 'rating',
        keys: RATING_KEYS,
        defaults: DEFAULT_RATING,
        validate: () => ({}),
        format: (k: keyof RatingSettings) => String(k),
      } as never,
      slots: slots(['minScoresCount']),
      global: { plugins: [i18n] },
    })

  it("mavjud override bo'lsa 'Global qiymatga qaytarish' values:null yuboradi", async () => {
    vi.mocked(settingsApi.get).mockImplementation(async (_k, schoolId) => ({
      effective: DEFAULT_RATING,
      global: DEFAULT_RATING,
      override: schoolId ? ({ minScoresCount: 9 } as Partial<RatingSettings>) : null,
    }))
    vi.mocked(settingsApi.save).mockResolvedValue({
      effective: DEFAULT_RATING,
      global: DEFAULT_RATING,
      override: null,
    } as never)
    const w = mountRating()
    await flushPromises()
    expect(w.text()).toContain('alohida qiymatlar belgilangan')
    const reset = w.findAll('button').find((b) => b.text().includes('Global qiymatga qaytarish'))!
    await reset.trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('rating', {
      scope: 'school',
      schoolId: 's1',
      values: null,
    })
  })

  it('override belgisi olib tashlansa (hech biri qolmasa) values:null, qolsa qisman', async () => {
    vi.mocked(settingsApi.get).mockImplementation(async (_k, schoolId) => ({
      effective: DEFAULT_RATING,
      global: DEFAULT_RATING,
      override: schoolId ? ({ minScoresCount: 9 } as Partial<RatingSettings>) : null,
    }))
    vi.mocked(settingsApi.save).mockResolvedValue({} as never)
    const w = mountRating()
    await flushPromises()
    // yangi qiymat o'rnatiladi - override saqlanadi
    await w.find('[data-testid="set-school-minScoresCount"]').trigger('click')
    const save = w
      .findAll('button')
      .filter((b) => b.text() === 'Saqlash')
      .at(-1)!
    await save.trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('rating', {
      scope: 'school',
      schoolId: 's1',
      values: { minScoresCount: 7 },
    })
  })
})
