import { computed, ref } from 'vue'
import type { StudentRatingParams } from '@/api/types'

export type PeriodMode = 'current' | 'custom'

/**
 * Reyting sahifasi filtrlari: davr (joriy yoki maxsus oraliq), sinf, parallel, qidiruv,
 * "reytingga kirmaganlarni ham ko'rsat". So'rov parametrlarini sof ko'rinishda quradi.
 */
export function useRatingsFilters() {
  const mode = ref<PeriodMode>('current')
  const from = ref('')
  const to = ref('')
  const classId = ref('')
  const grade = ref('')
  const search = ref('')
  const includeIneligible = ref(false)

  /** Maxsus davr to'g'ri bo'lsa (from <= to, ikkalasi ham bor) `from/to`, aks holda bo'sh. */
  const customValid = computed(() => !!from.value && !!to.value && from.value <= to.value)
  const periodParams = computed<{ from?: string; to?: string }>(() =>
    mode.value === 'custom' && customValid.value ? { from: from.value, to: to.value } : {},
  )
  /** Maxsus rejim tanlangan, lekin sanalar hali to'liq emas. */
  const customIncomplete = computed(() => mode.value === 'custom' && !customValid.value)

  const gradeNum = computed(() => (grade.value ? Number(grade.value) : undefined))

  function studentParams(page: number, limit: number, searchText = search.value) {
    const p: StudentRatingParams = { page, limit, ...periodParams.value }
    if (classId.value) p.classId = classId.value
    if (gradeNum.value) p.grade = gradeNum.value
    if (searchText.trim()) p.search = searchText.trim()
    if (includeIneligible.value) p.includeIneligible = true
    return p
  }

  function classParams() {
    return { ...periodParams.value, ...(gradeNum.value ? { grade: gradeNum.value } : {}) }
  }

  /** Sinf nomi bosilganda o'quvchilar tabiga shu sinf filtri bilan o'tish. */
  function focusClass(id: string) {
    classId.value = id
    grade.value = ''
    search.value = ''
  }

  function reset() {
    mode.value = 'current'
    from.value = ''
    to.value = ''
    classId.value = ''
    grade.value = ''
    search.value = ''
    includeIneligible.value = false
  }

  return {
    mode,
    from,
    to,
    classId,
    grade,
    search,
    includeIneligible,
    customValid,
    customIncomplete,
    periodParams,
    studentParams,
    classParams,
    focusClass,
    reset,
  }
}
