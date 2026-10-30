import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { exportErrorMessage } from '@/utils/errors'
import { useToast } from './useToast'

/** Jadvalni Excel/PDF qilib yuklash: yuklanish holati (tugmada spinner), muvaffaqiyat/xato toast. */
export function useTimetableExport() {
  const { t } = useI18n()
  const toast = useToast()
  const busy = ref(false)

  /** `download` fayl nomini qaytaradi (timetableApi.export*) */
  async function run(download: () => Promise<string>): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      const name = await download()
      toast.success(t('reports.downloaded', { name }))
      return true
    } catch (e) {
      toast.error(exportErrorMessage(e, t))
      return false
    } finally {
      busy.value = false
    }
  }
  return { busy, run }
}
