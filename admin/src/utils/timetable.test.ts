import { describe, expect, it } from 'vitest'
import type { TimetableOptions, TimetableWarning } from '@/api/timetable.api'
import {
  cellKey,
  cellsSignature,
  cellsToPayload,
  clearDay,
  copyDay,
  defaultTeacherFor,
  entriesToCells,
  mondayOf,
  severityOf,
  subjectOptions,
  teacherOptions,
  warningsByCell,
} from './timetable'

const c = (s: string, t: string, room: string | null = null) => ({
  subjectId: s,
  teacherId: t,
  room,
})

describe('timetable utils', () => {
  it('cellsToPayload tartiblaydi va bo`sh xonani null qiladi; signature nomlarga bog`liq emas', () => {
    const cells = { '2:1': c('b', 't2', '  '), '1:3': c('a', 't1', ' 12 '), '1:1': c('a', 't1') }
    expect(cellsToPayload(cells)).toEqual([
      { weekday: 1, lessonNo: 1, subjectId: 'a', teacherId: 't1', room: null },
      { weekday: 1, lessonNo: 3, subjectId: 'a', teacherId: 't1', room: '12' },
      { weekday: 2, lessonNo: 1, subjectId: 'b', teacherId: 't2', room: null },
    ])
    expect(cellsSignature({ '1:1': { ...c('a', 't1'), subjectName: 'X' } })).toBe(
      cellsSignature({ '1:1': { ...c('a', 't1'), subjectName: 'Y' } }),
    )
  })

  it('entriesToCells <-> cellsToPayload', () => {
    const cells = entriesToCells([
      {
        weekday: 3,
        lessonNo: 2,
        subjectId: 's',
        teacherId: 't',
        room: 'A',
        subject: { id: 's', name: 'Fan' },
      },
    ])
    expect(cells[cellKey(3, 2)]).toMatchObject({ subjectName: 'Fan', room: 'A' })
    expect(cellsToPayload(cells)).toHaveLength(1)
  })

  it('copyDay nishon kunni almashtiradi; clearDay faqat o`sha kunni olib tashlaydi', () => {
    const cells = {
      '1:1': c('a', 't1'),
      '1:2': c('b', 't2'),
      '2:1': c('z', 't9'),
      '2:4': c('y', 't9'),
    }
    const out = copyDay(cells, 1, 2, 3)
    expect(Object.keys(out).sort()).toEqual(['1:1', '1:2', '2:1', '2:2'])
    expect(out['2:1']!.subjectId).toBe('a')
    expect(out['2:2']!.subjectId).toBe('b')
    expect(Object.keys(clearDay(cells, 1)).sort()).toEqual(['2:1', '2:4'])
  })

  it('ogohlantirishlar katak bo`yicha, jiddiylik: error ustun', () => {
    const w = (code: TimetableWarning['code'], severity: TimetableWarning['severity']) =>
      ({
        code,
        severity,
        weekday: 1,
        lessonNo: 1,
        subjectId: 's',
        teacherId: 't',
        message: '',
      }) as TimetableWarning
    const map = warningsByCell([
      w('teacher_not_assigned', 'warning'),
      w('teacher_double_booked', 'error'),
    ])
    expect(map['1:1']).toHaveLength(2)
    expect(severityOf(map['1:1'])).toBe('error')
    expect(severityOf([w('out_of_range', 'warning')])).toBe('warning')
    expect(severityOf(undefined)).toBeNull()
  })

  const OPTS: TimetableOptions = {
    subjects: [
      { id: 'a', name: 'Algebra' },
      { id: 'b', name: 'Biologiya' },
      { id: 'c', name: 'Chizmachilik' },
    ],
    teachers: [
      { id: 't1', fullName: 'Zokirov' },
      { id: 't2', fullName: 'Aliyev' },
      { id: 't3', fullName: 'Karimov' },
    ],
    classAssignments: [{ subjectId: 'c', teacherId: 't3' }],
    subjectTeachers: { c: ['t3', 't1'] },
  }

  it('fan: sinfga biriktirilgan birinchi; o`qituvchi: biriktirilgan, shu fan o`qituvchilari, qolganlar', () => {
    expect(subjectOptions(OPTS).map((s) => s.id)).toEqual(['c', 'a', 'b'])
    expect(defaultTeacherFor(OPTS, 'c')).toBe('t3')
    expect(defaultTeacherFor(OPTS, 'a')).toBeNull()
    const groups = teacherOptions(OPTS, 'c')
    expect(groups.map((g) => g.key)).toEqual(['assigned', 'subject', 'all'])
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['t3'])
    expect(groups[1]!.items.map((i) => i.id)).toEqual(['t1'])
    expect(groups[2]!.items.map((i) => i.id)).toEqual(['t2'])
    // fan tanlanmagan: hamma bitta guruhda, alifbo tartibida
    expect(teacherOptions(OPTS, '').flatMap((g) => g.items.map((i) => i.id))).toEqual([
      't2',
      't3',
      't1',
    ])
    // nofaol (ro'yxatda yo'q) o'qituvchi extra orqali qo'shiladi
    expect(
      teacherOptions(OPTS, 'a', [{ id: 'tx', fullName: 'Nofaol' }]).flatMap((g) =>
        g.items.map((i) => i.id),
      ),
    ).toContain('tx')
  })

  it('mondayOf', () => {
    expect(mondayOf('2026-11-04')).toBe('2026-11-02')
    expect(mondayOf('2026-11-08')).toBe('2026-11-02')
    expect(mondayOf('2026-11-02')).toBe('2026-11-02')
  })
})
