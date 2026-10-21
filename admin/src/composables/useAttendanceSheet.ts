import { computed, ref } from 'vue'
import { attendanceApi } from '@/api/attendance.api'
import type {
  AttendanceBulkItem,
  AttendanceCategory,
  AttendanceMode,
  AttendanceRecord,
  AttendanceSettings,
  AttendanceSheetStudent,
  AttendanceStatus,
} from '@/api/types'
import {
  draftsEqual,
  isIsoDate,
  nearestWorkingDay,
  hasAttendanceErrors,
  validateAttendanceDraft,
  type AttendanceDraft,
  type AttendanceErrors,
} from '@/utils/attendance'
import { todayTashkent } from '@/utils/scoring'
import { useBulkRows, type BulkRow } from './useBulkRows'

export type AttendanceRowState = 'empty' | 'saved' | 'dirty' | 'error' | 'locked'

export interface AttendanceRow extends BulkRow<AttendanceDraft> {
  studentId: string
  fullName: string
  studentCode: string | null
  /** Serverdagi yozuv (kim belgilagan, editable) */
  record: AttendanceRecord | null
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  mode: 'daily',
  lessonsPerDay: 6,
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  editWindowHours: 24,
  backdateDays: 3,
  noteRequiredCategories: [],
  ratingImpact: {
    enabled: false,
    penaltyLate: 0,
    penaltyAbsentExcused: 0,
    penaltyAbsentUnexcused: 0,
  },
}

const emptyDraft = (): AttendanceDraft => ({ statusId: null, minutesLate: '', note: '' })

function toRow(s: AttendanceSheetStudent): AttendanceRow {
  const r = s.record
  const d: AttendanceDraft = r
    ? {
        statusId: r.statusId,
        minutesLate: r.minutesLate === null ? '' : String(r.minutesLate),
        note: r.note ?? '',
      }
    : emptyDraft()
  return {
    studentId: s.studentId,
    fullName: s.fullName,
    studentCode: s.studentCode,
    record: r,
    editable: r ? r.editable : true,
    baseline: { ...d },
    draft: { ...d },
    serverError: null,
  }
}

export interface LiveCounts {
  present: number
  late: number
  absent: number
  unmarked: number
}

/**
 * Davomat varag'i: dirty tracking, tezkor tugmalar, late/izoh validatsiyasi, ish kuni tekshiruvi,
 * faqat o'zgargan qatorlarni bulk yuborish, failed qatorlar va dars rejimida dars almashtirish.
 * Umumiy mexanika `useBulkRows` da (baholash varag'i bilan bir xil).
 */
export function useAttendanceSheet(getClassId: () => string) {
  const date = ref(todayTashkent())
  const lessonNo = ref<number | null>(null)
  const className = ref('')
  const mode = ref<AttendanceMode>('daily')
  const lessonsPerDay = ref(1)
  const isWorkingDay = ref(true)
  const settings = ref<AttendanceSettings>({ ...DEFAULT_ATTENDANCE_SETTINGS })
  const statuses = ref<AttendanceStatus[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const saving = ref(false)
  /** Dars rejimi: har bir dars uchun belgilangan o'quvchilar soni */
  const lessonMarked = ref<Record<number, number>>({})
  let requestId = 0

  const statusById = computed(() => new Map(statuses.value.map((s) => [s.id, s])))
  const statusOfDraft = (d: AttendanceDraft) =>
    d.statusId ? statusById.value.get(d.statusId) : undefined

  const core = useBulkRows<AttendanceDraft, AttendanceRow>({
    keyOf: (r) => r.studentId,
    hasRecord: (r) => r.record !== null,
    equal: draftsEqual,
    isBlank: (d) => d.statusId === null,
    validate: (r) => validateAttendanceDraft(r.draft, statusOfDraft(r.draft), settings.value),
  })
  const { rows, selected, isDirty, dirtyRows, invalidDirty, changedCount } = core

  const errorsOf = (r: AttendanceRow): AttendanceErrors =>
    validateAttendanceDraft(r.draft, statusOfDraft(r.draft), settings.value)

  function stateOf(r: AttendanceRow): AttendanceRowState {
    if (!r.editable) return 'locked'
    if (r.serverError) return 'error'
    if (isDirty(r)) return hasAttendanceErrors(errorsOf(r)) ? 'error' : 'dirty'
    return r.record ? 'saved' : 'empty'
  }

  // ---- Yuklash ----
  async function load(opts: { keepDirty?: boolean } = {}) {
    const current = ++requestId
    loading.value = true
    loadError.value = null
    try {
      let sheet = await attendanceApi.sheet(getClassId(), {
        date: date.value,
        lessonNo: lessonNo.value ?? undefined,
      })
      if (current !== requestId) return
      // Dars rejimida dars tanlanmagan bo'lsa 1-darsdan boshlaymiz
      if (sheet.mode === 'lesson' && lessonNo.value === null) {
        lessonNo.value = sheet.lessonNo ?? 1
        if (sheet.lessonNo === null) {
          sheet = await attendanceApi.sheet(getClassId(), {
            date: date.value,
            lessonNo: lessonNo.value,
          })
          if (current !== requestId) return
        }
      }
      if (sheet.mode === 'daily') lessonNo.value = null
      className.value = sheet.class.name
      mode.value = sheet.mode
      lessonsPerDay.value = sheet.lessonsPerDay
      isWorkingDay.value = sheet.isWorkingDay
      settings.value = sheet.settings
      statuses.value = sheet.statuses
      core.replaceRows(sheet.students.map(toRow), !!opts.keepDirty)
      if (sheet.mode === 'lesson') void loadLessonProgress(current)
    } catch (e) {
      if (current === requestId) loadError.value = e
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  /** Dars chiplaridagi to'ldirilganlik belgisi: har bir dars uchun belgilangan o'quvchilar soni. */
  async function loadLessonProgress(forRequest = requestId) {
    const n = lessonsPerDay.value
    try {
      const counts = await Promise.all(
        Array.from({ length: n }, (_, i) =>
          attendanceApi
            .list({
              classId: getClassId(),
              from: date.value,
              to: date.value,
              lessonNo: i + 1,
              limit: 1,
            })
            .then((r) => r.meta.total),
        ),
      )
      if (forRequest !== requestId) return
      lessonMarked.value = Object.fromEntries(counts.map((c, i) => [i + 1, c]))
    } catch {
      // Belgi ixtiyoriy: xato bo'lsa chiplar belgisiz qoladi
    }
  }

  // ---- Statistika ----
  const total = computed(() => rows.value.length)
  const live = computed<LiveCounts>(() => {
    const c: LiveCounts = { present: 0, late: 0, absent: 0, unmarked: 0 }
    for (const r of rows.value) {
      const cat: AttendanceCategory | undefined = statusOfDraft(r.draft)?.category
      if (!cat) c.unmarked++
      else if (cat === 'present') c.present++
      else if (cat === 'late') c.late++
      else c.absent++
    }
    return c
  })

  // ---- Tahrirlash ----
  const defaultStatus = computed(
    () =>
      statuses.value.find((s) => s.isDefault && s.category === 'present') ??
      statuses.value.find((s) => s.category === 'present') ??
      null,
  )

  /** Holat tanlash: bir bosishda; qayta bosilsa (yozuvsiz qatorda) bekor. Saqlangan yozuv bekor qilinmaydi. */
  function pick(studentId: string, statusId: string) {
    const r = rows.value.find((x) => x.studentId === studentId)
    const status = statusById.value.get(statusId)
    if (!r || !r.editable || !status) return
    if (r.draft.statusId === statusId) {
      if (r.record) return
      core.patch(studentId, { statusId: null, minutesLate: '' })
      return
    }
    core.patch(studentId, {
      statusId,
      // Daqiqa faqat "kechikdi" kategoriyasida
      minutesLate: status.category === 'late' ? r.draft.minutesLate : '',
    })
  }

  /** "Hammasi keldi": standart (keldi) holat barcha tahrirlanadigan qatorlarga. */
  function markAllDefault() {
    const id = defaultStatus.value?.id
    if (!id) return
    for (const r of rows.value) {
      if (r.editable && r.draft.statusId !== id) {
        core.patch(r.studentId, { statusId: id, minutesLate: '' })
      }
    }
  }

  /** "Qolganlarini keldi": hali holat tanlanmagan qatorlarga. */
  function markRemainingDefault() {
    const id = defaultStatus.value?.id
    if (!id) return
    for (const r of rows.value) {
      if (r.editable && r.draft.statusId === null) core.patch(r.studentId, { statusId: id })
    }
  }

  const dateOk = computed(() => isWorkingDay.value)
  const canSave = computed(
    () =>
      dateOk.value && changedCount.value > 0 && invalidDirty.value.length === 0 && !saving.value,
  )
  const hasUnsaved = computed(() => changedCount.value > 0)

  /** Faqat o'zgargan va to'g'ri qatorlar; holati tanlanmaganlar yuborilmaydi. */
  const buildItems = (): AttendanceBulkItem[] =>
    core.validDirty().map((r) => {
      const category = statusOfDraft(r.draft)?.category
      const minutes = r.draft.minutesLate.trim()
      return {
        studentId: r.studentId,
        statusId: r.draft.statusId!,
        minutesLate: category === 'late' && minutes !== '' ? Number(minutes) : null,
        note: r.draft.note.trim() === '' ? null : r.draft.note.trim(),
      }
    })

  async function save() {
    if (!canSave.value) return null
    const items = buildItems()
    saving.value = true
    try {
      const result = await attendanceApi.bulk({
        classId: getClassId(),
        date: date.value,
        ...(mode.value === 'lesson' && lessonNo.value ? { lessonNo: lessonNo.value } : {}),
        items,
      })
      core.applyBulkResult(new Set(items.map((i) => i.studentId)), result.failed)
      await load({ keepDirty: true })
      return result
    } finally {
      saving.value = false
    }
  }

  /**
   * Birinchi yuklash. `?date=` berilgan bo'lsa shu sana (ish kuni bo'lmasa ham - ogohlantirish chiqadi);
   * aks holda bugun ish kuni bo'lmasa backdateDays ichidagi eng yaqin oldingi ish kuniga o'tadi.
   */
  async function init(queryDate?: string | null) {
    const explicit = isIsoDate(queryDate)
    if (explicit) date.value = queryDate
    await load()
    if (explicit || loadError.value || isWorkingDay.value) return
    const target = nearestWorkingDay(
      date.value,
      settings.value.workingWeekdays,
      settings.value.backdateDays,
    )
    if (target !== date.value) {
      date.value = target
      await load()
    }
  }

  /** Sana yoki dars almashtirish (saqlanmaganlar haqida ogohlantirishni chaqiruvchi hal qiladi). */
  async function goTo(next: { date?: string; lessonNo?: number | null }) {
    if (next.date !== undefined) date.value = next.date
    if (next.lessonNo !== undefined) lessonNo.value = next.lessonNo
    await load()
  }

  return {
    date,
    lessonNo,
    className,
    mode,
    lessonsPerDay,
    isWorkingDay,
    settings,
    statuses,
    rows,
    loading,
    loadError,
    saving,
    selected,
    lessonMarked,
    load,
    isDirty,
    errorsOf,
    stateOf,
    dirtyRows,
    invalidDirty,
    changedCount,
    canSave,
    hasUnsaved,
    buildItems,
    total,
    live,
    defaultStatus,
    statusById,
    pick,
    markAllDefault,
    markRemainingDefault,
    patch: core.patch,
    toggleSelect: core.toggleSelect,
    save,
    discard: core.discard,
    goTo,
    init,
  }
}

export type AttendanceSheetState = ReturnType<typeof useAttendanceSheet>
