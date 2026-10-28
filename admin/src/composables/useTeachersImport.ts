import { computed, ref, type UnwrapNestedRefs } from 'vue'
import { teachersApi } from '@/api/teachers.api'
import type { TeacherImportPreview, TeacherImportResult } from '@/api/types'
import { i18n } from '@/i18n'
import { validateImportFile } from '@/utils/importFile'
import { describeImportError } from './useImportWizard'

export type TeachersImportStep = 'upload' | 'preview' | 'result'
export type TeachersRowFilter = 'all' | 'error' | 'skip_existing'

/**
 * O'qituvchilarni Excel'dan import qilish holat mashinasi: upload -> preview -> result.
 * Tasdiqlashda fayl qayta yuboriladi (server hamma narsani qayta tekshiradi); parollar
 * faqat xotirada turadi va `reset()` da tozalanadi.
 */
export function useTeachersImport() {
  const t = i18n.global.t
  const step = ref<TeachersImportStep>('upload')
  const file = ref<File | null>(null)
  const fileError = ref('')
  const uploading = ref(false)
  const progress = ref(0)
  const preview = ref<TeacherImportPreview | null>(null)
  const filter = ref<TeachersRowFilter>('all')
  const confirming = ref(false)
  const result = ref<TeacherImportResult | null>(null)
  const downloading = ref(false)
  const error = ref('')

  const filteredRows = computed(() => {
    const rows = preview.value?.rows ?? []
    return filter.value === 'all' ? rows : rows.filter((r) => r.status === filter.value)
  })
  const importableCount = computed(() => preview.value?.summary.create ?? 0)
  const canConfirm = computed(() => importableCount.value > 0 && !confirming.value)

  function selectFile(f: File | null) {
    error.value = ''
    if (!f) {
      file.value = null
      fileError.value = ''
      return
    }
    const key = validateImportFile(f)
    fileError.value = key ? t(key) : ''
    file.value = key ? null : f
  }

  async function upload() {
    if (!file.value || uploading.value) return
    uploading.value = true
    progress.value = 0
    error.value = ''
    try {
      preview.value = await teachersApi.importPreview(file.value, (p) => (progress.value = p))
      filter.value = 'all'
      step.value = 'preview'
    } catch (e) {
      error.value = describeImportError(e)
    } finally {
      uploading.value = false
    }
  }

  async function confirm() {
    if (!file.value || !canConfirm.value) return
    confirming.value = true
    error.value = ''
    try {
      result.value = await teachersApi.importConfirm(file.value)
      step.value = 'result'
    } catch (e) {
      error.value = describeImportError(e)
    } finally {
      confirming.value = false
    }
  }

  async function run(action: () => Promise<unknown>) {
    error.value = ''
    try {
      await action()
    } catch (e) {
      error.value = describeImportError(e)
    }
  }

  const downloadTemplate = () => run(() => teachersApi.downloadImportTemplate())

  async function downloadCredentials() {
    if (!result.value || downloading.value) return
    downloading.value = true
    const rows = result.value.results
    await run(() => teachersApi.downloadCredentials(rows))
    downloading.value = false
  }

  const setFilter = (f: TeachersRowFilter) => (filter.value = f)

  function backToUpload() {
    step.value = 'upload'
    preview.value = null
    error.value = ''
  }

  function reset() {
    step.value = 'upload'
    file.value = null
    fileError.value = ''
    uploading.value = false
    progress.value = 0
    preview.value = null
    filter.value = 'all'
    confirming.value = false
    result.value = null
    downloading.value = false
    error.value = ''
  }

  return {
    step,
    file,
    fileError,
    uploading,
    progress,
    preview,
    filter,
    confirming,
    result,
    downloading,
    error,
    filteredRows,
    importableCount,
    canConfirm,
    selectFile,
    upload,
    confirm,
    downloadTemplate,
    downloadCredentials,
    setFilter,
    backToUpload,
    reset,
  }
}

export type TeachersImport = UnwrapNestedRefs<ReturnType<typeof useTeachersImport>>
