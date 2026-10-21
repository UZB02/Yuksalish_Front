import { computed, reactive, toRefs, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  parseReportQuery,
  reportRequest,
  resolvePreset,
  toReportQuery,
  validatePeriod,
  type PeriodError,
  type ReportState,
  type ReportTab,
  type YearLike,
} from '@/utils/reports'
import { todayTashkent } from '@/utils/scoring'

/**
 * Hisobotlar sahifasi filtrlari (tab, davr, sinf, o'quvchi). Holat URL query bilan sinxron:
 * havola ulashiladi, orqaga/oldinga tugmalari ishlaydi.
 */
export function useReportFilters(allowedTabs: Ref<ReportTab[]>, year: Ref<YearLike | null>) {
  const route = useRoute()
  const router = useRouter()
  const state = reactive<ReportState>(parseReportQuery(route.query, allowedTabs.value))
  const today = () => todayTashkent()

  const serialize = () => JSON.stringify(toReportQuery(state))

  // Ruxsat etilgan tablar keyin o'zgarsa (profil yuklangach) noto'g'ri tabni tuzatamiz
  watch(allowedTabs, (tabs) => {
    if (tabs.length > 0 && !tabs.includes(state.tab)) state.tab = tabs[0]!
  })

  // state -> URL
  watch(
    () => serialize(),
    () => {
      if (
        JSON.stringify(toReportQuery(parseReportQuery(route.query, allowedTabs.value))) !==
        serialize()
      ) {
        void router.replace({ query: toReportQuery(state) })
      }
    },
  )
  // URL -> state (masalan, sinf sahifasidan havola)
  watch(
    () => route.query,
    (q) => {
      const next = parseReportQuery(q, allowedTabs.value)
      if (JSON.stringify(toReportQuery(next)) !== serialize()) Object.assign(state, next)
    },
  )

  const needsYear = computed(() => state.preset === 'year' || state.preset.startsWith('quarter:'))

  /** Hisoblangan davr (yaroqsiz yoki hali aniq bo'lmasa null). */
  const period = computed<{ from: string; to: string } | null>(() => {
    const range =
      state.preset === 'custom'
        ? { from: state.from, to: state.to }
        : resolvePreset(state.preset, today(), year.value)
    if (!range) return null
    return validatePeriod(range.from, range.to, today()) ? null : range
  })

  const periodError = computed<PeriodError | null>(() => {
    if (state.preset === 'custom') {
      if (!state.from && !state.to) return null // foydalanuvchi hali tanlamagan
      return validatePeriod(state.from, state.to, today())
    }
    if (needsYear.value && !year.value) return null // o'quv yili yuklanmoqda
    const range = resolvePreset(state.preset, today(), year.value)
    return range ? validatePeriod(range.from, range.to, today()) : 'future'
  })

  const request = computed(() => (period.value ? reportRequest(state, period.value) : null))

  function setPreset(preset: string) {
    if (preset === 'custom' && state.preset !== 'custom') {
      // Maxsus rejimga o'tganda joriy davrni boshlang'ich qiymat qilamiz
      const cur = period.value
      if (cur) {
        state.from = cur.from
        state.to = cur.to
      }
    }
    state.preset = preset
  }

  /** Tab almashganda sinf/o'quvchi tanlovi saqlanadi (sinf -> o'quvchi tabi qulay), lekin o'quvchi sinfga mos bo'lishi shart emas. */
  return { ...toRefs(state), state, period, periodError, request, setPreset }
}
