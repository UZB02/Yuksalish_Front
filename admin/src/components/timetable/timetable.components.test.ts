import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { TeacherWeek, TimetableWarning } from '@/api/timetable.api'
import ActivateModal from './ActivateModal.vue'
import TeacherWeekGrid from './TeacherWeekGrid.vue'
import TimetableDayList from './TimetableDayList.vue'
import TimetableGrid from './TimetableGrid.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const global = { plugins: [i18n] }

const CELLS = {
  '1:1': {
    subjectId: 'math',
    teacherId: 't1',
    room: '12',
    subjectName: 'Matematika',
    teacherName: 'Aliyev',
  },
  '2:2': {
    subjectId: 'eng',
    teacherId: 't2',
    room: null,
    subjectName: 'Ingliz tili',
    teacherName: 'Karimov',
  },
  '6:2': {
    subjectId: 'eng',
    teacherId: 't2',
    room: null,
    subjectName: 'Rasm',
    teacherName: 'Karimov',
  },
}
const W = (over: Partial<TimetableWarning>): TimetableWarning => ({
  code: 'teacher_double_booked',
  severity: 'error',
  weekday: 1,
  lessonNo: 1,
  subjectId: 'math',
  teacherId: 't1',
  message: 'To`qnashuv',
  ...over,
})

const gridProps = (over: Record<string, unknown> = {}) => ({
  weekdays: [1, 2, 6],
  lessons: 4,
  cells: CELLS,
  warningsMap: {
    '1:1': [W({})],
    '2:2': [W({ code: 'teacher_not_assigned', severity: 'warning', weekday: 2, lessonNo: 2 })],
  },
  outOfRangeKeys: ['6:2'],
  workingWeekdays: [1, 2],
  editable: true,
  canAddLesson: true,
  canRemoveLesson: true,
  ...over,
})

describe('TimetableGrid', () => {
  it('kataklar, ogohlantirish belgilari va sozlamadan tashqari qator/ustun', () => {
    const w = mount(TimetableGrid, { props: gridProps(), global })
    expect(w.get('[data-testid="cell-1-1"]').text()).toContain('Matematika')
    expect(w.get('[data-testid="cell-1-1"]').text()).toContain('Aliyev')
    expect(w.get('[data-testid="cell-1-1"]').text()).toContain('12')
    expect(w.get('[data-testid="cell-1-1"]').find('[data-testid="cell-error"]').exists()).toBe(true)
    expect(w.get('[data-testid="cell-2-2"]').find('[data-testid="cell-warning"]').exists()).toBe(
      true,
    )
    expect(w.get('[data-testid="cell-2-1"]').text()).toBe('')
    // 6-kun ish kuni emas -> sarlavha qizil; 6:2 sozlamadan tashqari yozuv
    expect(w.get('[data-testid="tt-day-6"]').classes()).toContain('text-danger')
    expect(
      w.get('[data-testid="cell-6-2"]').find('[data-testid="cell-out-of-range"]').exists(),
    ).toBe(true)
    // qatorlar soni `lessons` prop bilan; qatorlar qizil emas
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[3]!.classes().join(' ')).not.toContain('bg-danger-soft')
  })

  it("'+ Dars qo'shish' va oxirgi qatorni olib tashlash hodisalari; cheklovlar", async () => {
    const w = mount(TimetableGrid, { props: gridProps({ canRemoveLesson: false }), global })
    await w.get('[data-testid="add-lesson"]').trigger('click')
    expect(w.emitted('addLesson')).toHaveLength(1)
    expect(w.findAll('[data-testid="remove-lesson"]')).toHaveLength(1)
    expect(w.get('[data-testid="remove-lesson"]').attributes('disabled')).toBeDefined()
    const w2 = mount(TimetableGrid, { props: gridProps({ canAddLesson: false }), global })
    expect(w2.get('[data-testid="add-lesson"]').attributes('disabled')).toBeDefined()
    await w2.get('[data-testid="remove-lesson"]').trigger('click')
    expect(w2.emitted('removeLesson')).toHaveLength(1)
    const ro = mount(TimetableGrid, { props: gridProps({ editable: false }), global })
    expect(ro.find('[data-testid="add-lesson"]').exists()).toBe(false)
    expect(ro.find('[data-testid="remove-lesson"]').exists()).toBe(false)
  })

  it('tahrirlanadigan rejimda katak bosilganda edit/clear chiqadi, faqat o`qishda tugma yo`q', async () => {
    const w = mount(TimetableGrid, { props: gridProps(), global })
    await w.get('[data-testid="cell-1-1"]').trigger('click')
    await w.get('[data-testid="clear-1-1"]').trigger('click')
    expect(w.emitted('edit')?.[0]).toEqual([1, 1])
    expect(w.emitted('clear')?.[0]).toEqual([1, 1])

    const ro = mount(TimetableGrid, { props: gridProps({ editable: false }), global })
    expect(ro.find('button[data-testid="cell-1-1"]').exists()).toBe(false)
    expect(ro.find('[data-testid="clear-1-1"]').exists()).toBe(false)
    expect(ro.get('[data-testid="cell-1-1"]').text()).toContain('Matematika')
  })
})

describe('TimetableDayList (mobil)', () => {
  it('kun tablari va tanlangan kun darslari; bosilganda edit', async () => {
    const w = mount(TimetableDayList, {
      props: { ...gridProps(), lessonsPerDay: 3, initialWeekday: 2 },
      global,
    })
    await w.get('[data-testid="tt-tab-1"]').trigger('click')
    expect(w.get('[data-testid="m-cell-1-1"]').text()).toContain('Matematika')
    await w.get('[data-testid="m-cell-1-1"]').trigger('click')
    expect(w.emitted('edit')?.[0]).toEqual([1, 1])
    await w.get('[data-testid="tt-tab-2"]').trigger('click')
    expect(w.get('[data-testid="m-cell-2-2"]').text()).toContain('Ingliz tili')
    expect(w.get('[data-testid="m-cell-2-1"]').text()).toContain(uz.timetable.addLesson)
  })

  it("kun qatorlari max(lessonsPerDay, shu kunda ishlatilgan); qo'shish 12 gacha; bo'sh oxirgisini olish", async () => {
    const cells = { ...CELLS, '1:8': { subjectId: 'math', teacherId: 't1', room: null } }
    const w = mount(TimetableDayList, {
      props: { ...gridProps({ cells }), lessonsPerDay: 3, initialWeekday: 2 },
      global,
    })
    await w.get('[data-testid="tt-tab-2"]').trigger('click')
    expect(w.findAll('[data-testid^="m-cell-2-"]')).toHaveLength(3)
    await w.get('[data-testid="tt-tab-1"]').trigger('click')
    expect(w.findAll('[data-testid^="m-cell-1-"]')).toHaveLength(8)
    expect(w.get('[data-testid="m-remove-lesson"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="tt-tab-2"]').trigger('click')
    for (let i = 0; i < 15; i++) await w.get('[data-testid="m-add-lesson"]').trigger('click')
    expect(w.findAll('[data-testid^="m-cell-2-"]')).toHaveLength(12)
    expect(w.get('[data-testid="m-add-lesson"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="m-remove-lesson"]').trigger('click')
    expect(w.findAll('[data-testid^="m-cell-2-"]')).toHaveLength(11)
  })
})

describe('ActivateModal', () => {
  const mountModal = (loadWarnings: (f: string) => Promise<TimetableWarning[]>, extra = {}) =>
    mount(ActivateModal, {
      props: {
        open: true,
        title: 'T',
        defaultFrom: '2026-11-02',
        today: '2026-10-30',
        loadWarnings,
        ...extra,
      },
      global,
      attachTo: document.body,
    })
  const body = () => document.body
  const q = (id: string) => body().querySelector<HTMLElement>(`[data-testid="${id}"]`)

  it('ogohlantirishsiz: darhol faollashtirish mumkin, payload sodda', async () => {
    const w = mountModal(async () => [])
    await flushPromises()
    const btn = q('activate-submit') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    btn.click()
    expect(w.emitted('submit')?.[0]).toEqual([
      {
        validFrom: '2026-11-02',
        force: undefined,
        note: null,
        syncAssignments: undefined,
        confirmPast: undefined,
      },
    ])
    w.unmount()
  })

  it("to'qnashuv: force va izoh talab qilinadi", async () => {
    const load = vi.fn(async () => [W({})])
    const w = mountModal(load)
    await flushPromises()
    const btn = () => q('activate-submit') as HTMLButtonElement
    expect(q('block-warnings')).not.toBeNull()
    expect(btn().disabled).toBe(true)
    const force = q('force')!.querySelector('input') as HTMLInputElement
    force.click()
    force.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(btn().disabled).toBe(true) // izoh yo'q
    const note = q('force-note') as HTMLTextAreaElement
    note.value = 'Vaqtincha'
    note.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(btn().disabled).toBe(false)
    btn().click()
    expect(w.emitted('submit')?.[0]?.[0]).toMatchObject({
      validFrom: '2026-11-02',
      force: true,
      note: 'Vaqtincha',
    })
    expect(load).toHaveBeenCalledWith('2026-11-02')
    w.unmount()
  })

  it("o'tmish sana tasdiqsiz bloklanadi; biriktirilmagan ogohlantirishda sync chiqadi", async () => {
    const w = mountModal(async () => [W({ code: 'teacher_not_assigned', severity: 'warning' })], {
      defaultFrom: '2026-10-01',
    })
    await flushPromises()
    expect(q('past-warning')).not.toBeNull()
    expect((q('activate-submit') as HTMLButtonElement).disabled).toBe(true)
    const confirm = q('confirm-past')!.querySelector('input') as HTMLInputElement
    confirm.click()
    confirm.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(q('sync')).not.toBeNull()
    expect((q('activate-submit') as HTMLButtonElement).disabled).toBe(false)
    ;(q('activate-submit') as HTMLButtonElement).click()
    expect(w.emitted('submit')?.[0]?.[0]).toMatchObject({
      validFrom: '2026-10-01',
      confirmPast: true,
      syncAssignments: true,
    })
    w.unmount()
  })

  it('sana o`zgarsa ogohlantirishlar qayta yuklanadi', async () => {
    const load = vi.fn(async () => [])
    const w = mountModal(load)
    await flushPromises()
    const input = q('activate-from') as HTMLInputElement
    const el =
      input.tagName === 'INPUT' ? input : (input.querySelector('input') as HTMLInputElement)
    el.value = '2026-12-01'
    el.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(load).toHaveBeenLastCalledWith('2026-12-01')
    w.unmount()
  })
})

describe('TeacherWeekGrid', () => {
  const week: TeacherWeek = {
    teacher: { id: 't1', fullName: 'Aliyev' },
    from: '2026-11-02',
    to: '2026-11-08',
    today: '2026-11-03',
    settings: { workingWeekdays: [1, 2], lessonsPerDay: 3 },
    weeklyCount: 2,
    days: [
      {
        date: '2026-11-02',
        weekday: 1,
        lessons: [
          {
            classId: 'c1',
            date: '2026-11-02',
            weekday: 1,
            lessonNo: 2,
            subjectId: 'math',
            teacherId: 't1',
            room: '5',
            source: 'timetable',
            cancelled: false,
            versionId: 'v',
            class: { id: 'c1', name: '5-A', grade: 5 },
            subject: { id: 'math', name: 'Matematika' },
            teacher: { id: 't1', fullName: 'Aliyev' },
          },
        ],
      },
      { date: '2026-11-03', weekday: 2, lessons: [] },
    ],
  }

  it('darslar to`g`ri katakda: sinf, fan, xona; bo`sh kun matni', () => {
    const w = mount(TeacherWeekGrid, { props: { week }, global })
    const cell = w.get('[data-testid="week-cell-1-2"]')
    expect(cell.text()).toContain('5-A')
    expect(cell.text()).toContain('Matematika')
    expect(cell.text()).toContain('5')
    expect(w.get('[data-testid="week-cell-1-1"]').text()).toBe('')
    expect(w.text()).toContain(uz.timetable.noLessonsDay)
    expect(w.findAll('tbody tr')).toHaveLength(3) // lessonsPerDay=3, ishlatilgan 2
  })

  it('qatorlar soni: eng katta ishlatilgan dars raqamigacha (lessonsPerDay dan oshsa ham)', () => {
    const l = week.days[0]!.lessons[0]!
    const w8: TeacherWeek = {
      ...week,
      days: [{ ...week.days[0]!, lessons: [{ ...l, lessonNo: 8 }] }, week.days[1]!],
    }
    const w = mount(TeacherWeekGrid, { props: { week: w8 }, global })
    expect(w.findAll('tbody tr')).toHaveLength(8)
    expect(w.get('[data-testid="week-cell-1-8"]').text()).toContain('Matematika')
  })
})
