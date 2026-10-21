import { computed, reactive, ref, type Ref } from 'vue'

/** Baholash va davomat varaqlari uchun umumiy qator: saqlangan holat (baseline) va tahrir (draft). */
export interface BulkRow<D> {
  editable: boolean
  baseline: D
  draft: D
  /** Server (bulk) xatosi */
  serverError: string | null
}

export interface BulkRowsConfig<D, Row extends BulkRow<D>> {
  keyOf: (row: Row) => string
  /** Serverda yozuv mavjudmi */
  hasRecord: (row: Row) => boolean
  equal: (a: D, b: D) => boolean
  /** Hech narsa kiritilmaganmi (yozuvsiz qator uchun - o'zgarish emas) */
  isBlank: (draft: D) => boolean
  /** Qator xatolari (bo'sh obyekt = to'g'ri) */
  validate: (row: Row) => object
}

export interface BulkFailure {
  studentId: string
  message: string
}

/**
 * Umumiy varaq mexanikasi (useScoringSheet va useAttendanceSheet uchun): dirty tracking,
 * qoralamani yangilanishda saqlash, ommaviy qo'llash, bulk natijasini qayta ishlash.
 */
export function useBulkRows<D, Row extends BulkRow<D>>(cfg: BulkRowsConfig<D, Row>) {
  const rows = ref([]) as Ref<Row[]>
  const selected = reactive(new Set<string>())
  const clone = (d: D): D => ({ ...(d as object) }) as D

  const hasErrors = (row: Row) => Object.keys(cfg.validate(row)).length > 0

  function isDirty(row: Row): boolean {
    if (!row.editable) return false
    if (!cfg.hasRecord(row) && cfg.isBlank(row.draft)) return false
    return !cfg.equal(row.draft, row.baseline)
  }

  const dirtyRows = computed(() => rows.value.filter(isDirty))
  const invalidDirty = computed(() => dirtyRows.value.filter(hasErrors))
  const changedCount = computed(() => dirtyRows.value.length)

  /** Faqat o'zgargan va xatosiz qatorlar. */
  const validDirty = () => dirtyRows.value.filter((r) => !hasErrors(r))

  function patch(key: string, change: Partial<D>) {
    const r = rows.value.find((x) => cfg.keyOf(x) === key)
    if (!r || !r.editable) return
    r.draft = { ...r.draft, ...change }
    r.serverError = null
  }

  /** Serverdan kelgan yangi qatorlar; saqlanmagan qoralamalar (va xatolari) yo'qolmaydi. */
  function replaceRows(fresh: Row[], keepDirty: boolean) {
    const prev = new Map(rows.value.map((r) => [cfg.keyOf(r), r]))
    rows.value = fresh.map((row) => {
      const old = prev.get(cfg.keyOf(row))
      if (keepDirty && old && !cfg.equal(old.draft, old.baseline)) {
        row.draft = clone(old.draft)
        row.serverError = old.serverError
      }
      return row
    })
    if (!keepDirty) selected.clear()
  }

  /** Bulk natijasi: yuborilgan qatorlarning xatolisi serverError ga, qolgani saqlangan deb belgilanadi. */
  function applyBulkResult(sentKeys: Set<string>, failed: BulkFailure[]) {
    const messages = new Map(failed.map((f) => [f.studentId, f.message]))
    for (const r of rows.value) {
      const key = cfg.keyOf(r)
      if (!sentKeys.has(key)) continue
      const msg = messages.get(key)
      if (msg) r.serverError = msg
      else {
        r.baseline = clone(r.draft)
        r.serverError = null
      }
    }
  }

  function discard() {
    for (const r of rows.value) {
      r.draft = clone(r.baseline)
      r.serverError = null
    }
  }

  function applyToSelected(change: Partial<D>) {
    for (const r of rows.value) if (selected.has(cfg.keyOf(r))) patch(cfg.keyOf(r), change)
  }

  function toggleSelect(key: string, on: boolean) {
    if (on) selected.add(key)
    else selected.delete(key)
  }

  function selectAll(keys: string[], on: boolean) {
    for (const k of keys) toggleSelect(k, on)
  }

  return {
    rows,
    selected,
    isDirty,
    dirtyRows,
    invalidDirty,
    changedCount,
    validDirty,
    hasErrors,
    patch,
    replaceRows,
    applyBulkResult,
    discard,
    applyToSelected,
    toggleSelect,
    selectAll,
  }
}
