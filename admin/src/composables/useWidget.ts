import { onMounted, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/utils/errors'

/** Dashboard vidjeti uchun yuklash holati: data / loading / error + qayta urinish. */
export function useWidget<T>(fetcher: () => Promise<T>) {
  const { t } = useI18n()
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(true)
  const error = ref('')
  let requestId = 0

  async function load() {
    const current = ++requestId
    loading.value = true
    error.value = ''
    try {
      const res = await fetcher()
      if (current === requestId) data.value = res
    } catch (e) {
      if (current === requestId) {
        data.value = null
        error.value = errorMessage(e, t)
      }
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  onMounted(load)
  return { data, loading, error, load }
}
