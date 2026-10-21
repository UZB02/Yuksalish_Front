import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { StudentRatingItem } from '@/api/types'
import StudentRatingTable from './StudentRatingTable.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const item = (id: string, penalty?: number): StudentRatingItem => ({
  rank: 1,
  previousRank: null,
  rankChange: null,
  studentId: id,
  fullName: `S${id}`,
  classId: 'c',
  className: '7-A',
  score: 10,
  daysCount: 1,
  scoresCount: 1,
  eligible: true,
  ...(penalty === undefined ? {} : { penalty }),
})
const mountT = (items: StudentRatingItem[]) =>
  mount(StudentRatingTable, { props: { items }, global: { plugins: [i18n] } })

describe('StudentRatingTable jarima ustuni', () => {
  it("jarima yo'q bo'lsa ustun ko'rinmaydi", () => {
    expect(
      mountT([item('1'), item('2', 0)])
        .find('[data-testid="penalty"]')
        .exists(),
    ).toBe(false)
    expect(mountT([item('1')]).text()).not.toContain(uz.ratings.penalty)
  })
  it("kamida bitta jarima > 0 bo'lsa ustun va qiymat ko'rinadi", () => {
    const w = mountT([item('1', 2), item('2', 0)])
    expect(w.text()).toContain(uz.ratings.penalty)
    expect(w.findAll('[data-testid="penalty"]')).toHaveLength(1)
    expect(w.find('[data-testid="penalty"]').text()).toBe('-2')
  })
})
