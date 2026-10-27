import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { Teacher } from '@/api/types'
import TeacherWorkload from './TeacherWorkload.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const asg = (classId: string, className: string, subjectId: string, subjectName: string) => ({
  classId,
  className,
  subjectId,
  subjectName,
})
const base = { id: 't1', fullName: 'A', username: 'a' } as Teacher

let w: ReturnType<typeof mountIt> | null = null
function mountIt(teacher: Partial<Teacher>, max = 2) {
  return mount(TeacherWorkload, {
    props: { teacher: { ...base, ...teacher } as Teacher, max },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}
afterEach(() => {
  w?.unmount()
  w = null
})

describe('TeacherWorkload', () => {
  it('11 sinfda bitta fan - bitta chip va jami soni', () => {
    const assignments = Array.from({ length: 11 }, (_, i) =>
      asg(`c${i}`, `${i + 1}-A`, 'inf', 'Informatika'),
    )
    w = mountIt({
      subjectAssignments: assignments,
      classes: assignments.map((a) => ({ id: a.classId, name: a.className })),
    })
    const chips = w.findAll('[data-testid="workload-chip"]')
    expect(chips).toHaveLength(1)
    expect(chips[0]!.text()).toBe('Informatika · 11 sinf')
    expect(chips[0]!.attributes('title')).toContain('1-A')
    expect(w.get('[data-testid="workload-total"]').text()).toBe('11 ta sinf')
    expect(w.find('[data-testid="workload-more"]').exists()).toBe(false)
  })

  it('rahbar chipi: bitta sinf nomi, bir nechta bo`lsa soni', () => {
    w = mountIt({ homeroomClasses: [{ id: 'c1', name: '1-A' }] })
    expect(w.get('[data-testid="workload-chip"]').text()).toBe('Rahbar: 1-A')
    w.unmount()
    w = mountIt({
      homeroomClasses: [
        { id: 'c1', name: '1-A' },
        { id: 'c2', name: '2-A' },
      ],
    })
    expect(w.get('[data-testid="workload-chip"]').text()).toBe('Rahbar: 2 sinf')
  })

  it('fansiz sinflar muted chip sifatida', () => {
    w = mountIt({
      classes: [
        { id: 'c1', name: '1-A' },
        { id: 'c2', name: '1-B' },
      ],
    })
    expect(w.get('[data-testid="workload-chip"]').text()).toBe('+2 sinf (fansiz)')
  })

  it('+N tugmasi to`liq yuklama popoverini ochadi', async () => {
    w = mountIt({
      subjectAssignments: [
        asg('c1', '1-A', 'inf', 'Informatika'),
        asg('c1', '1-A', 'mat', 'Matematika'),
        asg('c2', '2-A', 'fiz', 'Fizika'),
        asg('c3', '3-A', 'kim', 'Kimyo'),
      ],
      homeroomClasses: [{ id: 'c1', name: '1-A' }],
    })
    expect(w.findAll('[data-testid="workload-chip"]')).toHaveLength(2)
    const more = w.get('[data-testid="workload-more"]')
    expect(more.text()).toBe('+3')
    expect(more.attributes('aria-expanded')).toBe('false')
    await more.trigger('click')
    expect(more.attributes('aria-expanded')).toBe('true')
    const pop = document.body.querySelector('[data-testid="workload-popover"]')!
    expect(pop.textContent).toContain('Kimyo')
    expect(pop.textContent).toContain('Sinf rahbarligi')
  })

  it('bo`sh holat: Biriktirilmagan', () => {
    w = mountIt({})
    expect(w.text()).toContain('Biriktirilmagan')
    expect(w.find('[data-testid="workload-chip"]').exists()).toBe(false)
  })
})
