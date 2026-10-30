import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  timetableApi,
  type ClassVersions,
  type TimetableOptions,
  type TimetableVersion,
  type TimetableWarning,
} from '@/api/timetable.api'
import { useTimetableEditor } from './useTimetableEditor'

vi.mock('@/api/timetable.api', () => ({
  timetableApi: {
    versions: vi.fn(),
    options: vi.fn(),
    version: vi.fn(),
    saveDraft: vi.fn(),
    correct: vi.fn(),
    createVersion: vi.fn(),
    deleteVersion: vi.fn(),
    activate: vi.fn(),
  },
}))

const api = vi.mocked(timetableApi)

const OPTIONS: TimetableOptions = {
  subjects: [
    { id: 'math', name: 'Matematika' },
    { id: 'eng', name: 'Ingliz tili' },
  ],
  teachers: [
    { id: 't1', fullName: 'Aliyev' },
    { id: 't2', fullName: 'Karimov' },
  ],
  classAssignments: [{ subjectId: 'math', teacherId: 't1' }],
  subjectTeachers: { math: ['t1'] },
}

const summary = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  classId: 'c1',
  status: 'active',
  phase: 'current',
  validFrom: '2026-09-01',
  validTo: null,
  entryCount: 1,
  note: null,
  forced: false,
  activatedAt: null,
  updatedAt: '2026-10-01T00:00:00Z',
  ...over,
})

const INFO = (versions: ReturnType<typeof summary>[]): ClassVersions =>
  ({
    class: { id: 'c1', name: '5-A', grade: 5, isArchived: false },
    academicYear: { id: 'y', name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-01' },
    settings: { workingWeekdays: [1, 2, 3], lessonsPerDay: 3 },
    today: '2026-10-30',
    versions,
  }) as ClassVersions

const version = (id: string, over: Partial<TimetableVersion> = {}): TimetableVersion =>
  ({
    ...summary(id),
    academicYearId: 'y',
    weekPattern: 'weekly',
    basedOnVersionId: null,
    entries: [
      {
        weekday: 1,
        lessonNo: 1,
        subjectId: 'math',
        teacherId: 't1',
        room: null,
        subject: { id: 'math', name: 'Matematika' },
        teacher: { id: 't1', fullName: 'Aliyev' },
      },
    ],
    ...over,
  }) as TimetableVersion

const W = (over: Partial<TimetableWarning> = {}): TimetableWarning => ({
  code: 'teacher_double_booked',
  severity: 'error',
  weekday: 1,
  lessonNo: 1,
  subjectId: 'math',
  teacherId: 't1',
  message: "To'qnashuv",
  ...over,
})

async function setup(
  opts: { manage?: boolean; draft?: boolean; warnings?: TimetableWarning[] } = {},
) {
  const manage = opts.manage ?? true
  const draft = opts.draft ?? true
  const list = draft
    ? [summary('d1', { status: 'draft', phase: 'draft' }), summary('a1')]
    : [summary('a1')]
  api.versions.mockResolvedValue(INFO(list))
  api.options.mockResolvedValue(OPTIONS)
  api.version.mockImplementation(async (id: string) => ({
    version: version(id, draft && id === 'd1' ? { status: 'draft', phase: 'draft' } : {}),
    warnings: opts.warnings ?? [],
  }))
  const ed = useTimetableEditor(
    () => 'c1',
    () => manage,
  )
  await ed.load()
  return ed
}

describe('useTimetableEditor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('yuklash: boshqaruvchi qoralamani, boshqalar joriy versiyani ochadi', async () => {
    const ed = await setup()
    expect(ed.version.value?.id).toBe('d1')
    expect(ed.mode.value).toBe('draft')
    expect(ed.editable.value).toBe(true)
    expect(Object.keys(ed.cells.value)).toEqual(['1:1'])
    expect(ed.dirty.value).toBe(false)
    expect(api.options).toHaveBeenCalledWith('c1')

    const viewer = await setup({ manage: false })
    expect(viewer.version.value?.id).toBe('a1')
    expect(viewer.mode.value).toBe('readonly')
    expect(viewer.options.value).toBeNull()
    expect(api.options).toHaveBeenCalledTimes(1)
  })

  it('katak tahriri: dirty, asl holatga qaytsa dirty emas; faqat tahrirlanadigan rejimda', async () => {
    const ed = await setup()
    ed.setCell(2, 1, { subjectId: 'eng', teacherId: 't2', room: null, subjectName: 'Ingliz tili' })
    expect(ed.dirty.value).toBe(true)
    expect(ed.changeCount.value).toBe(1)
    ed.setCell(2, 1, null)
    expect(ed.dirty.value).toBe(false)
    ed.setCell(1, 1, { subjectId: 'eng', teacherId: 't2', room: '12' })
    expect(ed.changeCount.value).toBe(1)
    ed.discard()
    expect(ed.dirty.value).toBe(false)
    expect(ed.cells.value['1:1']?.subjectId).toBe('math')

    const ro = await setup({ manage: false })
    ro.setCell(2, 1, { subjectId: 'eng', teacherId: 't2', room: null })
    expect(Object.keys(ro.cells.value)).toEqual(['1:1'])
  })

  it('kunni nusxalash va tozalash', async () => {
    const ed = await setup()
    ed.setCell(1, 2, { subjectId: 'eng', teacherId: 't2', room: null })
    ed.copyDayTo(1, 3)
    expect(Object.keys(ed.cells.value).sort()).toEqual(['1:1', '1:2', '3:1', '3:2'])
    ed.copyDayTo(1, 1) // o'ziga nusxa — hech narsa
    expect(Object.keys(ed.cells.value)).toHaveLength(4)
    ed.clearDayOf(1)
    expect(Object.keys(ed.cells.value).sort()).toEqual(['3:1', '3:2'])
    expect(ed.dirty.value).toBe(true)
  })

  it('qoralamani saqlash: tartiblangan yozuvlar, validFrom va izoh yuboriladi; dirty tozalanadi', async () => {
    const ed = await setup()
    ed.setCell(3, 2, { subjectId: 'eng', teacherId: 't2', room: ' 5 ' })
    ed.setCell(2, 1, { subjectId: 'math', teacherId: 't1', room: '' })
    ed.validFrom.value = '2026-11-09'
    api.saveDraft.mockResolvedValue({
      version: version('d1', {
        status: 'draft',
        phase: 'draft',
        validFrom: '2026-11-09',
        entries: [
          { weekday: 1, lessonNo: 1, subjectId: 'math', teacherId: 't1', room: null },
          { weekday: 2, lessonNo: 1, subjectId: 'math', teacherId: 't1', room: null },
          { weekday: 3, lessonNo: 2, subjectId: 'eng', teacherId: 't2', room: '5' },
        ],
      }),
      warnings: [W({ weekday: 3, lessonNo: 2 })],
    })
    api.versions.mockResolvedValue(INFO([summary('d1', { status: 'draft', phase: 'draft' })]))
    await ed.save()
    expect(api.saveDraft).toHaveBeenCalledWith('d1', {
      entries: [
        { weekday: 1, lessonNo: 1, subjectId: 'math', teacherId: 't1', room: null },
        { weekday: 2, lessonNo: 1, subjectId: 'math', teacherId: 't1', room: null },
        { weekday: 3, lessonNo: 2, subjectId: 'eng', teacherId: 't2', room: '5' },
      ],
      validFrom: '2026-11-09',
      note: null,
    })
    expect(ed.dirty.value).toBe(false)
    expect(ed.warnings.value).toHaveLength(1)
  })

  it("ogohlantirishlar katak bo'yicha, tahrirlanganda eskirgani olib tashlanadi, bekor qilinsa tiklanadi", async () => {
    const ed = await setup({
      warnings: [
        W(),
        W({ code: 'teacher_not_assigned', severity: 'warning', weekday: 2, lessonNo: 1 }),
      ],
    })
    expect(ed.cellSeverity(1, 1)).toBe('error')
    expect(ed.cellSeverity(2, 1)).toBe('warning')
    expect(ed.cellSeverity(3, 3)).toBeNull()
    expect(ed.blockingCount.value).toBe(1)
    ed.setCell(1, 1, { subjectId: 'eng', teacherId: 't2', room: null })
    expect(ed.cellSeverity(1, 1)).toBeNull()
    expect(ed.warnings.value).toHaveLength(1)
    ed.discard()
    expect(ed.warnings.value).toHaveLength(2)
  })

  it("sozlamadan tashqari kataklar: kun va dars qatori ko'rsatiladi", async () => {
    api.versions.mockResolvedValue(INFO([summary('d1', { status: 'draft', phase: 'draft' })]))
    api.options.mockResolvedValue(OPTIONS)
    api.version.mockResolvedValue({
      version: version('d1', {
        status: 'draft',
        phase: 'draft',
        entries: [
          { weekday: 6, lessonNo: 2, subjectId: 'math', teacherId: 't1', room: null },
          { weekday: 1, lessonNo: 5, subjectId: 'math', teacherId: 't1', room: null },
        ],
      }),
      warnings: [],
    })
    const ed = useTimetableEditor(
      () => 'c1',
      () => true,
    )
    await ed.load()
    expect(ed.outOfRangeKeys.value.sort()).toEqual(['1:5', '6:2'])
    expect(ed.gridWeekdays.value).toEqual([1, 2, 3, 6])
    expect(ed.gridLessons.value).toBe(5)
  })

  it('tuzatish rejimi: faol versiya correct orqali, force/izoh bilan', async () => {
    const ed = await setup({ draft: false })
    expect(ed.mode.value).toBe('view')
    ed.setCell(2, 1, { subjectId: 'eng', teacherId: 't2', room: null })
    expect(Object.keys(ed.cells.value)).toEqual(['1:1']) // tuzatish boshlanmagan
    ed.startCorrect()
    expect(ed.mode.value).toBe('correct')
    ed.setCell(2, 1, { subjectId: 'eng', teacherId: 't2', room: null })
    api.correct.mockResolvedValue({ version: version('a1'), warnings: [] })
    await ed.save({ force: true, note: 'sabab' })
    expect(api.correct).toHaveBeenCalledWith('a1', {
      entries: expect.arrayContaining([expect.objectContaining({ weekday: 2, lessonNo: 1 })]),
      force: true,
      note: 'sabab',
    })
    expect(ed.mode.value).toBe('view')
    ed.startCorrect()
    ed.cancelCorrect()
    expect(ed.mode.value).toBe('view')
  })

  it("o'tgan versiya tuzatilmaydi; arxiv sinf faqat o'qish", async () => {
    api.versions.mockResolvedValue(INFO([summary('p1', { phase: 'past', status: 'superseded' })]))
    api.options.mockResolvedValue(OPTIONS)
    api.version.mockResolvedValue({
      version: version('p1', { phase: 'past', status: 'superseded' }),
      warnings: [],
    })
    const ed = useTimetableEditor(
      () => 'c1',
      () => true,
    )
    await ed.load()
    ed.startCorrect()
    expect(ed.mode.value).toBe('view')

    const info = INFO([summary('d1', { status: 'draft', phase: 'draft' })])
    info.class.isArchived = true
    api.versions.mockResolvedValue(info)
    api.version.mockResolvedValue({
      version: version('d1', { status: 'draft', phase: 'draft' }),
      warnings: [],
    })
    const arch = useTimetableEditor(
      () => 'c1',
      () => true,
    )
    await arch.load()
    expect(arch.mode.value).toBe('readonly')
  })

  it("yangi o'zgarish, faollashtirish va o'chirish API ga to'g'ri yo'naltiriladi", async () => {
    const ed = await setup({ draft: false })
    api.createVersion.mockResolvedValue({
      version: version('d2', { status: 'draft', phase: 'draft' }),
      warnings: [],
    })
    api.versions.mockResolvedValue(INFO([summary('d2', { status: 'draft', phase: 'draft' })]))
    await ed.createChange('active')
    expect(api.createVersion).toHaveBeenCalledWith('c1', {
      copyFrom: 'active',
      validFrom: undefined,
    })
    expect(ed.mode.value).toBe('draft')

    api.activate.mockResolvedValue({
      version: version('d2'),
      warnings: [],
      syncedAssignments: [],
    })
    await ed.activate({ validFrom: '2026-11-02', syncAssignments: true })
    expect(api.activate).toHaveBeenCalledWith('d2', {
      validFrom: '2026-11-02',
      syncAssignments: true,
    })

    api.deleteVersion.mockResolvedValue({ deleted: true })
    await ed.removeVersion('d2')
    expect(api.deleteVersion).toHaveBeenCalledWith('d2')
  })

  it('yuklash xatosi error ga yoziladi', async () => {
    api.versions.mockRejectedValue(new Error('boom'))
    api.options.mockResolvedValue(OPTIONS)
    const ed = useTimetableEditor(
      () => 'c1',
      () => true,
    )
    await ed.load()
    expect(ed.error.value).toBeTruthy()
    expect(ed.loading.value).toBe(false)
  })
})
