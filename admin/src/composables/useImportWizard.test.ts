import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importApi } from '@/api/import.api'
import { ApiError } from '@/api/errors'
import type { ImportPreview } from '@/api/types'
import { useImportWizard } from './useImportWizard'

vi.mock('@/api/import.api', () => ({
  importApi: {
    preview: vi.fn(),
    confirm: vi.fn(),
    downloadTemplate: vi.fn(),
    downloadErrors: vi.fn(),
  },
}))

const xlsx = (name = 'students.xlsx', size = 1000) => ({ name, size }) as File

function makePreview(valid: number, invalid: number, duplicates: number): ImportPreview {
  const rows = [
    ...Array.from({ length: valid }, (_, i) => ({ status: 'valid' as const, row: i + 2 })),
    ...Array.from({ length: invalid }, (_, i) => ({ status: 'invalid' as const, row: 100 + i })),
    ...Array.from({ length: duplicates }, (_, i) => ({
      status: 'duplicate' as const,
      row: 200 + i,
    })),
  ].map((r) => ({
    ...r,
    data: {
      fullName: 'X',
      className: '7-A',
      birthDate: null,
      gender: null,
      studentCode: null,
      parentPhone: null,
    },
    resolvedClassId: null,
    duplicateOfStudentId: null,
    errors: r.status === 'invalid' ? ['xato'] : [],
  }))
  return {
    importId: 'imp1',
    expiresAt: '2030-01-01T00:00:00Z',
    summary: { total: rows.length, valid, invalid, duplicates },
    rows,
  }
}

describe('useImportWizard', () => {
  beforeEach(() => vi.clearAllMocks())

  it("noto'g'ri faylni klientda rad etadi (kengaytma va hajm)", () => {
    const w = useImportWizard()
    w.selectFile(xlsx('students.csv'))
    expect(w.file.value).toBeNull()
    expect(w.fileError.value).not.toBe('')
    w.selectFile(xlsx('big.xlsx', 6 * 1024 * 1024))
    expect(w.file.value).toBeNull()
    w.selectFile(xlsx())
    expect(w.fileError.value).toBe('')
    expect(w.file.value).not.toBeNull()
  })

  it('upload -> preview: classId yuboriladi va qadam almashadi', async () => {
    vi.mocked(importApi.preview).mockResolvedValue(makePreview(3, 1, 1))
    const w = useImportWizard(() => 'class-1')
    w.selectFile(xlsx())
    await w.upload()
    expect(importApi.preview).toHaveBeenCalledWith(
      expect.anything(),
      'class-1',
      expect.any(Function),
    )
    expect(w.step.value).toBe('preview')
    expect(w.filteredRows.value).toHaveLength(5)
    w.setFilter('invalid')
    expect(w.filteredRows.value.map((r) => r.status)).toEqual(['invalid'])
  })

  it("to'g'ri qator bo'lmasa tasdiqlash o'chirilgan; \"yangilash\" bilan dublikatlar hisobga olinadi", async () => {
    vi.mocked(importApi.preview).mockResolvedValue(makePreview(0, 2, 3))
    const w = useImportWizard()
    w.selectFile(xlsx())
    await w.upload()
    expect(w.canConfirm.value).toBe(false)
    w.setDuplicateMode('update')
    expect(w.canConfirm.value).toBe(true)
    expect(w.importableCount.value).toBe(3)
  })

  it("confirm natijani saqlaydi va result qadamiga o'tadi", async () => {
    vi.mocked(importApi.preview).mockResolvedValue(makePreview(2, 0, 0))
    vi.mocked(importApi.confirm).mockResolvedValue({
      created: 2,
      updated: 0,
      skipped: 0,
      failed: 0,
    })
    const w = useImportWizard()
    w.selectFile(xlsx())
    await w.upload()
    await w.confirm()
    expect(importApi.confirm).toHaveBeenCalledWith('imp1', 'skip')
    expect(w.step.value).toBe('result')
    expect(w.result.value?.created).toBe(2)
  })

  it("413 va validatsiya xatolari aniq ko'rsatiladi, qadam o'zgarmaydi", async () => {
    const w = useImportWizard()
    w.selectFile(xlsx())
    vi.mocked(importApi.preview).mockRejectedValueOnce(new ApiError('INTERNAL', 'x', 413))
    await w.upload()
    expect(w.error.value).toContain('5 MB')
    expect(w.step.value).toBe('upload')
    vi.mocked(importApi.preview).mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', "1000 qatordan ko'p", 400),
    )
    await w.upload()
    expect(w.error.value).toBe("1000 qatordan ko'p")
  })

  it('reset hamma holatni tozalaydi', async () => {
    vi.mocked(importApi.preview).mockResolvedValue(makePreview(1, 0, 0))
    const w = useImportWizard()
    w.selectFile(xlsx())
    await w.upload()
    w.reset()
    expect(w.step.value).toBe('upload')
    expect(w.file.value).toBeNull()
    expect(w.preview.value).toBeNull()
  })

  it("confirm 404 (sessiya tugadi) - 1-qadamga qaytaradi va xabar ko'rsatadi; 409 - allaqachon bajarilgan", async () => {
    vi.mocked(importApi.preview).mockResolvedValue(makePreview(2, 0, 0))
    const w = useImportWizard()
    w.selectFile(xlsx())
    await w.upload()
    vi.mocked(importApi.confirm).mockRejectedValueOnce(new ApiError('NOT_FOUND', 'x', 404))
    await w.confirm()
    expect(w.step.value).toBe('upload')
    expect(w.error.value).toContain('muddati tugadi')

    await w.upload()
    vi.mocked(importApi.confirm).mockRejectedValueOnce(new ApiError('CONFLICT', 'x', 409))
    await w.confirm()
    expect(w.step.value).toBe('preview')
    expect(w.error.value).toContain('allaqachon')
  })
})
