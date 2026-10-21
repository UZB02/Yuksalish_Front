import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auditApi } from '@/api/audit.api'
import { toApiError, type ApiError } from '@/api/errors'
import type { AuditLogItem } from '@/api/types'
import { auditParams, parseAuditQuery, toAuditQuery, type AuditQueryState } from '@/utils/audit'

/**
 * Audit log ro'yxati: filtrlar, sahifa va hajm URL query bilan sinxron (havola ulashiladi);
 * filtr o'zgarsa 1-sahifaga qaytadi; eskirgan javoblar tashlanadi.
 */
export function useAuditLog() {
  const route = useRoute()
  const router = useRouter()
  const state = reactive<AuditQueryState>(parseAuditQuery(route.query))

  const items = ref<AuditLogItem[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  let requestId = 0

  const serialize = () => JSON.stringify(toAuditQuery(state))

  async function load() {
    const current = ++requestId
    loading.value = true
    error.value = null
    try {
      const res = await auditApi.list(auditParams(state))
      if (current !== requestId) return
      items.value = res.items
      total.value = res.meta.total
      totalPages.value = Math.max(1, res.meta.totalPages)
    } catch (e) {
      if (current !== requestId) return
      items.value = []
      error.value = toApiError(e)
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  // Filtr (sahifadan tashqari) o'zgarsa 1-sahifaga qaytamiz
  const filterKey = () =>
    JSON.stringify([
      state.from,
      state.to,
      state.userId,
      state.action,
      state.entity,
      state.schoolId,
      state.search,
      state.limit,
    ])
  watch(filterKey, () => {
    if (state.page !== 1) state.page = 1
  })

  // state -> URL va yuklash
  watch(
    () => serialize() + filterKey(),
    () => {
      if (JSON.stringify(toAuditQuery(parseAuditQuery(route.query))) !== serialize()) {
        void router.replace({ query: toAuditQuery(state) })
      }
      void load()
    },
    { flush: 'post', immediate: true },
  )
  // URL -> state (orqaga/oldinga)
  watch(
    () => route.query,
    (q) => {
      const next = parseAuditQuery(q)
      if (JSON.stringify(toAuditQuery(next)) !== serialize()) Object.assign(state, next)
    },
  )

  function reset() {
    Object.assign(state, parseAuditQuery({}))
  }
  const setPage = (p: number) => {
    if (p >= 1 && p <= totalPages.value) state.page = p
  }

  return { state, items, total, totalPages, loading, error, load, reset, setPage }
}
