import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { RatingSettings } from '@/api/types'
import { DEFAULT_RATING, RATING_KEYS, validateRating } from '@/utils/ratingForm'
import { previewAnnounce, toClassItem, toStudentItem, winnersTitle } from '@/utils/ratingResults'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import RatingFields from './RatingFields.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const mountFields = (value: RatingSettings, errors = {}) =>
  mount(RatingFields, { props: { modelValue: value, errors }, global: { plugins: [i18n] } })
const t = (k: string) => k

describe("RatingFields: yakuniy natija e'loni", () => {
  it("standart: o'chiq, shanba 18:00; guruh sarlavhasi va izoh ko'rinadi", () => {
    expect(DEFAULT_RATING).toMatchObject({
      resultsEnabled: false,
      resultsWeekday: 6,
      resultsTime: '18:00',
    })
    const w = mountFields({ ...DEFAULT_RATING, periodType: 'week' })
    expect(w.get('[data-testid="results-group"]').text()).toContain(uz.settingsRating.results.group)
    expect(w.text()).toContain(
      'Belgilangan vaqtda davr natijasi muzlatiladi va arxivga saqlanadi. Joriy reyting jonli ishlashda davom etadi.',
    )
    expect(w.get('[data-testid="results-enabled"] button').attributes('aria-checked')).toBe('false')
  })

  it("davr turiga qarab e'lon kuni boshqaruvi o'zgaradi (hafta / oy / chorak, yil, erkin)", async () => {
    const ids = ['results-weekday', 'results-monthday', 'results-date']
    const visible = (w: ReturnType<typeof mountFields>) =>
      ids.filter((id) => w.find(`[data-testid="${id}"]`).exists())
    const base = { ...DEFAULT_RATING, resultsEnabled: true }
    const week = mountFields({ ...base, periodType: 'week' })
    expect(visible(week)).toEqual(['results-weekday'])
    expect((week.get('[data-testid="results-time"]').element as HTMLInputElement).value).toBe(
      '18:00',
    )
    expect(visible(mountFields({ ...base, periodType: 'month' }))).toEqual(['results-monthday'])
    for (const p of ['quarter', 'academic_year', 'custom'] as const) {
      expect(visible(mountFields({ ...base, periodType: p }))).toEqual(['results-date'])
    }
    // Forma ichida davr almashsa maydonlar darhol almashadi
    await week.setProps({ modelValue: { ...base, periodType: 'month' } })
    expect(visible(week)).toEqual(['results-monthday'])
    expect(week.text()).toContain(uz.settingsRating.results.note)
    expect(week.text()).not.toContain('Davrning oxirgi kuni shu vaqtda')
  })

  it("oylik: 'Oyning oxirgi kuni' + 1..31 variantlari; tanlash emit qiladi", () => {
    const w = mountFields({ ...DEFAULT_RATING, periodType: 'month', resultsEnabled: true })
    const sel = w
      .findAllComponents(BaseSelect)
      .find((c) => (c.props('options') as unknown[]).length === 32)!
    const opts = sel.props('options') as { value: string; label: string }[]
    expect(opts[0]).toEqual({ value: '0', label: 'Oyning oxirgi kuni' })
    expect(opts[25]!.label).toBe('Har oyning 25-kuni')
    sel.vm.$emit('update:modelValue', '25')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ resultsMonthDay: 25 })
  })

  it('chorak/yil/erkin: sana maydoni; tanlash va tozalash (null) emit qiladi', async () => {
    for (const p of ['quarter', 'academic_year', 'custom'] as const) {
      const w = mountFields({ ...DEFAULT_RATING, periodType: p, resultsEnabled: true })
      const input = w.get('[data-testid="results-date"]')
      expect((input.element as HTMLInputElement).type).toBe('date')
      expect(w.find('[data-testid="results-date-clear"]').exists()).toBe(false)
      await input.setValue('2026-12-25')
      expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ resultsDate: '2026-12-25' })
    }
    const w = mountFields({
      ...DEFAULT_RATING,
      periodType: 'quarter',
      resultsEnabled: true,
      resultsDate: '2026-12-25',
    })
    await w.get('[data-testid="results-date-clear"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0][0]).toMatchObject({ resultsDate: null })
    await w.get('[data-testid="results-date"]').setValue('')
    expect(w.emitted('update:modelValue')?.[1][0]).toMatchObject({ resultsDate: null })
  })

  it('erkin davr: min/max formadagi customFrom/customTo; tashqarida yumshoq ogohlantirish', () => {
    const base = {
      ...DEFAULT_RATING,
      periodType: 'custom' as const,
      customFrom: '2026-11-01',
      customTo: '2026-11-30',
      resultsEnabled: true,
    }
    const ok = mountFields({ ...base, resultsDate: '2026-11-20' })
    const el = ok.get('[data-testid="results-date"]').element as HTMLInputElement
    expect(el.min).toBe('2026-11-01')
    expect(el.max).toBe('2026-11-30')
    expect(ok.find('[data-testid="results-date-warning"]').exists()).toBe(false)
    expect(ok.get('[data-testid="results-preview"]').text()).toContain('20.11.2026, 18:00')
    const out = mountFields({ ...base, resultsDate: '2026-10-01' })
    expect(out.find('[data-testid="results-date-warning"]').exists()).toBe(true)
    expect(out.get('[data-testid="results-preview"]').text()).toContain('30.11.2026')
    // chorak: min/max yo'q (chegaralar serverda), tanlangan sana preview'da
    const q = mountFields({ ...base, periodType: 'quarter', resultsDate: '2026-12-25' })
    expect((q.get('[data-testid="results-date"]').element as HTMLInputElement).min).toBe('')
    expect(q.get('[data-testid="results-preview"]').text()).toContain('25.12.2026')
  })

  it("preview: oylik uchun e'lon sanasi va vaqti ko'rinadi", () => {
    expect(
      previewAnnounce(
        { ...DEFAULT_RATING, periodType: 'month', resultsMonthDay: 31, resultsTime: '17:30' },
        '2026-11-10',
      ),
    ).toBe('30.11.2026, 17:30')
    expect(
      previewAnnounce({ ...DEFAULT_RATING, periodType: 'week', resultsWeekday: 6 }, '2026-11-11'),
    ).toBe('14.11.2026, 18:00')
    expect(
      previewAnnounce(
        {
          ...DEFAULT_RATING,
          periodType: 'custom',
          customFrom: '2026-11-01',
          customTo: '2026-11-30',
          resultsDate: '2026-11-05',
        },
        '2026-11-10',
      ),
    ).toBe('05.11.2026, 18:00')
    expect(previewAnnounce({ ...DEFAULT_RATING, periodType: 'quarter' }, '2026-11-10')).toBeNull()
  })

  it("o'chiq bo'lsa vaqt maydoni bloklanadi; yoqish va vaqtni o'zgartirish emit qiladi", async () => {
    const off = mountFields({ ...DEFAULT_RATING, periodType: 'month' })
    expect((off.get('[data-testid="results-time"]').element as HTMLInputElement).disabled).toBe(
      true,
    )
    await off.get('[data-testid="results-enabled"] button').trigger('click')
    expect(off.emitted('update:modelValue')?.[0][0]).toMatchObject({ resultsEnabled: true })

    const on = mountFields({ ...DEFAULT_RATING, periodType: 'month', resultsEnabled: true })
    await on.get('[data-testid="results-time"]').setValue('17:30')
    expect(on.emitted('update:modelValue')?.[0][0]).toMatchObject({ resultsTime: '17:30' })
  })
})

describe('Yakuniy natija sozlamalari validatsiyasi', () => {
  it("kalitlar ro'yxatida bor; standart xatosiz", () => {
    for (const k of ['resultsEnabled', 'resultsWeekday', 'resultsTime']) {
      expect(RATING_KEYS).toContain(k)
    }
    expect(validateRating(DEFAULT_RATING, t)).toEqual({})
  })
  it('vaqt HH:mm 00:00–23:59, kun 1–7', () => {
    for (const bad of ['', '9:00', '24:00', '18:60', 'abc']) {
      expect(validateRating({ ...DEFAULT_RATING, resultsTime: bad }, t).resultsTime).toBeDefined()
    }
    for (const good of ['00:00', '18:00', '23:59']) {
      expect(validateRating({ ...DEFAULT_RATING, resultsTime: good }, t)).toEqual({})
    }
    for (const bad of [-1, 32, 1.5]) {
      expect(
        validateRating({ ...DEFAULT_RATING, resultsMonthDay: bad }, t).resultsMonthDay,
      ).toBeDefined()
    }
    for (const bad of ['2026-02-30', '26-11-2026', '2026-1-5', 'abc']) {
      expect(validateRating({ ...DEFAULT_RATING, resultsDate: bad }, t).resultsDate).toBeDefined()
    }
    expect(
      validateRating({ ...DEFAULT_RATING, resultsMonthDay: 31, resultsDate: '2026-12-25' }, t),
    ).toEqual({})
    expect(validateRating({ ...DEFAULT_RATING, resultsDate: null }, t)).toEqual({})
    for (const bad of [0, 8, 2.5, NaN]) {
      expect(
        validateRating({ ...DEFAULT_RATING, resultsWeekday: bad }, t).resultsWeekday,
      ).toBeDefined()
    }
    expect(validateRating({ ...DEFAULT_RATING, resultsWeekday: 7 }, t)).toEqual({})
  })
})

describe('ratingResults yordamchilari', () => {
  it('sarlavha davr turiga qarab', () => {
    const tr = (k: string) => k
    expect(winnersTitle(tr, 'week')).toBe('ratings.results.winners.week')
    expect(
      winnersTitle(
        (k) => (uz.ratings.results.winners as Record<string, string>)[k.split('.').pop()!]!,
        'custom',
      ),
    ).toBe("Davr g'oliblari")
  })
  it("arxiv qatorlari jonli jadval shakliga o'giriladi", () => {
    const s = toStudentItem({
      studentId: 's',
      fullName: 'A',
      classId: 'c',
      className: null,
      grade: null,
      score: 90,
      rank: 2,
      daysCount: 3,
      scoresCount: 4,
    })
    expect(s).toMatchObject({ eligible: true, className: '', rankChange: null, rank: 2 })
    expect(
      toClassItem({ classId: 'c', name: '5-A', grade: 5, score: 80, rank: 1, ratedStudents: 7 }),
    ).toMatchObject({ className: '5-A', ratedStudents: 7, rankChange: null })
  })
})

describe('RatingFields: xulq turi jarimasi', () => {
  it("standart o'chiq; kalit RATING_KEYS da; yoqish emit qiladi; izoh ko'rinadi", async () => {
    expect(DEFAULT_RATING.behaviorPenaltyEnabled).toBe(false)
    expect(RATING_KEYS).toContain('behaviorPenaltyEnabled')
    const w = mountFields({ ...DEFAULT_RATING })
    const sw = w.get('[data-testid="behavior-penalty-enabled"] button')
    expect(sw.attributes('aria-checked')).toBe('false')
    expect(w.text()).toContain('Xulq turi jarimasi')
    expect(w.text()).toContain('Davomat jarimasidan alohida hisoblanadi')
    await sw.trigger('click')
    const ev = w.emitted('update:modelValue')!
    expect((ev[ev.length - 1]![0] as RatingSettings).behaviorPenaltyEnabled).toBe(true)
  })
})
