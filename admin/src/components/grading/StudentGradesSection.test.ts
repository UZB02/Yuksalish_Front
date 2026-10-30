import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import { gradesApi } from '@/api/grades.api'
import type { StudentGradeSummary, SubjectGrade } from '@/api/types'
import StudentGradesSection from './StudentGradesSection.vue'

vi.mock('@/api/grades.api', () => ({ gradesApi: { studentSummary: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })

const g = (id: string, lessonNo: number, value: number): SubjectGrade =>
  ({
    id,
    studentId: 's1',
    subject: { id: 'eng', name: 'Ingliz tili' },
    teacher: { id: 't1', fullName: 'Karimov K.' },
    value,
    comment: null,
    date: '2026-10-14',
    lessonNo,
  }) as SubjectGrade

let wrapper: VueWrapper | null = null
afterEach(() => wrapper?.unmount())

describe('StudentGradesSection: dars belgisi', () => {
  it('so`nggi baholarda darsga bog`langan bahoda "3-dars" ko`rinadi', async () => {
    const summary: StudentGradeSummary = {
      studentId: 's1',
      from: '2026-10-01',
      to: '2026-10-31',
      average: 4,
      average100: 80,
      gradesCount: 3,
      bySubject: [
        {
          subjectId: 'eng',
          name: 'Ingliz tili',
          average: 4,
          count: 3,
          lastValue: 5,
          lastDate: '2026-10-14',
        },
      ],
      recent: [g('a', 3, 3), g('b', 1, 5), g('c', 0, 4)],
    }
    vi.mocked(gradesApi.studentSummary).mockResolvedValue(summary)
    wrapper = mount(StudentGradesSection, {
      props: { studentId: 's1', from: '2026-10-01', to: '2026-10-31' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="lesson-label"]').map((l) => l.text())).toEqual([
      '· 3-dars',
      '· 1-dars',
    ])
  })
})
