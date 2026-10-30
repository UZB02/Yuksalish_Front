import { beforeEach, describe, expect, it, vi } from 'vitest'
import { timetableApi } from './timetable.api'
import { downloadFile } from './download'

vi.mock('./download', () => ({ downloadFile: vi.fn() }))
const dl = vi.mocked(downloadFile)

beforeEach(() => {
  vi.clearAllMocks()
  dl.mockResolvedValue('f.xlsx')
})

describe('timetableApi eksport', () => {
  it('sinf: format va versionId parametrlari bilan', async () => {
    const name = await timetableApi.exportClass('c1', 'pdf', { versionId: 'v1' })
    expect(name).toBe('f.xlsx')
    expect(dl).toHaveBeenCalledWith('/timetable/classes/c1/export', {
      params: { format: 'pdf', versionId: 'v1' },
      fallbackName: 'dars-jadvali.pdf',
    })
    await timetableApi.exportClass('c1', 'xlsx', { date: '2026-11-02' })
    expect(dl).toHaveBeenLastCalledWith(
      '/timetable/classes/c1/export',
      expect.objectContaining({ params: { format: 'xlsx', date: '2026-11-02' } }),
    )
  })

  it("o'qituvchi va /me: sana bilan", async () => {
    await timetableApi.exportTeacher('t1', 'xlsx', '2026-11-02')
    expect(dl).toHaveBeenLastCalledWith('/timetable/teachers/t1/export', {
      params: { format: 'xlsx', date: '2026-11-02' },
      fallbackName: 'dars-jadvali.xlsx',
    })
    await timetableApi.exportMine('pdf')
    expect(dl).toHaveBeenLastCalledWith('/timetable/me/export', {
      params: { format: 'pdf', date: undefined },
      fallbackName: 'dars-jadvali.pdf',
    })
  })

  it('butun maktab: kind va format', async () => {
    await timetableApi.exportSchool('teachers', 'pdf')
    expect(dl).toHaveBeenLastCalledWith('/timetable/export', {
      params: { kind: 'teachers', format: 'pdf', date: undefined },
      fallbackName: 'dars-jadvali-maktab.pdf',
    })
  })
})
