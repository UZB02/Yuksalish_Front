import { describe, expect, it } from 'vitest'
import type { Teacher } from '@/api/types'
import { buildWorkload, splitChips, workloadChips } from './teacherWorkload'

const asg = (classId: string, className: string, subjectId: string, subjectName: string) => ({
  classId,
  className,
  subjectId,
  subjectName,
})
const cls = (id: string, name: string) => ({ id, name })

describe('buildWorkload', () => {
  it('bir xil fanni sinflar bo`yicha bitta guruhga yig`adi (tabiiy tartib)', () => {
    const t: Pick<Teacher, 'classes' | 'subjectAssignments'> = {
      classes: [cls('c1', '1-A'), cls('c2', '2-A'), cls('c10', '10-A')],
      subjectAssignments: [
        asg('c10', '10-A', 'inf', 'Informatika'),
        asg('c1', '1-A', 'inf', 'Informatika'),
        asg('c2', '2-A', 'inf', 'Informatika'),
        asg('c1', '1-A', 'mat', 'Matematika'),
      ],
    }
    const w = buildWorkload(t)
    expect(w.subjects.map((s) => s.subjectName)).toEqual(['Informatika', 'Matematika'])
    expect(w.subjects[0]!.classes.map((c) => c.name)).toEqual(['1-A', '2-A', '10-A'])
    expect(w.classesTotal).toBe(3)
    expect(w.noSubject).toEqual([])
  })

  it('rahbarlik va fansiz sinflarni ajratadi; jami farqli sinflarni sanaydi', () => {
    const w = buildWorkload({
      classes: [cls('c1', '1-A'), cls('c2', '1-B')],
      subjectAssignments: [asg('c1', '1-A', 'mat', 'Matematika')],
      homeroomClasses: [cls('c3', '3-A')],
    })
    expect(w.noSubject).toEqual([cls('c2', '1-B')])
    expect(w.homeroom).toEqual([cls('c3', '3-A')])
    expect(w.classesTotal).toBe(3)
  })

  it('bo`sh ma`lumot', () => {
    const w = buildWorkload({})
    expect(w).toEqual({ subjects: [], homeroom: [], noSubject: [], classesTotal: 0 })
    expect(workloadChips(w)).toEqual([])
  })
})

describe('workloadChips / splitChips', () => {
  const w = buildWorkload({
    classes: [cls('c1', '1-A'), cls('c2', '1-B'), cls('c4', '4-A')],
    subjectAssignments: [
      asg('c1', '1-A', 'inf', 'Informatika'),
      asg('c2', '1-B', 'inf', 'Informatika'),
      asg('c1', '1-A', 'mat', 'Matematika'),
    ],
    homeroomClasses: [cls('c1', '1-A')],
  })

  it('tartib: fanlar (sinflari ko`pi birinchi), rahbarlik, fansiz', () => {
    const chips = workloadChips(w)
    expect(chips.map((c) => c.kind)).toEqual(['subject', 'subject', 'homeroom', 'noSubject'])
    expect(chips[0]).toMatchObject({ name: 'Informatika', count: 2 })
  })

  it('+N: ko`rinadigan chiplar soni cheklanadi', () => {
    const { visible, hidden } = splitChips(workloadChips(w), 2)
    expect(visible).toHaveLength(2)
    expect(hidden).toBe(2)
    expect(splitChips(workloadChips(w), 10).hidden).toBe(0)
  })
})
