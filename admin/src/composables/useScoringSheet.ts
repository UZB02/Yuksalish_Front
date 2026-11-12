import { computed, ref } from 'vue'
import { scoresApi } from '@/api/scores.api'
import type { BehaviorType, BulkScoreItem, ScoringSettings, ScoringSheetStudent } from '@/api/types'
import {
  DEFAULT_SCORING,
  draftsEqual,
  hasErrors,
  resolveAutoScore,
  todayTashkent,
  validateDraft,
  type DraftErrors,
  type PenaltyContext,
  type RowDraft,
} from '@/utils/scoring'
import { useBulkRows, type BulkRow } from './useBulkRows'

export type RowStatus = 'empty' | 'saved' | 'dirty' | 'error' | 'locked'

export interface SheetRow extends BulkRow<RowDraft> {
  studentId: string
  fullName: string
  photo?: string | null
  studentCode: string | null
  /** Serverdagi mening bahom (id, editable) */
  scoreId: string | null
  dayScore: number | null
  scoresCount: number
  /** Ball xulq turidan avtomatik qo'yilgan (qo'lda o'zgartirilmagan). Serverdan kelganlar — false */
  autoFilled: boolean
}

const emptyDraft = (): RowDraft => ({ value: '', behaviorTypeId: null, comment: '' })

function toRow(s: ScoringSheetStudent): SheetRow {
  const d: RowDraft = s.myScore
    ? {
        // value null = faqat jarima qaydi: ball maydoni bo'sh qoladi
        value: s.myScore.value === null ? '' : String(s.myScore.value),
        behaviorTypeId: s.myScore.behaviorTypeId,
        comment: s.myScore.comment ?? '',
      }
    : emptyDraft()
  return {
    studentId: s.studentId,
    fullName: s.fullName,
    studentCode: s.studentCode,
    photo: s.photo ?? null,
    scoreId: s.myScore?.id ?? null,
    editable: s.myScore ? s.myScore.editable : true,
    dayScore: s.dayScore,
    scoresCount: s.scoresCount,
    autoFilled: false,
    baseline: { ...d },
    draft: { ...d },
    serverError: null,
  }
}

/**
 * Baholash varag'i holati: dirty tracking, sozlamalarga ko'ra validatsiya,
 * faqat o'zgargan qatorlarni bulk yuborish va failed qatorlarni qayta ishlash.
 * Umumiy mexanika `useBulkRows` da (davomat varag'i bilan bir xil).
 */
export function useScoringSheet(
  getClassId: () => string,
  getTypes: () => BehaviorType[] = () => [],
  /** Sozlamalar -> Reyting: xulq turi jarimasi yoqilganmi (ballsiz "faqat jarima" qaydi uchun) */
  getPenaltyEnabled: () => boolean = () => false,
) {
  const date = ref(todayTashkent())
  const className = ref('')
  const settings = ref<ScoringSettings>({ ...DEFAULT_SCORING })
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const saving = ref(false)
  let requestId = 0
  const penaltyCtx = (): PenaltyContext => ({
    enabled: getPenaltyEnabled(),
    types: getTypes(),
  })

  const core = useBulkRows<RowDraft, SheetRow>({
    keyOf: (r) => r.studentId,
    hasRecord: (r) => r.scoreId !== null,
    equal: draftsEqual,
    // Hech qachon baholanmagan va hech narsa kiritilmagan qator o'zgarish emas.
    // Faqat xulq turi tanlangan qator ham o'zgarish: aks holda saqlash jim o'chiq qoladi,
    // validatsiya esa "ball kiriting" xatosini ko'rsatadi.
    isBlank: (d) => d.value.trim() === '' && d.comment.trim() === '' && !d.behaviorTypeId,
    validate: (r) => validateDraft(r.draft, settings.value, penaltyCtx()),
  })
  const { rows, selected, isDirty, dirtyRows, invalidDirty, changedCount } = core

  async function load(opts: { keepDirty?: boolean } = {}) {
    const current = ++requestId
    loading.value = true
    loadError.value = null
    try {
      const sheet = await scoresApi.sheet(getClassId(), date.value)
      if (current !== requestId) return
      className.value = sheet.class.name
      settings.value = sheet.settings
      core.replaceRows(sheet.students.map(toRow), !!opts.keepDirty)
    } catch (e) {
      if (current === requestId) loadError.value = e
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  /**
   * Qatorni yangilaydi. Sozlama yoqilgan bo'lsa va xulq turi tanlansa, ball bo'sh yoki avtomatik
   * qo'yilgan bo'lgandagina turning standart balli qo'yiladi; ball qo'lda o'zgartirilsa — qo'lda.
   */
  function patch(key: string, change: Partial<RowDraft>) {
    const row = rows.value.find((r) => r.studentId === key)
    if (!row || !row.editable) return
    const next = { ...change }
    let auto = row.autoFilled
    if (change.value !== undefined) {
      auto = false
    } else if (change.behaviorTypeId) {
      const v = resolveAutoScore({
        settings: settings.value,
        type: getTypes().find((t) => t.id === change.behaviorTypeId),
        currentValue: row.draft.value,
        autoFilled: row.autoFilled,
      })
      if (v !== null) {
        next.value = v
        auto = true
      }
    }
    core.patch(key, next)
    row.autoFilled = auto
  }

  /** Tanlangan qatorlarga: aniq ball berilmagan bo'lsa xulq turi qoidasi har qator uchun alohida. */
  function applyToSelected(change: Partial<RowDraft>) {
    for (const r of rows.value) if (selected.has(r.studentId)) patch(r.studentId, change)
  }

  function discard() {
    core.discard()
    for (const r of rows.value) r.autoFilled = false
  }

  const errorsOf = (r: SheetRow): DraftErrors =>
    validateDraft(r.draft, settings.value, penaltyCtx())

  function statusOf(r: SheetRow): RowStatus {
    if (!r.editable) return 'locked'
    if (r.serverError) return 'error'
    if (isDirty(r)) return hasErrors(errorsOf(r)) ? 'error' : 'dirty'
    return r.scoreId ? 'saved' : 'empty'
  }

  const canSave = computed(
    () => changedCount.value > 0 && invalidDirty.value.length === 0 && !saving.value,
  )
  const hasUnsaved = computed(() => changedCount.value > 0)

  /** Faqat o'zgargan va to'g'ri qatorlar. */
  const buildItems = (): BulkScoreItem[] =>
    core.validDirty().map((r) => ({
      studentId: r.studentId,
      // Ball bo'sh (faqat jarima qaydi) bo'lsa null yuboriladi
      value: r.draft.value.trim() === '' ? null : Number(r.draft.value),
      behaviorTypeId: r.draft.behaviorTypeId,
      comment: r.draft.comment.trim() === '' ? null : r.draft.comment.trim(),
    }))

  const scoredCount = computed(() => rows.value.filter((r) => r.scoreId !== null).length)
  const total = computed(() => rows.value.length)

  async function save() {
    if (!canSave.value) return null
    const items = buildItems()
    saving.value = true
    try {
      const result = await scoresApi.bulk({ classId: getClassId(), date: date.value, items })
      core.applyBulkResult(new Set(items.map((i) => i.studentId)), result.failed)
      // Server maydonlarini (id, dayScore, editable) yangilaymiz; xatoli qoralamalar saqlanadi.
      await load({ keepDirty: true })
      return result
    } finally {
      saving.value = false
    }
  }

  return {
    date,
    className,
    settings,
    rows,
    loading,
    loadError,
    saving,
    selected,
    load,
    isDirty,
    errorsOf,
    statusOf,
    dirtyRows,
    invalidDirty,
    changedCount,
    canSave,
    hasUnsaved,
    buildItems,
    scoredCount,
    total,
    patch,
    applyToSelected,
    toggleSelect: core.toggleSelect,
    selectAll: core.selectAll,
    save,
    discard,
  }
}

export type ScoringSheetState = ReturnType<typeof useScoringSheet>
