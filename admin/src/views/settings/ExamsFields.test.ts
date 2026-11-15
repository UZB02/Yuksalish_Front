import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { ExamsSettings } from '@/api/types'
import {
  DEFAULT_EXAMS_FORM,
  EXAMS_KEYS,
  EXAMS_OWN_KEYS,
  validateExamsSettings,
} from '@/utils/examsSettings'
import { visibleSettingsTabs } from '@/utils/settingsTabs'
import { formatSetting } from '@/utils/settingsFormat'
import ExamsFields from './ExamsFields.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const tr = (k: string, p?: Record<string, unknown>) => i18n.global.t(k, p ?? {})

const mountFields = (value: ExamsSettings, extra: Record<string, unknown> = {}) =>
  mount(ExamsFields, {
    props: { modelValue: value, errors: {}, ...extra },
    global: { plugins: [i18n] },
  })

describe('Imtihon sozlamalari (tab maydonlari)', () => {
  it('standart qiymatlar: o`chiq, o`qituvchi nazorat ishi yoqilgan, 365 kun', () => {
    expect(DEFAULT_EXAMS_FORM).toEqual({
      enabled: false,
      teachersCanCreateQuizzes: true,
      candidateRetentionDays: 365,
    })
    expect(EXAMS_KEYS).toEqual(['enabled', 'teachersCanCreateQuizzes', 'candidateRetentionDays'])
  })

  it("superadmin 3 ta maydonni (o'zbekcha yorliq va izoh bilan) ko'radi", () => {
    const w = mountFields(DEFAULT_EXAMS_FORM)
    const rows = w.findAll('[data-testid="setting-row"]')
    expect(rows).toHaveLength(3)
    const text = w.text()
    expect(text).toContain('Imtihon moduli yoqilgan')
    expect(text).toContain("O'qituvchilar nazorat ishi yarata oladi")
    expect(text).toContain("Nomzod ma'lumotlarini saqlash muddati")
    expect(text).toContain("Faqat superadmin o'zgartiradi")
    expect(text).toContain('1 dan 3650 gacha')
  })

  it("maktab admini (ownSchool): 'Imtihon moduli yoqilgan' maydoni yo'q, modul o'chiq bo'lsa izoh bor", () => {
    const w = mountFields(DEFAULT_EXAMS_FORM, { ownSchool: true })
    expect(w.findAll('[data-testid="setting-row"]')).toHaveLength(2)
    expect(w.find('[data-testid="exams-switch-enabled"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Imtihon moduli yoqilgan')
    expect(w.find('[data-testid="exams-disabled-note"]').exists()).toBe(true)
    expect(EXAMS_OWN_KEYS).not.toContain('enabled')
    const on = mountFields({ ...DEFAULT_EXAMS_FORM, enabled: true }, { ownSchool: true })
    expect(on.find('[data-testid="exams-disabled-note"]').exists()).toBe(false)
  })

  it("kalitlar o'zgarishi modelValue sifatida chiqadi", async () => {
    const w = mountFields(DEFAULT_EXAMS_FORM)
    await w.get('[data-testid="exams-switch-enabled"] button').trigger('click')
    expect(w.emitted('update:modelValue')![0]![0]).toMatchObject({ enabled: true })
    await w.get('[data-testid="exams-switch-teachersCanCreateQuizzes"] button').trigger('click')
    expect(w.emitted('update:modelValue')![1]![0]).toMatchObject({
      teachersCanCreateQuizzes: false,
    })
    await w.get('[data-testid="retention-input"]').setValue('90')
    expect(w.emitted('update:modelValue')![2]![0]).toMatchObject({ candidateRetentionDays: 90 })
  })

  it('maktab rejimida "alohida sozlash" belgisi va global qiymat matni', () => {
    const w = mountFields(DEFAULT_EXAMS_FORM, {
      flags: { enabled: false, teachersCanCreateQuizzes: true, candidateRetentionDays: false },
      globalValues: { ...DEFAULT_EXAMS_FORM, candidateRetentionDays: 200 },
    })
    expect(w.findAll('[data-testid="row-badge"]')).toHaveLength(1)
    expect(w.text()).toContain('200')
  })

  it('saqlash muddati validatsiyasi: 1..3650, butun', () => {
    const v = (d: number) =>
      validateExamsSettings({ ...DEFAULT_EXAMS_FORM, candidateRetentionDays: d }, tr)
    for (const bad of [0, -5, 3651, 1.5, NaN]) {
      expect(v(bad).candidateRetentionDays, String(bad)).toContain('3650')
    }
    for (const good of [1, 365, 3650]) expect(v(good)).toEqual({})
  })

  it('formatSetting: yoqilgan/yoqilmagan', () => {
    expect(formatSetting(tr, 'enabled', true)).toBe('Ha')
    expect(formatSetting(tr, 'enabled', false)).toBe("Yo'q")
  })

  it("Sozlamalar tabi: superadmin va exams.manage li maktab admini ko'radi, boshqalar yo'q", () => {
    const has = (perms: string[]) => (p: string) => perms.includes(p)
    expect(visibleSettingsTabs(true, () => true)).toContain('exams')
    expect(visibleSettingsTabs(false, has(['exams.manage']), true)).toContain('exams')
    expect(visibleSettingsTabs(false, has(['attendance.settings']), true)).not.toContain('exams')
    expect(visibleSettingsTabs(false, has(['exams.questions']), false)).not.toContain('exams')
  })
})
