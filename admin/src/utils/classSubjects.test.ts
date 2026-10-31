import { describe, expect, it } from 'vitest'
import type { ClassSubjectAssignment } from '@/api/types'
import { groupBySubject, hasDuplicatePair, subjectTeachersLabel } from './classSubjects'

const A = (subjectId: string, subject: string, teacherId: string, teacher: string) =>
  ({
    subjectId,
    subject: { id: subjectId, name: subject },
    teacherId,
    teacher: { id: teacherId, fullName: teacher },
  }) as ClassSubjectAssignment

describe('classSubjects', () => {
  it("bir fanning o'qituvchilari birga: Ingliz tili — Aliyeva, G'aniyeva", () => {
    const groups = groupBySubject([
      A('eng', 'Ingliz tili', 'ga', "G'aniyeva"),
      A('math', 'Matematika', 'm', 'Karimov'),
      A('eng', 'Ingliz tili', 'al', 'Aliyeva'),
    ])
    expect(groups.map((g) => g.name)).toEqual(['Ingliz tili', 'Matematika'])
    expect(subjectTeachersLabel(groups[0]!)).toBe("Ingliz tili — Aliyeva, G'aniyeva")
    expect(subjectTeachersLabel(groups[1]!)).toBe('Matematika — Karimov')
    expect(groupBySubject(undefined)).toEqual([])
  })

  it("aynan bir xil (fan, o'qituvchi) juftligi takror; to'liq bo'lmagan qatorlar hisobga olinmaydi", () => {
    expect(
      hasDuplicatePair([
        { subjectId: 'eng', teacherId: 'al' },
        { subjectId: 'eng', teacherId: 'ga' },
      ]),
    ).toBe(false)
    expect(
      hasDuplicatePair([
        { subjectId: 'eng', teacherId: 'al' },
        { subjectId: 'eng', teacherId: 'al' },
      ]),
    ).toBe(true)
    expect(
      hasDuplicatePair([
        { subjectId: 'eng', teacherId: '' },
        { subjectId: 'eng', teacherId: '' },
      ]),
    ).toBe(false)
  })
})
