import { computed, ref } from 'vue'
import { gradesApi } from '@/api/grades.api'
import type { BulkGradeItem, GradeSheetLesson, GradeSheetStudent } from '@/api/types'
import {
  gradeDraftsEqual,
  validateGradeDraft,
  type GradeDraft,
  type GradeDraftErrors,
} from '@/utils/grades'
import { todayTashkent } from '@/utils/scoring'
import { useBulkRows, type BulkRow } from './useBulkRows'

export type GradeRowStatus = 'empty' | 'saved' | 'dirty' | 'error' | 'locked'

export interface GradeSheetRow extends BulkRow<GradeDraft> {
  studentId: string
  fullName: string
  photo?: string | null
  studentCode: string | null
  /** Serverdagi shu fan/kun bahosi (kim qo'ygan bo'lsa ham) */
  gradeId: string | null
  /** Baho qo'ygan o'qituvchi (ma'lumot uchun) */
  gradedBy: string | null
}

const emptyDraft = (): GradeDraft => ({ value: null, comment: '' })

export function toGradeRow(s: GradeSheetStudent): GradeSheetRow {
  const d: GradeDraft = s.grade
    ? { value: s.grade.value, comment: s.grade.comment ?? '' }
    : emptyDraft()
  return {
    studentId: s.studentId,
    fullName: s.fullName,
    studentCode: s.studentCode,
    photo: s.photo ?? null,
    gradeId: s.grade?.id ?? null,
    gradedBy: s.grade?.teacher.fullName ?? null,
    editable: s.grade ? s.grade.editable : true,
    baseline: { ...d },
    draft: { ...d },
    serverError: null,
  }
}

/**
 * Fan baholash varag'i holati (sinf + fan + sana): dirty tracking, validatsiya,
 * faqat o'zgargan qatorlarni bulk yuborish. Umumiy mexanika `useBulkRows` da.
 */
export function useGradeSheet(getClassId: () => string, getSubjectId: () => string) {
  const date = ref(todayTashkent())
  const className = ref('')
  const subjectName = ref('')
  const backdateDays = ref(3)
  const editWindowHours = ref(24)
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const saving = ref(false)
  /** Foydalanuvchi (yoki havola) tanlagan dars; null - serverga qoldiriladi */
  const requestedLesson = ref<number | null>(null)
  /** Server aniqlagan dars: null - tanlanishi kerak; 0 - darsga bog'lanmagan */
  const lessonNo = ref<number | null>(0)
  const lessons = ref<GradeSheetLesson[]>([])
  const hasTimetable = ref(false)
  let requestId = 0

  const core = useBulkRows<GradeDraft, GradeSheetRow>({
    keyOf: (r) => r.studentId,
    hasRecord: (r) => r.gradeId !== null,
    equal: gradeDraftsEqual,
    // Baholanmagan va hech narsa kiritilmagan qator o'zgarish emas.
    isBlank: (d) => d.value === null && d.comment.trim() === '',
    validate: (r) => validateGradeDraft(r.draft),
  })
  const { rows, isDirty, invalidDirty, changedCount } = core

  async function load(opts: { keepDirty?: boolean } = {}) {
    const classId = getClassId()
    const subjectId = getSubjectId()
    if (!classId || !subjectId) {
      core.replaceRows([], false)
      return
    }
    const current = ++requestId
    loading.value = true
    loadError.value = null
    try {
      const sheet = await gradesApi.sheet(classId, subjectId, date.value, requestedLesson.value)
      if (current !== requestId) return
      className.value = sheet.class.name
      subjectName.value = sheet.subject.name
      backdateDays.value = sheet.settings.backdateDays
      editWindowHours.value = sheet.settings.editWindowHours
      lessonNo.value = sheet.lessonNo
      lessons.value = sheet.lessons ?? []
      hasTimetable.value = !!sheet.hasTimetable
      core.replaceRows(sheet.students.map(toGradeRow), !!opts.keepDirty)
    } catch (e) {
      if (current === requestId) loadError.value = e
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  const errorsOf = (r: GradeSheetRow): GradeDraftErrors => validateGradeDraft(r.draft)

  function statusOf(r: GradeSheetRow): GradeRowStatus {
    if (!r.editable) return 'locked'
    if (r.serverError) return 'error'
    if (isDirty(r)) return Object.keys(errorsOf(r)).length ? 'error' : 'dirty'
    return r.gradeId ? 'saved' : 'empty'
  }

  /** Fanning kunda bir nechta darsi bor, lekin dars hali tanlanmagan */
  const needsLesson = computed(() => lessons.value.length > 1 && lessonNo.value === null)
  const canSave = computed(
    () =>
      changedCount.value > 0 &&
      invalidDirty.value.length === 0 &&
      !saving.value &&
      lessonNo.value !== null,
  )

  /** Dars tanlash: tanlov saqlanadi va varaq shu dars uchun qayta yuklanadi */
  async function pickLesson(n: number | null) {
    requestedLesson.value = n
    await load()
  }
  const hasUnsaved = computed(() => changedCount.value > 0)

  /** Faqat o'zgargan va to'g'ri qatorlar. */
  const buildItems = (): BulkGradeItem[] =>
    core.validDirty().map((r) => ({
      studentId: r.studentId,
      value: r.draft.value as number,
      comment: r.draft.comment.trim() === '' ? null : r.draft.comment.trim(),
    }))

  const gradedCount = computed(() => rows.value.filter((r) => r.gradeId !== null).length)
  const total = computed(() => rows.value.length)

  async function save() {
    if (!canSave.value) return null
    const items = buildItems()
    saving.value = true
    try {
      const result = await gradesApi.bulk({
        classId: getClassId(),
        subjectId: getSubjectId(),
        date: date.value,
        lessonNo: lessonNo.value as number,
        items,
      })
      core.applyBulkResult(new Set(items.map((i) => i.studentId)), result.failed)
      // Server maydonlarini (id, editable) yangilaymiz; xatoli qoralamalar saqlanadi.
      await load({ keepDirty: true })
      return result
    } finally {
      saving.value = false
    }
  }

  return {
    date,
    className,
    subjectName,
    backdateDays,
    editWindowHours,
    requestedLesson,
    lessonNo,
    lessons,
    hasTimetable,
    needsLesson,
    pickLesson,
    rows,
    loading,
    loadError,
    saving,
    selected: core.selected,
    load,
    isDirty,
    errorsOf,
    statusOf,
    invalidDirty,
    changedCount,
    canSave,
    hasUnsaved,
    buildItems,
    gradedCount,
    total,
    patch: core.patch,
    applyToSelected: core.applyToSelected,
    toggleSelect: core.toggleSelect,
    selectAll: core.selectAll,
    save,
    discard: core.discard,
  }
}

export type GradeSheetState = ReturnType<typeof useGradeSheet>
