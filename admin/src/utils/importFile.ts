export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const IMPORT_MAX_ROWS = 1000

/** Fayl klientda tekshiriladi: faqat .xlsx va 5 MB gacha. Xato bo'lsa i18n kaliti qaytadi. */
export function validateImportFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.xlsx$/i.test(file.name)) return 'import.errors.notXlsx'
  if (file.size === 0) return 'import.errors.empty'
  if (file.size > IMPORT_MAX_BYTES) return 'import.errors.tooLarge'
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
