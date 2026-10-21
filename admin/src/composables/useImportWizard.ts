import { computed, ref, type UnwrapNestedRefs } from 'vue'
import { importApi } from '@/api/import.api'
import { isApiError } from '@/api/errors'
import type { DuplicateMode, ImportPreview, ImportResult } from '@/api/types'
import { i18n } from '@/i18n'
import { errorMessage } from '@/utils/errors'
import { validateImportFile } from '@/utils/importFile'

export type WizardStep = 'upload' | 'preview' | 'result'
export type RowFilter = 'all' | 'invalid' | 'duplicate'

/** Import xatosini aniq xabarga aylantiradi (413, validatsiya - serverning o'z matni bilan). */
export function describeImportError(e: unknown): string {
  const t = i18n.global.t
  if (isApiError(e)) {
    if (e.status === 413) return t('import.errors.tooLarge')
    if (e.status === 404) return t('import.errors.expired')
    if (e.status === 409) return t('import.errors.alreadyDone')
    if (e.code === 'VALIDATION_ERROR' && e.message) return e.message
  }
  return errorMessage(e, t)
}

/**
 * Excel import wizard holat mashinasi: upload -> preview -> result.
 * `getClassId` - sinf sahifasidan ochilganda sinf id si (umumiy sahifada undefined).
 */
export function useImportWizard(getClassId: () => string | undefined = () => undefined) {
  const t = i18n.global.t
  const step = ref<WizardStep>('upload')
  const file = ref<File | null>(null)
  const fileError = ref('')
  const uploading = ref(false)
  const progress = ref(0)
  const preview = ref<ImportPreview | null>(null)
  const filter = ref<RowFilter>('all')
  const duplicateMode = ref<DuplicateMode>('skip')
  const confirming = ref(false)
  const result = ref<ImportResult | null>(null)
  const error = ref('')

  const filteredRows = computed(() => {
    const rows = preview.value?.rows ?? []
    if (filter.value === 'all') return rows
    return rows.filter((r) => r.status === filter.value)
  })

  // Saqlanadigan qator bo'lishi kerak: to'g'ri qatorlar yoki "yangilash" tanlangan dublikatlar.
  const importableCount = computed(() => {
    const s = preview.value?.summary
    if (!s) return 0
    return s.valid + (duplicateMode.value === 'update' ? s.duplicates : 0)
  })
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
      preview.value = await importApi.preview(file.value, getClassId(), (p) => (progress.value = p))
      filter.value = 'all'
      duplicateMode.value = 'skip'
      step.value = 'preview'
    } catch (e) {
      error.value = describeImportError(e)
    } finally {
      uploading.value = false
    }
  }

  async function confirm() {
    if (!preview.value || !canConfirm.value) return
    confirming.value = true
    error.value = ''
    try {
      result.value = await importApi.confirm(preview.value.importId, duplicateMode.value)
      step.value = 'result'
    } catch (e) {
      error.value = describeImportError(e)
      // Sessiya muddati tugagan (404): fayl qayta yuklanishi kerak.
      if (isApiError(e) && e.status === 404) {
        step.value = 'upload'
        preview.value = null
      }
    } finally {
      confirming.value = false
    }
  }

  async function runDownload(action: () => Promise<unknown>) {
    error.value = ''
    try {
      await action()
    } catch (e) {
      error.value = describeImportError(e)
    }
  }

  const downloadTemplate = () => runDownload(() => importApi.downloadTemplate())
  const downloadErrors = () => {
    const id = preview.value?.importId
    return id ? runDownload(() => importApi.downloadErrors(id)) : Promise.resolve()
  }

  const setFilter = (f: RowFilter) => (filter.value = f)
  const setDuplicateMode = (m: DuplicateMode) => (duplicateMode.value = m)

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
    duplicateMode.value = 'skip'
    confirming.value = false
    result.value = null
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
    duplicateMode,
    confirming,
    result,
    error,
    filteredRows,
    importableCount,
    canConfirm,
    selectFile,
    upload,
    confirm,
    downloadTemplate,
    downloadErrors,
    setFilter,
    setDuplicateMode,
    backToUpload,
    reset,
  }
}

/** `reactive(useImportWizard())` natijasi turi (refs ochilgan). */
export type ImportWizard = UnwrapNestedRefs<ReturnType<typeof useImportWizard>>
