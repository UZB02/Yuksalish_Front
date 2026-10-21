import { describe, expect, it } from 'vitest'
import { formatBytes, IMPORT_MAX_BYTES, validateImportFile } from './importFile'

describe('validateImportFile', () => {
  it("faqat .xlsx (registrdan qat'i nazar)", () => {
    expect(validateImportFile({ name: 'a.xlsx', size: 10 })).toBeNull()
    expect(validateImportFile({ name: 'A.XLSX', size: 10 })).toBeNull()
    expect(validateImportFile({ name: 'a.xls', size: 10 })).toBe('import.errors.notXlsx')
    expect(validateImportFile({ name: 'a.xlsx.exe', size: 10 })).toBe('import.errors.notXlsx')
  })
  it("hajm chegarasi 5 MB, bo'sh fayl rad etiladi", () => {
    expect(validateImportFile({ name: 'a.xlsx', size: IMPORT_MAX_BYTES })).toBeNull()
    expect(validateImportFile({ name: 'a.xlsx', size: IMPORT_MAX_BYTES + 1 })).toBe(
      'import.errors.tooLarge',
    )
    expect(validateImportFile({ name: 'a.xlsx', size: 0 })).toBe('import.errors.empty')
  })
  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
