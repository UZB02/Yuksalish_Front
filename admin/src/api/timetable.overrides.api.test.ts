import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteData, getData, sendData } from './http'
import { timetableApi } from './timetable.api'

vi.mock('./http', () => ({ getData: vi.fn(), sendData: vi.fn(), deleteData: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('timetableApi: almashtirishlar', () => {
  it("o'qituvchi kuni, o'zgarishlar va bo'sh o'qituvchilar so'rovlari", async () => {
    await timetableApi.teacherDay('2026-11-02', 't1')
    expect(getData).toHaveBeenLastCalledWith('/timetable/teacher-day', {
      date: '2026-11-02',
      teacherId: 't1',
    })
    await timetableApi.overrides('2026-11-02')
    expect(getData).toHaveBeenLastCalledWith('/timetable/overrides', { date: '2026-11-02' })
    await timetableApi.freeTeachers('2026-11-02', 3, 'math')
    expect(getData).toHaveBeenLastCalledWith('/timetable/free-teachers', {
      date: '2026-11-02',
      lessonNo: 3,
      subjectId: 'math',
    })
  })

  it('yaratish, ko`chirish va o`chirish', async () => {
    const body = { classId: 'c1', date: '2026-11-02', lessonNo: 2, type: 'cancel' as const }
    await timetableApi.createOverride(body)
    expect(sendData).toHaveBeenLastCalledWith('post', '/timetable/overrides', body)
    const mv = {
      classId: 'c1',
      from: { date: '2026-11-02', lessonNo: 2 },
      to: { date: '2026-11-03', lessonNo: 4 },
    }
    await timetableApi.moveLesson(mv)
    expect(sendData).toHaveBeenLastCalledWith('post', '/timetable/overrides/move', mv)
    await timetableApi.deleteOverride('o1')
    expect(deleteData).toHaveBeenLastCalledWith('/timetable/overrides/o1')
  })
})
