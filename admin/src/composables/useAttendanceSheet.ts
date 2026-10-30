import { computed, ref } from 'vue'
import { attendanceApi } from '@/api/attendance.api'
import type {
  AttendanceBulkItem,
  AttendanceCategory,
  AttendanceMode,
  AttendanceRecord,
  AttendanceSettings,
  AttendanceSheetLesson,
  AttendanceSheetStudent,
  AttendanceStatus,
  AttendanceSubjectOption,
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
  photo?: string | null
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
    photo: s.photo ?? null,
    record: r,
    editable: r ? r.editable : true,
    baseline: { ...d },
    draft: { ...d },
    serverError: null,
  }
}

/** Dars tanlagich chipi: jadvaldagi dars, bo'sh slot yoki jadvalsiz oddiy raqam */
export interface LessonChip {
  n: number
  lesson: AttendanceSheetLesson | null
  /** Sinfda jadval bor, lekin bu soatda dars yo'q */
  empty: boolean
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
  /** Dars rejimi: tanlangan fan, tanlanadigan fanlar va serverda saqlangan fan */
  const subjectId = ref<string | null>(null)
  const subjects = ref<AttendanceSubjectOption[]>([])
  const savedSubjectId = ref<string | null>(null)
  /** Jadval (P2): shu sanadagi darslar, tanlangan darsning jadvaldagi yozuvi va ruxsat */
  const lessons = ref<AttendanceSheetLesson[]>([])
  const lesson = ref<AttendanceSheetLesson | null>(null)
  const hasTimetable = ref(false)
  const maxLessonNo = ref(1)
  const canTake = ref(true)
  const cannotTakeReason = ref<string | null>(null)
  const canOverrideSubject = ref(false)
  /** Admin / sinf rahbari jadvaldagi fan o'rniga boshqasini tanlayapti */
  const overriding = ref(false)
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
      // Dars rejimida dars tanlanmagan bo'lsa: o'qituvchining bugungi birinchi darsi, aks holda 1-dars
      if (sheet.mode === 'lesson' && lessonNo.value === null) {
        const mine = (sheet.lessons ?? []).find((l) => l.mine && !l.cancelled)
        lessonNo.value = mine?.lessonNo ?? sheet.lessonNo ?? 1
        if (lessonNo.value !== sheet.lessonNo) {
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
      lessons.value = sheet.lessons ?? []
      lesson.value = sheet.lesson ?? null
      hasTimetable.value = sheet.timetable?.hasTimetable ?? false
      maxLessonNo.value = Math.max(sheet.maxLessonNo ?? 0, sheet.lessonsPerDay)
      canTake.value = sheet.canTake ?? true
      cannotTakeReason.value = sheet.cannotTakeReason ?? null
      canOverrideSubject.value = sheet.canOverrideSubject ?? false
      isWorkingDay.value = sheet.isWorkingDay
      settings.value = sheet.settings
      statuses.value = sheet.statuses
      applySubjects(sheet.mode, sheet.subjects ?? [], sheet.subjectId ?? null, lesson.value)
      core.replaceRows(sheet.students.map(toRow), !!opts.keepDirty)
      if (sheet.mode === 'lesson') void loadLessonProgress(current)
    } catch (e) {
      if (current === requestId) loadError.value = e
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  /**
   * Fan tanlovi: serverda saqlangan fan oldindan tanlanadi; aks holda foydalanuvchi tanlovi
   * (ro'yxatda bo'lsa) saqlanadi; bitta variant bo'lsa avtomatik tanlanadi.
   */
  function applySubjects(
    m: AttendanceMode,
    options: AttendanceSubjectOption[],
    saved: string | null,
    scheduled: AttendanceSheetLesson | null = null,
  ) {
    if (m !== 'lesson') {
      subjects.value = []
      subjectId.value = null
      savedSubjectId.value = null
      return
    }
    subjects.value = options
    savedSubjectId.value = saved
    if (saved) subjectId.value = saved
    else if (scheduled && !scheduled.cancelled) subjectId.value = scheduled.subjectId
    else if (!options.some((o) => o.id === subjectId.value)) {
      subjectId.value = options.length === 1 ? options[0].id : null
    }
  }

  function setSubject(id: string | null) {
    subjectId.value = id
  }

  /** Jadvaldan aniqlangan (bekor qilinmagan) dars: fan faqat o'qish uchun chip */
  const scheduledLesson = computed(() =>
    lesson.value && !lesson.value.cancelled ? lesson.value : null,
  )

  /** Ko'rsatiladigan fan nomi (jadval yoki saqlangan/tanlangan fan) */
  const subjectLabel = computed(() => {
    const id = subjectId.value
    if (!id) return ''
    if (scheduledLesson.value?.subjectId === id) return scheduledLesson.value.subject?.name ?? ''
    return subjects.value.find((s) => s.id === id)?.name ?? ''
  })

  function startOverride() {
    overriding.value = true
  }
  /** Jadvaldagi fanga qaytish */
  function stopOverride() {
    overriding.value = false
    if (scheduledLesson.value && !savedSubjectId.value)
      subjectId.value = scheduledLesson.value.subjectId
  }

  /** Dars chiplari: 1..maxLessonNo; jadvali bor sinfda bo'sh slotlar "(bo'sh)" */
  const chips = computed<LessonChip[]>(() =>
    Array.from({ length: maxLessonNo.value }, (_, i) => {
      const n = i + 1
      const l = lessons.value.find((x) => x.lessonNo === n) ?? null
      return { n, lesson: l, empty: hasTimetable.value && !l }
    }),
  )

  /** Dars chiplaridagi to'ldirilganlik belgisi: har bir dars uchun belgilangan o'quvchilar soni. */
  async function loadLessonProgress(forRequest = requestId) {
    const n = maxLessonNo.value
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
  /** Dars rejimida fan tanlanmaguncha saqlab bo'lmaydi */
  const subjectMissing = computed(() => mode.value === 'lesson' && !subjectId.value)
  const canSave = computed(
    () =>
      dateOk.value &&
      canTake.value &&
      !subjectMissing.value &&
      changedCount.value > 0 &&
      invalidDirty.value.length === 0 &&
      !saving.value,
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

  /**
   * Fan yuboriladi: jadvaldan aniqlangan darsda faqat u jadvaldagidan farq qilsa
   * (server o'zi aniqlaydi); jadvalsiz/bo'sh slotda doim.
   */
  function sendsSubject(): boolean {
    if (mode.value !== 'lesson' || !subjectId.value) return false
    const sched = scheduledLesson.value
    return !sched || subjectId.value !== sched.subjectId
  }

  async function save() {
    if (!canSave.value) return null
    const items = buildItems()
    saving.value = true
    try {
      const result = await attendanceApi.bulk({
        classId: getClassId(),
        date: date.value,
        ...(mode.value === 'lesson' && lessonNo.value ? { lessonNo: lessonNo.value } : {}),
        ...(sendsSubject() ? { subjectId: subjectId.value! } : {}),
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
  async function init(queryDate?: string | null, queryLessonNo?: number | null) {
    subjectId.value = null
    overriding.value = false
    const explicit = isIsoDate(queryDate)
    if (explicit) date.value = queryDate
    lessonNo.value =
      typeof queryLessonNo === 'number' && Number.isInteger(queryLessonNo) && queryLessonNo >= 1
        ? queryLessonNo
        : null
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
    // Boshqa sana/dars: fan serverdan qayta aniqlanadi (saqlangan bo'lsa) yoki qayta tanlanadi
    subjectId.value = null
    overriding.value = false
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
    subjectId,
    subjects,
    savedSubjectId,
    subjectMissing,
    setSubject,
    lessons,
    lesson,
    scheduledLesson,
    hasTimetable,
    maxLessonNo,
    canTake,
    cannotTakeReason,
    canOverrideSubject,
    overriding,
    subjectLabel,
    startOverride,
    stopOverride,
    chips,
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
