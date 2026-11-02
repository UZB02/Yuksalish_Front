import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { h } from 'vue'
import uz from '@/locales/uz.json'
import { settingsApi } from '@/api/settings.api'
import type { PublicSettings, RatingSettings } from '@/api/types'
import { useConfirm } from '@/composables/useConfirm'
import { isAnythingDirty } from '@/composables/useDirtyRegistry'
import { useSchoolContextStore } from '@/stores/school-context'
import { DEFAULT_PUBLIC, GLOBAL_ONLY_KEYS, PUBLIC_KEYS } from '@/utils/publicForm'
import { DEFAULT_RATING, RATING_KEYS } from '@/utils/ratingForm'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

vi.mock('@/api/settings.api', () => ({ settingsApi: { get: vi.fn(), save: vi.fn() } }))

enableAutoUnmount(afterEach)

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

const toSchool = async (w: ReturnType<typeof mount>) => {
  await w.get('[data-testid="scope-school"]').trigger('click')
  await flushPromises()
}
const saveBtn = (w: ReturnType<typeof mount>) => w.get('[data-testid="settings-save"]')

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

  it("globalRatingEnabled bloki faqat umumiy qamrovda ko'rinadi", async () => {
    const w = mountPublic()
    await flushPromises()
    expect(w.findAll('[data-testid="global-only"]')).toHaveLength(1)
    expect(w.findAll('[data-testid="school-extra"]')).toHaveLength(0)
    await toSchool(w)
    expect(w.findAll('[data-testid="global-only"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="school-extra"]')).toHaveLength(1)
  })

  it('maktab override: faqat belgilangan maydon yuboriladi, global-only kalit hech qachon', async () => {
    const w = mountPublic()
    await flushPromises()
    await toSchool(w)
    await w.find('[data-testid="flag-school-title"]').trigger('click')
    await w.find('[data-testid="set-school-title"]').trigger('click')
    // global-only kalitga belgi qo'yishga urinish ham override ga tushmasligi kerak
    await w.find('[data-testid="flag-school-globalRatingEnabled"]').trigger('click')
    await saveBtn(w).trigger('click')
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
    await saveBtn(w).trigger('click')
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
    await toSchool(w)
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
    await toSchool(w)
    // yangi qiymat o'rnatiladi - override saqlanadi
    await w.find('[data-testid="set-school-minScoresCount"]').trigger('click')
    await saveBtn(w).trigger('click')
    await confirmYes()
    expect(settingsApi.save).toHaveBeenCalledWith('rating', {
      scope: 'school',
      schoolId: 's1',
      values: { minScoresCount: 7 },
    })
  })
})

describe("SettingsScopeEditor: saqlash paneli va saqlanmagan o'zgarishlar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStore()
    vi.mocked(settingsApi.get).mockImplementation(async () => ({
      effective: DEFAULT_PUBLIC,
      global: DEFAULT_PUBLIC,
      override: null,
    }))
  })
  const mountIt = () =>
    mount(SettingsScopeEditor, {
      props: {
        kind: 'public',
        keys: PUBLIC_KEYS,
        defaults: DEFAULT_PUBLIC,
        validate: () => ({}),
        format: (k: keyof PublicSettings) => String(k),
        globalOnlyKeys: GLOBAL_ONLY_KEYS,
      } as never,
      slots: slots(['title']),
      global: { plugins: [i18n] },
    })

  it("saqlash paneli faqat o'zgarish bo'lsa ko'rinadi, 'Bekor qilish' uni yopadi", async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="settings-save-bar"]').exists()).toBe(false)
    await w.get('[data-testid="set-global-title"]').trigger('click')
    expect(w.get('[data-testid="settings-save-bar"]').text()).toContain(
      "Saqlanmagan o'zgarishlar bor",
    )
    expect(isAnythingDirty()).toBe(true)
    await w.get('[data-testid="settings-discard"]').trigger('click')
    expect(w.find('[data-testid="settings-save-bar"]').exists()).toBe(false)
    expect(isAnythingDirty()).toBe(false)
    expect(settingsApi.save).not.toHaveBeenCalled()
  })

  it("o'zgarish bor paytda qamrovni almashtirish tasdiq so'raydi (rad etilsa joyida qoladi)", async () => {
    const w = mountIt()
    await flushPromises()
    await w.get('[data-testid="set-global-title"]').trigger('click')
    await w.get('[data-testid="scope-school"]').trigger('click')
    await flushPromises()
    expect(useConfirm().state.open).toBe(true)
    useConfirm().settle(false)
    await flushPromises()
    expect(w.get('[data-testid="scope-global"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-testid="settings-save-bar"]').exists()).toBe(true)

    await w.get('[data-testid="scope-school"]').trigger('click')
    await confirmYes()
    expect(w.get('[data-testid="scope-school"]').attributes('aria-pressed')).toBe('true')
    // global o'zgarish bekor qilindi
    await w.get('[data-testid="scope-global"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="settings-save-bar"]').exists()).toBe(false)
  })

  it("maktab admini (ownSchool): qamrov almashtirgich yo'q, maktab belgisi bor", async () => {
    const w = mount(SettingsScopeEditor, {
      props: {
        kind: 'public',
        keys: PUBLIC_KEYS,
        defaults: DEFAULT_PUBLIC,
        validate: () => ({}),
        format: (k: keyof PublicSettings) => String(k),
        ownSchool: true,
      } as never,
      slots: slots(['title']),
      global: { plugins: [i18n] },
    })
    await flushPromises()
    expect(w.find('[data-testid="scope-global"]').exists()).toBe(false)
    expect(w.get('[data-testid="own-school-badge"]').text()).toContain('Maktab:')
    expect(settingsApi.get).toHaveBeenCalledWith('public', undefined)
  })
})
