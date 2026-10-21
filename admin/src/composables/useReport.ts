import { computed, ref, watch, type Ref } from 'vue'
import { toApiError, type ApiError } from '@/api/errors'

/**
 * Bitta hisobot so'rovi holati: `source()` parametrlarni qaytaradi (null - so'rov yuborilmaydi,
 * masalan majburiy filtr tanlanmagan). Parametr o'zgarsa qayta yuklaydi, eskirgan javobni tashlaydi.
 */
export function useReport<T, P>(
  source: () => P | null,
  fetch: (params: P) => Promise<T>,
  isEmpty: (data: T) => boolean = () => false,
) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  let requestId = 0

  async function load() {
    const params = source()
    const current = ++requestId
    if (params === null) {
      data.value = null
      error.value = null
      loading.value = false
      return
    }
    loading.value = true
    error.value = null
    try {
      const result = await fetch(params)
      if (current !== requestId) return
      data.value = result
    } catch (e) {
      if (current !== requestId) return
      data.value = null
      error.value = toApiError(e)
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  // Parametrlar qiymat bo'yicha solishtiriladi (bir xil qiymat qayta so'rov yubormaydi)
  watch(() => JSON.stringify(source()), load, { immediate: true })

  const empty = computed(
    () => !loading.value && !error.value && !!data.value && isEmpty(data.value),
  )
  const idle = computed(() => !loading.value && !error.value && data.value === null)
  return { data, loading, error, empty, idle, reload: load }
}
