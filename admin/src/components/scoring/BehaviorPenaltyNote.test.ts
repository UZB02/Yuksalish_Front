import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { BehaviorType } from '@/api/types'
import BehaviorPenaltyNote from './BehaviorPenaltyNote.vue'
import BulkPanel from './BulkPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const type = (id: string, ratingPenalty: number): BehaviorType => ({
  id,
  schoolId: null,
  name: id,
  kind: 'negative',
  color: '#dc2626',
  order: 1,
  minScore: null,
  maxScore: null,
  defaultScore: null,
  ratingPenalty,
  isActive: true,
  createdAt: '',
})
const types = [type('neg', 5), type('zero', 0)]
const mountNote = (typeId: string | null, enabled: boolean | undefined) =>
  mount(BehaviorPenaltyNote, {
    props: { types, typeId, enabled },
    global: { plugins: [i18n] },
  })
const NOTE = '[data-testid="behavior-penalty-note"]'

describe('BehaviorPenaltyNote', () => {
  it("yoqilgan va jarima > 0 bo'lsa ogohlantirish ko'rsatiladi", () => {
    expect(mountNote('neg', true).get(NOTE).text()).toBe('Reytingdan yana −5 ball ayiriladi')
  })

  it("sozlama o'chiq, jarima 0, tur yo'q yoki noma'lum bo'lsa ko'rinmaydi", () => {
    expect(mountNote('neg', false).find(NOTE).exists()).toBe(false)
    expect(mountNote('neg', undefined).find(NOTE).exists()).toBe(false)
    expect(mountNote('zero', true).find(NOTE).exists()).toBe(false)
    expect(mountNote(null, true).find(NOTE).exists()).toBe(false)
    expect(mountNote('missing', true).find(NOTE).exists()).toBe(false)
  })

  it('ommaviy baholash paneli: tur tanlanganda ogohlantiradi', async () => {
    const settings = {
      minScore: 0,
      maxScore: 100,
      requireBehaviorType: true,
      commentRequiredBelow: null,
      editWindowHours: 24,
      backdateDays: 3,
      dailyAggregation: 'average' as const,
      autoFillScoreFromBehaviorType: false,
    }
    const w = mount(BulkPanel, {
      props: { count: 2, settings, types, penaltyEnabled: true },
      global: { plugins: [i18n] },
    })
    expect(w.find(NOTE).exists()).toBe(false)
    await w.findAll('[role="radio"]')[0]!.trigger('click')
    expect(w.get(NOTE).text()).toContain('−5')
  })
})
