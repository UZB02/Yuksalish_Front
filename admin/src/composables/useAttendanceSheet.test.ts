import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attendanceApi } from '@/api/attendance.api'
import type {
  AttendanceRecord,
  AttendanceSettings,
  AttendanceSheet,
  AttendanceSheetStudent,
  AttendanceStatus,
} from '@/api/types'
import { DEFAULT_ATTENDANCE_SETTINGS, useAttendanceSheet } from './useAttendanceSheet'

vi.mock('@/api/attendance.api', () => ({
  attendanceApi: { sheet: vi.fn(), bulk: vi.fn(), list: vi.fn() },
}))

const status = (
  id: string,
  category: AttendanceStatus['category'],
  over: Partial<AttendanceStatus> = {},
): AttendanceStatus => ({
  id,
  schoolId: null,
  name: id,
  shortName: id[0]!.toUpperCase(),
  color: '#16a34a',
  category,
  isDefault: false,
  order: 0,
  isActive: true,
  createdAt: '',
  ...over,
})

const statuses = [
  status('present', 'present', { isDefault: true }),
  status('late', 'late'),
  status('excused', 'absent_excused'),
  status('unexcused', 'absent_unexcused'),
]

const record = (studentId: string, statusId: string, over: Partial<AttendanceRecord> = {}) =>
  ({
    id: `rec-${studentId}`,
    studentId,
    statusId,
    minutesLate: null,
    note: null,
    editable: true,
    markedBy: { id: 't', fullName: 'Ustoz' },
    ...over,
  }) as AttendanceRecord

const student = (id: string, rec: AttendanceRecord | null = null): AttendanceSheetStudent => ({
  studentId: id,
  fullName: `O'quvchi ${id}`,
  studentCode: null,
  record: rec,
})

function sheetOf(
  students: AttendanceSheetStudent[],
  over: Partial<AttendanceSheet> = {},
  settings: Partial<AttendanceSettings> = {},
): AttendanceSheet {
  return {
    class: { id: 'c1', name: '7-A' },
    date: '2026-10-16',
    mode: 'daily',
    lessonNo: null,
    lessonsPerDay: 6,
    isWorkingDay: true,
    settings: { ...DEFAULT_ATTENDANCE_SETTINGS, ...settings },
    statuses,
    students,
    summary: {
      total: students.length,
      marked: 0,
      present: 0,
      late: 0,
      absentExcused: 0,
      absentUnexcused: 0,
    },
    ...over,
  }
}

async function setup(
  students: AttendanceSheetStudent[],
  over: Partial<AttendanceSheet> = {},
  settings: Partial<AttendanceSettings> = {},
) {
  vi.mocked(attendanceApi.sheet).mockResolvedValue(sheetOf(students, over, settings))
  const sh = useAttendanceSheet(() => 'c1')
  await sh.load()
  return sh
}

describe('useAttendanceSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(attendanceApi.list).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 1 },
    })
  })

  it("yuklangach o'zgarish yo'q; holat tanlansa dirty, qayta bosilsa (yozuvsiz) bekor", async () => {
    const sh = await setup([student('1'), student('2')])
    expect(sh.changedCount.value).toBe(0)
    expect(sh.stateOf(sh.rows.value[0]!)).toBe('empty')
    sh.pick('1', 'present')
    expect(sh.changedCount.value).toBe(1)
    expect(sh.stateOf(sh.rows.value[0]!)).toBe('dirty')
    sh.pick('1', 'present') // qayta bosish
    expect(sh.changedCount.value).toBe(0)
    expect(sh.rows.value[0]!.draft.statusId).toBeNull()
  })

  it("saqlangan yozuv qayta bosilganda bekor qilinmaydi, boshqa holatga o'tkazish mumkin", async () => {
    const sh = await setup([student('1', record('1', 'present'))])
    expect(sh.stateOf(sh.rows.value[0]!)).toBe('saved')
    sh.pick('1', 'present')
    expect(sh.rows.value[0]!.draft.statusId).toBe('present')
    sh.pick('1', 'excused')
    expect(sh.changedCount.value).toBe(1)
  })

  it('tezkor tugmalar: hammasi keldi (default) va qolganlari; qulflanganlarga tegmaydi', async () => {
    const sh = await setup([
      student('1'),
      student('2', record('2', 'excused')),
      student('3', record('3', 'unexcused', { editable: false })),
      student('4'),
    ])
    expect(sh.defaultStatus.value?.id).toBe('present')
    sh.pick('4', 'late')
    sh.markRemainingDefault() // faqat tanlanmagan: 1 (4 allaqachon late, 2 yozuvli)
    expect(sh.rows.value.map((r) => r.draft.statusId)).toEqual([
      'present',
      'excused',
      'unexcused',
      'late',
    ])
    sh.markAllDefault() // hamma tahrirlanadiganlarga
    expect(sh.rows.value.map((r) => r.draft.statusId)).toEqual([
      'present',
      'present',
      'unexcused', // qulflangan
      'present',
    ])
  })

  it("kechikish daqiqasi: faqat late kategoriyasida, 1..600; boshqa holatga o'tganda tozalanadi", async () => {
    const sh = await setup([student('1')])
    sh.pick('1', 'late')
    sh.patch('1', { minutesLate: '700' })
    expect(sh.errorsOf(sh.rows.value[0]!).minutes).toBe('minutesRange')
    sh.patch('1', { minutesLate: '15' })
    expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
    expect(sh.buildItems()[0]).toMatchObject({ statusId: 'late', minutesLate: 15 })
    sh.pick('1', 'present')
    expect(sh.rows.value[0]!.draft.minutesLate).toBe('')
    expect(sh.buildItems()[0]).toMatchObject({ statusId: 'present', minutesLate: null })
  })

  it("izoh majburiy kategoriyalar: bo'sh izohda xato, to'ldirilsa tuzaladi; 300 dan uzun rad", async () => {
    const sh = await setup([student('1')], {}, { noteRequiredCategories: ['absent_excused'] })
    sh.pick('1', 'excused')
    expect(sh.errorsOf(sh.rows.value[0]!).note).toBe('noteRequired')
    expect(sh.canSave.value).toBe(false)
    sh.patch('1', { note: 'Kasal' })
    expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
    expect(sh.canSave.value).toBe(true)
    sh.patch('1', { note: 'x'.repeat(301) })
    expect(sh.errorsOf(sh.rows.value[0]!).note).toBe('noteTooLong')
    // boshqa kategoriyada izoh majburiy emas
    sh.pick('1', 'present')
    sh.patch('1', { note: '' })
    expect(sh.errorsOf(sh.rows.value[0]!)).toEqual({})
  })

  it('ish kuni emas: saqlash bloklanadi', async () => {
    const sh = await setup([student('1')], { isWorkingDay: false })
    sh.pick('1', 'present')
    expect(sh.changedCount.value).toBe(1)
    expect(sh.canSave.value).toBe(false)
  })

  it("bulk payload faqat o'zgargan va to'g'ri qatorlar; tanlanmagan qator yuborilmaydi", async () => {
    const sh = await setup([
      student('1', record('1', 'present')),
      student('2'),
      student('3'),
      student('4', record('4', 'late', { minutesLate: 5 })),
    ])
    sh.pick('1', 'excused')
    sh.patch('1', { note: 'Shifokor' })
    sh.pick('2', 'present')
    // 3 - tanlanmagan; 4 - o'zgarmagan
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 1, failed: [] })
    await sh.save()
    expect(attendanceApi.bulk).toHaveBeenCalledWith({
      classId: 'c1',
      date: sh.date.value,
      items: [
        { studentId: '1', statusId: 'excused', minutesLate: null, note: 'Shifokor' },
        { studentId: '2', statusId: 'present', minutesLate: null, note: null },
      ],
    })
  })

  it('failed qatorlar sabab bilan qoladi, qolganlari saqlangan', async () => {
    const sh = await setup([student('1'), student('2')])
    sh.pick('1', 'present')
    sh.pick('2', 'present')
    vi.mocked(attendanceApi.bulk).mockResolvedValue({
      created: 1,
      updated: 0,
      failed: [{ studentId: '2', code: 'FORBIDDEN', message: "Tahrirlash vaqti o'tgan" }],
    })
    vi.mocked(attendanceApi.sheet).mockResolvedValue(
      sheetOf([student('1', record('1', 'present')), student('2')]),
    )
    await sh.save()
    const [r1, r2] = sh.rows.value
    expect(sh.stateOf(r1!)).toBe('saved')
    expect(sh.stateOf(r2!)).toBe('error')
    expect(r2!.serverError).toBe("Tahrirlash vaqti o'tgan")
    expect(r2!.draft.statusId).toBe('present') // qoralama yo'qolmadi
    sh.pick('2', 'late')
    expect(r2!.serverError).toBeNull()
  })

  it("editable=false qator qulflangan va o'zgarmaydi", async () => {
    const sh = await setup([student('1', record('1', 'present', { editable: false }))])
    expect(sh.stateOf(sh.rows.value[0]!)).toBe('locked')
    sh.pick('1', 'late')
    expect(sh.rows.value[0]!.draft.statusId).toBe('present')
    expect(sh.changedCount.value).toBe(0)
  })

  it("jonli statistika: keldi/kechikdi/yo'q/olinmagan", async () => {
    const sh = await setup([
      student('1'),
      student('2'),
      student('3'),
      student('4', record('4', 'excused')),
    ])
    sh.pick('1', 'present')
    sh.pick('2', 'late')
    expect(sh.live.value).toEqual({ present: 1, late: 1, absent: 1, unmarked: 1 })
  })

  it("dars rejimi: 1-dars avtomatik, dars almashtirish yangi so'rov va lessonNo yuboradi", async () => {
    vi.mocked(attendanceApi.sheet).mockImplementation(async (_id, params) =>
      sheetOf([student('1')], {
        mode: 'lesson',
        lessonsPerDay: 3,
        lessonNo: params?.lessonNo ?? null,
      }),
    )
    const sh = useAttendanceSheet(() => 'c1')
    await sh.load()
    expect(sh.mode.value).toBe('lesson')
    expect(sh.lessonNo.value).toBe(1)
    expect(vi.mocked(attendanceApi.sheet).mock.calls.at(-1)![1]).toMatchObject({ lessonNo: 1 })
    await sh.goTo({ lessonNo: 3 })
    expect(vi.mocked(attendanceApi.sheet).mock.calls.at(-1)![1]).toMatchObject({ lessonNo: 3 })
    sh.pick('1', 'present')
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    await sh.save()
    expect(vi.mocked(attendanceApi.bulk).mock.calls[0]![0]).toMatchObject({ lessonNo: 3 })
  })

  it("dars chiplari to'ldirilganligi: har dars uchun belgilanganlar soni", async () => {
    vi.mocked(attendanceApi.sheet).mockResolvedValue(
      sheetOf([student('1'), student('2')], { mode: 'lesson', lessonsPerDay: 2, lessonNo: 1 }),
    )
    vi.mocked(attendanceApi.list).mockImplementation(async (p) => ({
      items: [],
      meta: { page: 1, limit: 1, total: p?.lessonNo === 1 ? 2 : 0, totalPages: 1 },
    }))
    const sh = useAttendanceSheet(() => 'c1')
    await sh.load()
    await vi.waitFor(() => expect(sh.lessonMarked.value).toEqual({ 1: 2, 2: 0 }))
  })

  it('kunlik rejimda lessonNo yuborilmaydi', async () => {
    const sh = await setup([student('1')])
    sh.pick('1', 'present')
    vi.mocked(attendanceApi.bulk).mockResolvedValue({ created: 1, updated: 0, failed: [] })
    await sh.save()
    expect(vi.mocked(attendanceApi.bulk).mock.calls[0]![0]).not.toHaveProperty('lessonNo')
  })

  it('discard hamma qoralamani asliga qaytaradi', async () => {
    const sh = await setup([student('1', record('1', 'present'))])
    sh.pick('1', 'excused')
    sh.discard()
    expect(sh.hasUnsaved.value).toBe(false)
    expect(sh.rows.value[0]!.draft.statusId).toBe('present')
  })

  describe("init: boshlang'ich sana", () => {
    // 2026-10-18 - yakshanba
    const SUNDAY = '2026-10-18'
    const setupInit = (queryDate?: string | null, working = [1, 2, 3, 4, 5, 6]) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-18T07:00:00Z'))
      vi.mocked(attendanceApi.sheet).mockImplementation(async (_id, params) =>
        sheetOf(
          [student('1')],
          {
            date: params!.date,
            isWorkingDay: working.includes(
              ((new Date(params!.date + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1,
            ),
          },
          { workingWeekdays: working, backdateDays: 3 },
        ),
      )
      const sh = useAttendanceSheet(() => 'c1')
      return { sh, run: () => sh.init(queryDate) }
    }

    afterEach(() => vi.useRealTimers())

    it("bugun yakshanba (dam) bo'lsa eng yaqin oldingi ish kuni (shanba) ochiladi", async () => {
      const { sh, run } = setupInit()
      expect(sh.date.value).toBe(SUNDAY)
      await run()
      expect(sh.date.value).toBe('2026-10-17')
      expect(sh.isWorkingDay.value).toBe(true)
      expect(vi.mocked(attendanceApi.sheet)).toHaveBeenCalledTimes(2)
    })

    it("bugun ish kuni bo'lsa qayta yuklanmaydi", async () => {
      const { sh, run } = setupInit(null, [1, 2, 3, 4, 5, 6, 7])
      await run()
      expect(sh.date.value).toBe(SUNDAY)
      expect(vi.mocked(attendanceApi.sheet)).toHaveBeenCalledTimes(1)
    })

    it("?date= berilsa unga hurmat: yakshanba bo'lsa ham o'tilmaydi (ogohlantirish qoladi)", async () => {
      const { sh, run } = setupInit(SUNDAY)
      await run()
      expect(sh.date.value).toBe(SUNDAY)
      expect(sh.isWorkingDay.value).toBe(false)
      expect(vi.mocked(attendanceApi.sheet)).toHaveBeenCalledTimes(1)
      const { sh: sh2, run: run2 } = setupInit('2026-10-14')
      await run2()
      expect(sh2.date.value).toBe('2026-10-14')
    })

    it("noto'g'ri ?date= e'tiborsiz qoldiriladi", async () => {
      const { sh, run } = setupInit('kecha')
      await run()
      expect(sh.date.value).toBe('2026-10-17')
    })

    it("backdateDays ichida ish kuni bo'lmasa bugun qoladi", async () => {
      const { sh, run } = setupInit(null, [1])
      await run()
      expect(sh.date.value).toBe(SUNDAY)
    })
  })
})
