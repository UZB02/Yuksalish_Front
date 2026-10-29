import { describe, expect, it, vi } from 'vitest'
import { downloadFile } from './download'
import { journalApi } from './journal.api'

vi.mock('./download', () => ({ downloadFile: vi.fn(async () => 'f.xlsx') }))

const q = { classId: 'c', subjectId: 's', from: '2026-10-01', to: '2026-10-31' }

describe('journalApi.export', () => {
  it('Excel va PDF uchun to`g`ri URL va parametrlar', async () => {
    await journalApi.export('xlsx', q)
    expect(downloadFile).toHaveBeenLastCalledWith('/journal/subject/export.xlsx', {
      params: q,
      fallbackName: 'jurnal_2026-10-01_2026-10-31.xlsx',
    })
    await journalApi.export('pdf', q)
    expect(downloadFile).toHaveBeenLastCalledWith(
      '/journal/subject/export.pdf',
      expect.objectContaining({ params: q }),
    )
  })
})
