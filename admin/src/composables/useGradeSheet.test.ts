import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gradesApi } from '@/api/grades.api'
import type { GradeSheet, GradeSheetStudent } from '@/api/types'
import { gradeTo100, gradeTone, validateGradeDraft } from '@/utils/grades'
import { useGradeSheet } from './useGradeSheet'

vi.mock('@/api/grades.api', () => ({ gradesApi: { sheet: vi.fn(), bulk: vi.fn() } }))

function student(id: string, over: Partial<GradeSheetStudent> = {}): GradeSheetStudent {
  return {
    studentId: id,
    fullName: `O'quvchi ${id}`,
    studentCode: null,
    grade: null,
    alreadyGraded: false,
    ...over,
  }
}

function graded(id: string, value: number, editable = true): GradeSheetStudent {
  return student(id, {
    alreadyGraded: true,
    grade: {
      id: `g-${id}`,
      studentId: id,
      value,
      comment: null,
      editable,
      teacher: { id: 't1', fullName: 'Aliyev A.' },
    } as never,
  })
}

const sheetOf = (students: GradeSheetStudent[]): GradeSheet => ({
  class: { id: 'c1', name: '7-A' },
  subject: { id: 's1', name: 'Matematika' },
  date: '2026-10-16',
  lessonNo: 0,
  hasTimetable: false,
  lessons: [],
  settings: { editWindowHours: 24, backdateDays: 3 },
  students,
})

async function setup(students: GradeSheetStudent[]) {
  vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf(students))
  const sh = useGradeSheet(
    () => 'c1',
    () => 's1',
  )
  await sh.load()
  return sh
}

describe('useGradeSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('yuklangach: nom, "allaqachon baholangan" qatorlar va progress', async () => {
    const sh = await setup([graded('1', 5), student('2'), student('3')])
    expect(sh.className.value).toBe('7-A')
    expect(sh.subjectName.value).toBe('Matematika')
    expect(sh.changedCount.value).toBe(0)
    expect(sh.gradedCount.value).toBe(1)
    expect(sh.total.value).toBe(3)
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('saved')
    expect(sh.rows.value[0]!.gradedBy).toBe('Aliyev A.')
    expect(sh.statusOf(sh.rows.value[1]!)).toBe('empty')
    expect(sh.canSave.value).toBe(false)
  })

  it("sinf yoki fan tanlanmagan bo'lsa so'rov yuborilmaydi", async () => {
    const sh = useGradeSheet(
      () => '',
      () => 's1',
    )
    await sh.load()
    expect(gradesApi.sheet).not.toHaveBeenCalled()
    expect(sh.rows.value).toEqual([])
  })

  it('tez baho tanlash: dirty, asl holatga qaytsa o`zgarish emas', async () => {
    const sh = await setup([graded('1', 4), student('2')])
    sh.patch('1', { value: 5 })
    expect(sh.isDirty(sh.rows.value[0]!)).toBe(true)
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('dirty')
    sh.patch('1', { value: 4 })
    expect(sh.changedCount.value).toBe(0)
    sh.patch('2', { value: 3 })
    expect(sh.changedCount.value).toBe(1)
    expect(sh.canSave.value).toBe(true)
  })

  it("faqat o'zgargan qatorlar yuboriladi (comment bo'sh -> null)", async () => {
    const sh = await setup([graded('1', 4), student('2'), student('3')])
    sh.patch('2', { value: 5, comment: '  a`lo  ' })
    sh.patch('3', { comment: 'faqat izoh' }) // qiymatsiz: xato qator, yuborilmaydi
    expect(sh.invalidDirty.value).toHaveLength(1)
    expect(sh.canSave.value).toBe(false)
    sh.patch('3', { comment: '' })
    expect(sh.buildItems()).toEqual([{ studentId: '2', value: 5, comment: 'a`lo' }])
    vi.mocked(gradesApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    const res = await sh.save()
    expect(res?.created).toBe(1)
    expect(gradesApi.bulk).toHaveBeenCalledWith({
      classId: 'c1',
      subjectId: 's1',
      date: expect.any(String),
      lessonNo: 0,
      items: [{ studentId: '2', value: 5, comment: 'a`lo' }],
    })
  })

  it("qulflangan (tahrir oynasi o'tgan) qator o'zgarmaydi", async () => {
    const sh = await setup([graded('1', 4, false)])
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('locked')
    sh.patch('1', { value: 2 })
    expect(sh.changedCount.value).toBe(0)
    expect(sh.rows.value[0]!.draft.value).toBe(4)
  })

  it('bulk xatosi qatorda ko`rinadi, qoralama saqlanadi', async () => {
    const sh = await setup([student('1')])
    sh.patch('1', { value: 3 })
    vi.mocked(gradesApi.bulk).mockResolvedValue({
      created: 0,
      updated: 0,
      failed: [{ studentId: '1', code: 'CONFLICT', message: 'Band' }],
    })
    // qayta yuklashda ham qoralama yo'qolmaydi
    vi.mocked(gradesApi.sheet).mockResolvedValue(sheetOf([student('1')]))
    await sh.save()
    expect(sh.rows.value[0]!.serverError).toBe('Band')
    expect(sh.rows.value[0]!.draft.value).toBe(3)
    expect(sh.statusOf(sh.rows.value[0]!)).toBe('error')
  })
})

describe('utils/grades', () => {
  it('validateGradeDraft: 2–5 majburiy, izoh uzunligi', () => {
    expect(validateGradeDraft({ value: null, comment: '' })).toEqual({ value: 'required' })
    expect(validateGradeDraft({ value: 1, comment: '' })).toEqual({ value: 'range' })
    expect(validateGradeDraft({ value: 6, comment: '' })).toEqual({ value: 'range' })
    expect(validateGradeDraft({ value: 4, comment: '' })).toEqual({})
    expect(validateGradeDraft({ value: 4, comment: 'x'.repeat(501) })).toEqual({
      comment: 'commentTooLong',
    })
  })

  it('gradeTo100 va rang', () => {
    expect(gradeTo100(5)).toBe(100)
    expect(gradeTo100(4)).toBe(80)
    expect(gradeTo100(4.35)).toBe(87)
    expect(gradeTone(5)).toBe('success')
    expect(gradeTone(2)).toBe('danger')
    expect(gradeTone(null)).toBe('neutral')
  })
})

describe('useGradeSheet: darslar', () => {
  beforeEach(() => vi.clearAllMocks())

  const lessonOf = (lessonNo: number, over = {}) => ({
    lessonNo,
    teacher: { id: 't1', fullName: 'Aliyev A.' },
    cancelled: false,
    room: null,
    mine: true,
    ...over,
  })
  const withLessons = (
    lessonNo: number | null,
    lessons: ReturnType<typeof lessonOf>[],
    students = [student('1')],
  ): GradeSheet => ({
    ...sheetOf(students),
    lessonNo,
    hasTimetable: true,
    lessons,
  })

  it('dars yo`q: lessonNo 0, tanlagich kerak emas, payload lessonNo: 0', async () => {
    const sh = await setup([student('1')])
    expect(sh.lessons.value).toEqual([])
    expect(sh.lessonNo.value).toBe(0)
    expect(sh.needsLesson.value).toBe(false)
    sh.patch('1', { value: 4 })
    vi.mocked(gradesApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    await sh.save()
    expect(vi.mocked(gradesApi.bulk).mock.calls[0]![0]).toMatchObject({ lessonNo: 0 })
  })

  it('bitta dars: server aniqlaydi, payloadda shu dars', async () => {
    vi.mocked(gradesApi.sheet).mockResolvedValue(withLessons(2, [lessonOf(2)]))
    const sh = useGradeSheet(
      () => 'c1',
      () => 's1',
    )
    await sh.load()
    expect(sh.lessonNo.value).toBe(2)
    expect(sh.needsLesson.value).toBe(false)
    sh.patch('1', { value: 5 })
    vi.mocked(gradesApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    await sh.save()
    expect(vi.mocked(gradesApi.bulk).mock.calls[0]![0]).toMatchObject({ lessonNo: 2 })
  })

  it('bir nechta dars: tanlanmaguncha saqlab bo`lmaydi; tanlansa varaq shu dars uchun yuklanadi', async () => {
    const many = [lessonOf(1), lessonOf(3)]
    vi.mocked(gradesApi.sheet).mockResolvedValueOnce(withLessons(null, many))
    const sh = useGradeSheet(
      () => 'c1',
      () => 's1',
    )
    await sh.load()
    expect(sh.lessonNo.value).toBeNull()
    expect(sh.needsLesson.value).toBe(true)
    sh.patch('1', { value: 4 })
    expect(sh.canSave.value).toBe(false)
    expect(await sh.save()).toBeNull()
    expect(gradesApi.bulk).not.toHaveBeenCalled()

    vi.mocked(gradesApi.sheet).mockResolvedValue(withLessons(3, many))
    await sh.pickLesson(3)
    expect(vi.mocked(gradesApi.sheet).mock.calls.at(-1)).toEqual([
      'c1',
      's1',
      expect.any(String),
      3,
    ])
    expect(sh.lessonNo.value).toBe(3)
    expect(sh.needsLesson.value).toBe(false)
  })
})
