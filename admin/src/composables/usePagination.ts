import { ref, type Ref } from 'vue'
import type { Paginated } from '@/api/types'
import { toApiError } from '@/api/errors'
import type { ApiError } from '@/api/errors'

interface Options {
  limit?: number
}

/**
 * Sahifalangan ro'yxat holati. `fetcher` joriy page/limit ni oladi;
 * filtrlar fetcher ichida yopilgan (closure) holda o'qiladi.
 */
export function usePagination<T>(
  fetcher: (params: { page: number; limit: number }) => Promise<Paginated<T>>,
  options: Options = {},
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const page = ref(1)
  const limit = ref(options.limit ?? 10)
  const total = ref(0)
  const totalPages = ref(1)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  let requestId = 0

  async function load() {
    const current = ++requestId
    loading.value = true
    error.value = null
    try {
      const result = await fetcher({ page: page.value, limit: limit.value })
      if (current !== requestId) return // eskirgan javob
      items.value = result.items
      total.value = result.meta.total
      totalPages.value = Math.max(1, result.meta.totalPages)
      // Oxirgi sahifadagi oxirgi element o'chirilsa - bir sahifa orqaga.
      if (page.value > totalPages.value) {
        page.value = totalPages.value
        await load()
      }
    } catch (e) {
      if (current !== requestId) return
      error.value = toApiError(e)
      items.value = []
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  function setPage(next: number) {
    if (next < 1 || next === page.value) return
    page.value = next
    return load()
  }

  /** Filtr o'zgarganda: 1-sahifadan qayta yuklash. */
  function reset() {
    page.value = 1
    return load()
  }

  return { items, page, limit, total, totalPages, loading, error, load, setPage, reset }
}
