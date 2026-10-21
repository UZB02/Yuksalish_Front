import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import type { ExportFormat, ReportParams, ReportType } from '@/api/types'
import { exportErrorMessage } from '@/utils/errors'
import { useToast } from './useToast'

/** Hisobotni Excel/PDF qilib yuklash: yuklanayotgan format (spinner), muvaffaqiyat/xato toast. */
export function useReportExport() {
  const { t } = useI18n()
  const toast = useToast()
  const busy = ref<ExportFormat | null>(null)

  async function run(
    type: ReportType,
    format: ExportFormat,
    params: Partial<ReportParams>,
    studentId?: string,
  ): Promise<boolean> {
    if (busy.value) return false
    busy.value = format
    try {
      const name = await reportsApi.export(type, format, params, studentId)
      toast.success(t('reports.downloaded', { name }))
      return true
    } catch (e) {
      toast.error(exportErrorMessage(e, t))
      return false
    } finally {
      busy.value = null
    }
  }
  return { busy, run }
}
