import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { AttendanceDay, AttendanceSettings, AttendanceStatus } from '@/api/types'
import { CATEGORY_COLORS } from '@/utils/attendance'
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceRow as Row,
} from '@/composables/useAttendanceSheet'
import AttendanceCalendar from './AttendanceCalendar.vue'
import AttendanceRow from './AttendanceRow.vue'
import AttendanceSummaryTable from './AttendanceSummaryTable.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const opts = { global: { plugins: [i18n] } }

describe('AttendanceCalendar', () => {
  const days: AttendanceDay[] = [
    { date: '2026-10-12', category: 'present', lessons: 1, records: [] },
    { date: '2026-10-13', category: 'late', lessons: 1, records: [] },
    { date: '2026-10-14', category: 'absent_excused', lessons: 1, records: [] },
    { date: '2026-10-15', category: 'absent_unexcused', lessons: 2, records: [] },
  ]
  const mountCal = (extra = {}) =>
    mount(AttendanceCalendar, {
      props: { month: '2026-10', days, workingWeekdays: [1, 2, 3, 4, 5, 6], ...extra },
      ...opts,
    })
  const cell = (w: ReturnType<typeof mountCal>, date: string) => w.find(`[data-date="${date}"]`)

  it('kunlar kategoriya rangida', () => {
    const w = mountCal()
    expect(cell(w, '2026-10-12').attributes('data-category')).toBe('present')
    expect(cell(w, '2026-10-12').attributes('style')).toContain('rgb(22, 163, 74)')
    for (const [date, cat] of [
      ['2026-10-13', 'late'],
      ['2026-10-14', 'absent_excused'],
      ['2026-10-15', 'absent_unexcused'],
    ] as const) {
      const hex = CATEGORY_COLORS[cat]
      const rgb = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
      expect(cell(w, date).attributes('style')).toContain(rgb)
    }
  })

  it("ish kuni bo'lmagan kunlar kulrang (rest), yozuvsiz ish kuni - bo'sh katak", () => {
    const w = mountCal()
    expect(cell(w, '2026-10-18').attributes('data-kind')).toBe('rest') // yakshanba
    expect(cell(w, '2026-10-18').attributes('style') ?? '').not.toContain('background')
    expect(cell(w, '2026-10-16').attributes('data-kind')).toBe('empty')
    expect(cell(w, '2026-10-12').attributes('data-kind')).toBe('record')
  })

  it('shanba ish kuni emas sozlamasida (1-5) shanba kulrang', () => {
    const w = mountCal({ workingWeekdays: [1, 2, 3, 4, 5] })
    expect(cell(w, '2026-10-17').attributes('data-kind')).toBe('rest')
  })

  it("davr chegarasidan tashqari kunlar 'outside', tooltip holat va darslar bilan", () => {
    const w = mountCal({ from: '2026-10-12', to: '2026-10-15' })
    expect(cell(w, '2026-10-11').attributes('data-kind')).toBe('outside')
    expect(cell(w, '2026-10-15').attributes('title')).toContain('Sababsiz yo')
    expect(cell(w, '2026-10-15').attributes('title')).toContain('2 ta dars')
  })

  it('oy navigatsiyasi update:month chiqaradi', async () => {
    const w = mountCal()
    expect(w.find('[data-testid="calendar-title"]').text()).toBe('Oktabr 2026')
    const [prev, next] = w.findAll('button')
    await prev!.trigger('click')
    await next!.trigger('click')
    expect(w.emitted('update:month')).toEqual([['2026-09'], ['2026-11']])
  })
})

describe('AttendanceSummaryTable', () => {
  const rows = [
    {
      studentId: 'a',
      fullName: 'Aliyev',
      present: 9,
      late: 1,
      absentExcused: 0,
      absentUnexcused: 0,
      total: 10,
      rate: 100,
    },
    {
      studentId: 'b',
      fullName: 'Botirov',
      present: 5,
      late: 0,
      absentExcused: 2,
      absentUnexcused: 3,
      total: 10,
      rate: 50,
    },
    {
      studentId: 'c',
      fullName: 'Valiyev',
      present: 0,
      late: 0,
      absentExcused: 0,
      absentUnexcused: 0,
      total: 0,
      rate: null,
    },
  ]
  it("standart: foizi past o'quvchilar birinchi, ma'lumotsiz oxirida; qator bosilsa open", async () => {
    const w = mount(AttendanceSummaryTable, { props: { rows, unit: 'day' }, ...opts })
    const names = w.findAll('[data-testid="summary-row"]').map((r) => r.find('td').text())
    expect(names).toEqual(['Botirov', 'Aliyev', 'Valiyev'])
    await w.findAll('[data-testid="summary-row"]')[0]!.trigger('click')
    expect(w.emitted('open')![0]).toEqual(['b'])
  })
  it('foiz progressi va matni', () => {
    const w = mount(AttendanceSummaryTable, { props: { rows, unit: 'lesson' }, ...opts })
    expect(w.text()).toContain('50%')
    expect(w.text()).toContain('100%')
    expect(w.findAll('[role="progressbar"]')[0]!.attributes('aria-valuenow')).toBe('50')
  })
})

describe('AttendanceRow', () => {
  const statuses: AttendanceStatus[] = [
    {
      id: 'p',
      schoolId: null,
      name: 'Keldi',
      shortName: 'K',
      color: '#16a34a',
      category: 'present',
      isDefault: true,
      order: 0,
      isActive: true,
      createdAt: '',
    },
    {
      id: 'l',
      schoolId: null,
      name: 'Kechikdi',
      shortName: 'Q',
      color: '#d97706',
      category: 'late',
      isDefault: false,
      order: 1,
      isActive: true,
      createdAt: '',
    },
    {
      id: 'e',
      schoolId: null,
      name: "Sababli yo'q",
      shortName: 'S',
      color: '#0284c7',
      category: 'absent_excused',
      isDefault: false,
      order: 2,
      isActive: true,
      createdAt: '',
    },
  ]
  const settings: AttendanceSettings = {
    ...DEFAULT_ATTENDANCE_SETTINGS,
    noteRequiredCategories: ['absent_excused'],
  }
  const row = (statusId: string | null, extra: Partial<Row> = {}): Row => ({
    studentId: '1',
    fullName: 'Aliyev Vali',
    studentCode: null,
    record: null,
    editable: true,
    baseline: { statusId: null, minutesLate: '', note: '' },
    draft: { statusId, minutesLate: '', note: '' },
    serverError: null,
    ...extra,
  })
  const mountRow = (
    r: Row,
    state: 'empty' | 'saved' | 'dirty' | 'error' | 'locked' = 'dirty',
    errors = {},
  ) =>
    mount(AttendanceRow, {
      props: { row: r, index: 0, state, errors, statuses, settings, showErrors: true },
      ...opts,
    })

  it('holat chiplari: bosilganda pick; tanlangani aria-checked', async () => {
    const w = mountRow(row('p'))
    const chips = w.findAll('[data-testid="status-chip"]')
    expect(chips).toHaveLength(3)
    expect(chips[0]!.attributes('aria-checked')).toBe('true')
    await chips[2]!.trigger('click')
    expect(w.emitted('pick')![0]).toEqual(['1', 'e'])
  })

  it("late tanlansa daqiqa input paydo bo'ladi, boshqasida yo'q", () => {
    expect(mountRow(row('l')).find('[data-testid="minutes-input"]').exists()).toBe(true)
    expect(mountRow(row('p')).find('[data-testid="minutes-input"]').exists()).toBe(false)
  })

  it('izoh majburiy kategoriyada izoh maydoni ochiq va aria-required', () => {
    const w = mountRow(row('e'), 'error', { note: 'noteRequired' })
    const ta = w.find('[data-testid="note-input"]')
    expect(ta.exists()).toBe(true)
    expect(ta.attributes('aria-required')).toBe('true')
    expect(w.text()).toContain('Bu holat uchun izoh majburiy')
  })

  it("qulflangan qator: chiplar disabled va sabab ko'rsatiladi", () => {
    const record = { markedBy: { id: 'x', fullName: 'Boshqa Ustoz' } } as never
    const w = mountRow(row('p', { editable: false, record }), 'locked')
    expect(
      w.findAll('[data-testid="status-chip"]').every((c) => c.attributes('disabled') !== undefined),
    ).toBe(true)
    expect(w.find('[data-testid="locked-reason"]').text()).toContain('Boshqa Ustoz')
  })
})
