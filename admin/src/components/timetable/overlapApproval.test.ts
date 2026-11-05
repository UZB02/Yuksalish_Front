import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uz from '@/locales/uz.json'
import type { BusyTeacher, TimetableOptions, TimetableWarning } from '@/api/timetable.api'
import { __resetBodyLock } from '@/composables/useBodyLock'
import { cellsToPayload, entriesToCells, severityOf } from '@/utils/timetable'
import { buildIssues, countIssues, previewCellWarnings } from '@/utils/timetableIssues'
import CellEditorModal from './CellEditorModal.vue'
import TimetableCellContent from './TimetableCellContent.vue'
import TimetableIssuesDrawer from './TimetableIssuesDrawer.vue'

const i18n = createI18n({ legacy: false, locale: 'uz', messages: { uz } })
const body = () => document.body
const q = (sel: string) => body().querySelector(sel) as HTMLElement | null

afterEach(() => {
  document.body.innerHTML = ''
  __resetBodyLock()
})

const OPTIONS: TimetableOptions = {
  subjects: [{ id: 'koord', name: 'Koordinator soati' }],
  teachers: [{ id: 'nod', fullName: 'Yuldasheva Nodira' }],
  classAssignments: [{ subjectId: 'koord', teacherId: 'nod' }],
  subjectTeachers: { koord: ['nod'] },
}
const VALUE = [
  {
    subjectId: 'koord',
    teacherId: 'nod',
    room: null,
    subjectName: 'Koordinator soati',
    teacherName: 'Yuldasheva Nodira',
  },
]
const BUSY: BusyTeacher[] = [
  { teacherId: 'nod', classId: 'c1', className: '5-At Termiziy', approved: false },
  { teacherId: 'nod', classId: 'c2', className: '9-Temuriylar', approved: false },
]

function mountEditor(props: Record<string, unknown> = {}) {
  return mount(CellEditorModal, {
    props: {
      open: true,
      weekday: 1,
      lessonNo: 9,
      options: OPTIONS,
      value: VALUE,
      busy: BUSY,
      issues: buildIssues([dbl()], i18n.global.t),
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

const dbl = (over: Partial<TimetableWarning> = {}): TimetableWarning => ({
  code: 'teacher_double_booked',
  severity: 'error',
  weekday: 1,
  lessonNo: 9,
  subjectId: 'koord',
  teacherId: 'nod',
  message: '',
  other: {
    classId: 'c1',
    className: '5-At Termiziy',
    versionId: 'v',
    validFrom: '',
    validTo: null,
  },
  ...over,
})
const approved = (side: 'self' | 'other' | 'both' = 'self'): TimetableWarning =>
  dbl({
    code: 'teacher_overlap_approved',
    severity: 'info',
    approval: {
      side,
      approvedBy: 'u1',
      approvedByName: 'Super Admin',
      approvedAt: '2026-11-05T10:00:00Z',
    },
  })

describe("CellEditorModal: bir vaqtda o'tishga ruxsat", () => {
  it("superadmin: band o'qituvchi uchun sinflar ko'rsatiladi va tasdiq belgisi chiqadi; belgilansa saqlashda overlapApproved: true", async () => {
    const w = mountEditor({ canApproveOverlap: true })
    await flushPromises()
    const box = q('[data-testid="cell-overlap-box"]')!
    expect(box.textContent).toContain('Yuldasheva Nodira')
    expect(box.textContent).toContain('5-At Termiziy, 9-Temuriylar')
    // ruxsatsiz holat: xato ko'rinadi
    expect(q('[data-testid="cell-issues"] [data-severity="error"]')).not.toBeNull()
    const check = q('[data-testid="cell-overlap-allow"] input[type="checkbox"]') as HTMLInputElement
    expect(check).not.toBeNull()
    expect(q('[data-testid="cell-overlap-superadmin-only"]')).toBeNull()
    check.click()
    await flushPromises()
    // ruxsat berilgach: xato yo'q, info bor
    expect(q('[data-testid="cell-issues"] [data-severity="error"]')).toBeNull()
    expect(q('[data-testid="cell-issues"] [data-severity="info"]')).not.toBeNull()
    ;(q('[data-testid="cell-save"]') as HTMLButtonElement).click()
    await flushPromises()
    const saved = w.emitted('save')![0]![0] as { overlapApproved?: boolean }[]
    expect(saved[0]!.overlapApproved).toBe(true)
    w.unmount()
  })

  it("superadmin emas: tasdiq belgisi yo'q, faqat superadmin ruxsat bera olishi aytiladi; saqlashda ruxsat yuborilmaydi", async () => {
    const w = mountEditor({ canApproveOverlap: false })
    await flushPromises()
    expect(q('[data-testid="cell-overlap-allow"]')).toBeNull()
    expect(q('[data-testid="cell-overlap-superadmin-only"]')?.textContent).toContain(
      'faqat superadmin ruxsat bera oladi',
    )
    expect(q('[data-testid="cell-issues"] [data-severity="error"]')).not.toBeNull()
    ;(q('[data-testid="cell-save"]') as HTMLButtonElement).click()
    await flushPromises()
    const saved = w.emitted('save')![0]![0] as { overlapApproved?: boolean }[]
    expect(saved[0]!.overlapApproved).toBeUndefined()
    w.unmount()
  })

  it("boshqa sinfdagi yozuvda ruxsat bo'lsa (approved) blok ko'rinmaydi va xato yo'q", async () => {
    const busy = BUSY.map((b) => ({ ...b, approved: true }))
    const w = mountEditor({ canApproveOverlap: true, busy, issues: [] })
    await flushPromises()
    expect(q('[data-testid="cell-overlap-box"]')).toBeNull()
    expect(q('[data-testid="cell-issues"] [data-severity="error"]')).toBeNull()
    w.unmount()
  })

  it('saqlangan ruxsat belgisi olib tashlansa overlapApproved: false yuboriladi', async () => {
    const value = [{ ...VALUE[0]!, overlapApproved: true }]
    const w = mountEditor({ canApproveOverlap: true, value })
    await flushPromises()
    const check = q('[data-testid="cell-overlap-allow"] input[type="checkbox"]') as HTMLInputElement
    expect(check.checked).toBe(true)
    check.click()
    await flushPromises()
    ;(q('[data-testid="cell-save"]') as HTMLButtonElement).click()
    await flushPromises()
    const saved = w.emitted('save')![0]![0] as { overlapApproved?: boolean }[]
    expect(saved[0]!.overlapApproved).toBe(false)
    w.unmount()
  })
})

describe('TimetableIssuesDrawer: ruxsat berish / bekor qilish', () => {
  const mountDrawer = (props: Record<string, unknown>) =>
    mount(TimetableIssuesDrawer, {
      props: {
        open: true,
        issues: buildIssues([dbl(), approved()], i18n.global.t),
        canEdit: true,
        ...props,
      },
      global: { plugins: [i18n], stubs: { RouterLink: true } },
      attachTo: document.body,
    })

  it("superadmin: xatoda 'Ruxsat berish', ruxsat etilganda 'Ruxsatni bekor qilish' (alohida guruhda)", async () => {
    const w = mountDrawer({ isSuperadmin: true })
    await flushPromises()
    expect(q('[data-testid="issues-group-error"]')).not.toBeNull()
    expect(q('[data-testid="issues-group-info"]')).not.toBeNull()
    expect(q('[data-testid="issues-group-error"] [data-testid="issue-revoke"]')).toBeNull()
    ;(q('[data-testid="issues-group-error"] [data-testid="issue-approve"]') as HTMLElement).click()
    expect(w.emitted('approveOverlap')?.[0]?.[0]).toMatchObject({
      code: 'teacher_double_booked',
      weekday: 1,
      lessonNo: 9,
      teacherId: 'nod',
    })
    expect(q('[data-testid="issues-group-info"] [data-testid="issue-approve"]')).toBeNull()
    expect(q('[data-testid="issue-approval-by"]')?.textContent).toContain('Super Admin')
    ;(q('[data-testid="issues-group-info"] [data-testid="issue-revoke"]') as HTMLElement).click()
    expect(w.emitted('revokeOverlap')?.[0]?.[0]).toMatchObject({ code: 'teacher_overlap_approved' })
    // "Ruxsatlar" tabi hisoblanadi, "Hammasi" esa faqat xato+ogohlantirish
    expect(q('[data-testid="issues-tab-info"]')?.textContent).toContain('(1)')
    expect(q('[data-testid="issues-tab-all"]')?.textContent).toContain('(1)')
    w.unmount()
  })

  it("'Barchasiga ruxsat berish (N)': faqat superadminga, xatolar guruhida, bitta hodisa; saqlanmagan o'zgarishda o'chiq", async () => {
    const issues = buildIssues([dbl(), dbl({ weekday: 2 }), approved()], i18n.global.t)
    let w = mountDrawer({ isSuperadmin: true, issues })
    await flushPromises()
    const btn = q(
      '[data-testid="issues-group-error"] [data-testid="issue-approve-all"]',
    ) as HTMLButtonElement
    expect(btn.textContent).toContain('(2)')
    expect(q('[data-testid="issues-group-info"] [data-testid="issue-approve-all"]')).toBeNull()
    btn.click()
    const list = w.emitted('approveAllOverlaps')![0]![0] as { weekday: number; code: string }[]
    expect(list.map((i) => i.weekday).sort()).toEqual([1, 2])
    w.unmount()
    document.body.innerHTML = ''
    w = mountDrawer({ isSuperadmin: true, issues, approvalLocked: true })
    await flushPromises()
    expect((q('[data-testid="issue-approve-all"]') as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
    document.body.innerHTML = ''
    w = mountDrawer({ isSuperadmin: false, issues })
    await flushPromises()
    expect(q('[data-testid="issue-approve-all"]')).toBeNull()
    w.unmount()
  })

  it("superadmin emas: tugmalar yo'q, 'faqat superadmin' izohi bor", async () => {
    const w = mountDrawer({ isSuperadmin: false })
    await flushPromises()
    expect(q('[data-testid="issue-approve"]')).toBeNull()
    expect(q('[data-testid="issue-revoke"]')).toBeNull()
    expect(q('[data-testid="issue-superadmin-only"]')?.textContent).toContain('faqat superadmin')
    w.unmount()
  })

  it("saqlanmagan o'zgarishlar bo'lsa tugmalar o'chiq; ruxsat ikkinchi sinfda bo'lsa bekor qilib bo'lmaydi", async () => {
    let w = mountDrawer({ isSuperadmin: true, approvalLocked: true })
    await flushPromises()
    expect((q('[data-testid="issue-approve"]') as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
    document.body.innerHTML = ''
    w = mountDrawer({
      isSuperadmin: true,
      issues: buildIssues([approved('other')], i18n.global.t),
    })
    await flushPromises()
    expect(q('[data-testid="issue-revoke"]')).toBeNull()
    expect(q('[data-testid="issue-approval-by"]')?.textContent).toContain('5-At Termiziy')
    w.unmount()
  })
})

describe('katak belgisi va hisoblar', () => {
  it('ruxsat etilgan darsda link belgisi va tooltip: tasdiqlagan va sana', () => {
    const cells = entriesToCells([
      {
        weekday: 1,
        lessonNo: 9,
        subjectId: 'koord',
        teacherId: 'nod',
        room: null,
        subject: { id: 'koord', name: 'Koordinator soati' },
        teacher: { id: 'nod', fullName: 'Yuldasheva Nodira' },
        overlapApproval: {
          approvedBy: { id: 'u1', fullName: 'Super Admin' },
          approvedAt: '2026-11-05T10:00:00Z',
        },
      },
    ])
    const w = mount(TimetableCellContent, {
      props: { cell: cells['1:9']![0], issues: buildIssues([approved()], i18n.global.t) },
      global: { plugins: [i18n] },
    })
    const badge = w.get('[data-testid="cell-overlap"]')
    expect(badge.attributes('title')).toBe(
      "Bir vaqtda o'tish ruxsat etilgan — Super Admin, 05.11.2026",
    )
    // info xato/ogohlantirish belgisini chiqarmaydi
    expect(w.find('[data-testid="cell-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="cell-warning"]').exists()).toBe(false)
    const plain = mount(TimetableCellContent, {
      props: { cell: { subjectId: 's', teacherId: 't', room: null } },
      global: { plugins: [i18n] },
    })
    expect(plain.find('[data-testid="cell-overlap"]').exists()).toBe(false)
  })

  it('severityOf va countIssues info ni xato/ogohlantirishga qo`shmaydi', () => {
    expect(severityOf([{ severity: 'info' }])).toBeNull()
    expect(severityOf([{ severity: 'info' }, { severity: 'warning' }])).toBe('warning')
    expect(
      countIssues([{ severity: 'error' }, { severity: 'warning' }, { severity: 'info' }]),
    ).toEqual({
      error: 1,
      warning: 1,
      info: 1,
      total: 2,
    })
  })

  it("cellsToPayload: ruxsat true/false aniq yuboriladi, aks holda kalit yo'q", () => {
    const payload = cellsToPayload({
      '1:1': [
        { subjectId: 'a', teacherId: 't1', room: null, overlapApproved: true },
        { subjectId: 'a', teacherId: 't2', room: null, overlapApproved: false },
        { subjectId: 'a', teacherId: 't3', room: null },
      ],
    })
    expect(payload.map((p) => p.overlapApproved)).toEqual([true, false, undefined])
    expect('overlapApproved' in payload[2]!).toBe(false)
  })

  it("previewCellWarnings: ruxsat (o'zida yoki boshqa sinfda) bo'lsa info, bo'lmasa xato", () => {
    const base = { weekday: 1, lessonNo: 9, subjectId: 'koord', teacherId: 'nod', options: OPTIONS }
    const codes = (busy: BusyTeacher[], approvedSelf?: boolean) =>
      previewCellWarnings({ ...base, busy, approved: approvedSelf }).map((w) => w.code)
    expect(codes(BUSY)).toEqual(['teacher_double_booked', 'teacher_double_booked'])
    expect(codes(BUSY, true)).toEqual(['teacher_overlap_approved', 'teacher_overlap_approved'])
    expect(codes([{ ...BUSY[0]!, approved: true }, BUSY[1]!])).toEqual([
      'teacher_overlap_approved',
      'teacher_double_booked',
    ])
  })
})
