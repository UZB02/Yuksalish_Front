import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { BehaviorType, ScoringSettings } from '@/api/types'
import BulkPanel from './BulkPanel.vue'

const settings: ScoringSettings = {
  minScore: 0,
  maxScore: 100,
  requireBehaviorType: true,
  commentRequiredBelow: null,
  editWindowHours: 24,
  backdateDays: 3,
  dailyAggregation: 'average',
}
const types: BehaviorType[] = [
  {
    id: 'b1',
    schoolId: null,
    name: 'Namunali',
    kind: 'positive',
    color: '#16a34a',
    order: 1,
    minScore: null,
    maxScore: null,
    isActive: true,
    createdAt: '',
  },
]

const mountPanel = () =>
  mount(BulkPanel, {
    props: { count: 3, settings, types },
    global: { plugins: [createI18n({ legacy: false, locale: 'uz', messages: { uz } })] },
  })

describe('BulkPanel', () => {
  it("hech narsa kiritilmaguncha qo'llash o'chirilgan", () => {
    const w = mountPanel()
    expect(w.find('button.h-10, button:last-of-type').exists()).toBe(true)
    const apply = w.findAll('button').find((b) => b.text().includes("qo'llash"))!
    expect(apply.attributes('disabled')).toBeDefined()
  })

  it("raqam inputi (v-model son qaytaradi) ham satr sifatida qo'llanadi", async () => {
    const w = mountPanel()
    await w.find('input[type="number"]').setValue('85')
    await w.find('[role="radio"]').trigger('click')
    const apply = w.findAll('button').find((b) => b.text().includes("qo'llash"))!
    expect(apply.attributes('disabled')).toBeUndefined()
    await apply.trigger('click')
    expect(w.emitted('apply')![0]).toEqual([{ value: '85', behaviorTypeId: 'b1' }])
  })

  it('tezkor tugma qiymatni belgilaydi', async () => {
    const w = mountPanel()
    const q = w.findAll('button').find((b) => b.text() === '90')!
    await q.trigger('click')
    const apply = w.findAll('button').find((b) => b.text().includes("qo'llash"))!
    await apply.trigger('click')
    expect(w.emitted('apply')![0]).toEqual([{ value: '90' }])
  })
})
