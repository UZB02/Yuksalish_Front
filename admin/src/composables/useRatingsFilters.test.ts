import { describe, expect, it } from 'vitest'
import { useRatingsFilters } from './useRatingsFilters'

describe('useRatingsFilters', () => {
  it("boshlang'ich holat: joriy davr, faqat sahifalash parametrlari", () => {
    const f = useRatingsFilters()
    expect(f.studentParams(1, 20)).toEqual({ page: 1, limit: 20 })
    expect(f.periodParams.value).toEqual({})
    expect(f.customIncomplete.value).toBe(false)
  })

  it('filtrlar parametrga aylanadi; includeIneligible faqat yoqilganda', () => {
    const f = useRatingsFilters()
    f.classId.value = 'c1'
    f.grade.value = '7'
    f.search.value = '  Ali '
    expect(f.studentParams(2, 10)).toEqual({
      page: 2,
      limit: 10,
      classId: 'c1',
      grade: 7,
      search: 'Ali',
    })
    f.includeIneligible.value = true
    expect(f.studentParams(1, 10).includeIneligible).toBe(true)
    f.includeIneligible.value = false
    expect(f.studentParams(1, 10)).not.toHaveProperty('includeIneligible')
  })

  it("maxsus davr: to'liq va to'g'ri bo'lsagina from/to yuboriladi", () => {
    const f = useRatingsFilters()
    f.mode.value = 'custom'
    expect(f.customIncomplete.value).toBe(true)
    expect(f.periodParams.value).toEqual({})
    f.from.value = '2026-10-10'
    f.to.value = '2026-10-01'
    expect(f.customValid.value).toBe(false)
    f.to.value = '2026-10-20'
    expect(f.periodParams.value).toEqual({ from: '2026-10-10', to: '2026-10-20' })
    expect(f.classParams()).toEqual({ from: '2026-10-10', to: '2026-10-20' })
    f.mode.value = 'current'
    expect(f.periodParams.value).toEqual({})
  })

  it("sinf bosilganda o'quvchilar filtri shu sinfga o'rnatiladi, parallel/qidiruv tozalanadi", () => {
    const f = useRatingsFilters()
    f.grade.value = '5'
    f.search.value = 'x'
    f.focusClass('c9')
    expect(f.classId.value).toBe('c9')
    expect(f.grade.value).toBe('')
    expect(f.search.value).toBe('')
    f.reset()
    expect(f.classId.value).toBe('')
  })
})
