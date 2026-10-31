import { computed, ref } from 'vue'
import {
  timetableApi,
  type ActivatePayload,
  type ActivationPreview,
  type BusyTeacher,
  type ClassVersions,
  type CopyFrom,
  type TimetableOptions,
  type TimetableVersion,
  type TimetableWarning,
} from '@/api/timetable.api'
import {
  cellKey,
  cellsSignature,
  cellsToPayload,
  clearDay,
  copyDay,
  entriesToCells,
  maxLessonNo,
  rowCountFor,
  TIMETABLE_MAX_LESSONS,
  severityOf,
  warningsByCell,
  type CellMap,
  type CellValue,
} from '@/utils/timetable'
import { issueKey } from '@/utils/timetableIssues'

export type EditorMode = 'readonly' | 'view' | 'draft' | 'correct'

/**
 * Sinf jadvali muharriri holati: versiyalar, tanlangan versiya, kataklar (hafta kuni x dars),
 * o'zgarish (dirty) holati, ogohlantirishlar va saqlash/faollashtirish amallari.
 * `canManage` — timetable.manage borligi (yo'q bo'lsa muharrir faqat o'qish uchun).
 */
export function useTimetableEditor(classId: () => string, canManage: () => boolean) {
  const loading = ref(false)
  const loadingVersion = ref(false)
  const saving = ref(false)
  const error = ref<unknown>(null)
  const info = ref<ClassVersions | null>(null)
  const options = ref<TimetableOptions | null>(null)
  const version = ref<TimetableVersion | null>(null)
  const cells = ref<CellMap>({})
  const baseSignature = ref('')
  const validFrom = ref('')
  const note = ref('')
  const baseValidFrom = ref('')
  const warnings = ref<TimetableWarning[]>([])
  /** Serverdan kelgan (saqlangan holat) ogohlantirishlari: bekor qilinganda tiklanadi */
  const baseWarnings = ref<TimetableWarning[]>([])
  const correcting = ref(false)
  /** Qatorlar soni qo'lda o'zgartirilgan bo'lsa (ko'rinish holati, saqlanmaydi) */
  const rowsOverride = ref<number | null>(null)

  const settings = computed(() => info.value?.settings ?? { workingWeekdays: [], lessonsPerDay: 0 })
  const today = computed(() => info.value?.today ?? '')
  const archived = computed(() => !!info.value?.class.isArchived)

  const mode = computed<EditorMode>(() => {
    const v = version.value
    if (!v) return 'readonly'
    if (!canManage() || archived.value) return 'readonly'
    if (v.status === 'draft') return 'draft'
    if (correcting.value && v.phase !== 'past' && v.phase !== 'replaced') return 'correct'
    return 'view'
  })
  const editable = computed(() => mode.value === 'draft' || mode.value === 'correct')

  const dirty = computed(
    () =>
      editable.value &&
      (cellsSignature(cells.value) !== baseSignature.value ||
        (mode.value === 'draft' && validFrom.value !== baseValidFrom.value)),
  )
  const changeCount = computed(() => {
    if (!dirty.value) return 0
    // Katak (bir nechta dars bo'lishi mumkin) bo'yicha: o'zgargan kataklar soni
    const group = (list: { weekday: number; lessonNo: number }[]) => {
      const m = new Map<string, string[]>()
      for (const e of list) {
        const k = cellKey(e.weekday, e.lessonNo)
        m.set(k, [...(m.get(k) ?? []), JSON.stringify(e)])
      }
      return new Map([...m].map(([k, v]) => [k, v.sort().join('|')]))
    }
    const now = group(cellsToPayload(cells.value))
    let base: { weekday: number; lessonNo: number }[] = []
    try {
      base = JSON.parse(baseSignature.value || '[]')
    } catch {
      base = []
    }
    const before = group(base)
    let n = 0
    for (const [k, v] of now) if (before.get(k) !== v) n++
    for (const k of before.keys()) if (!now.has(k)) n++
    return Math.max(n, validFrom.value !== baseValidFrom.value ? 1 : 0)
  })

  /** Dam olish kuniga qo'yilgan kataklar (dars raqami 1..12 serverda tekshiriladi) */
  const outOfRangeKeys = computed(() => {
    const s = settings.value
    return Object.keys(cells.value).filter((k) => {
      const [w, n] = k.split(':').map(Number) as [number, number]
      return !s.workingWeekdays.includes(w) || n > TIMETABLE_MAX_LESSONS
    })
  })
  const gridWeekdays = computed(() => {
    const extra = outOfRangeKeys.value
      .map((k) => Number(k.split(':')[0]))
      .filter((w) => !settings.value.workingWeekdays.includes(w))
    return [...new Set([...settings.value.workingWeekdays, ...extra])].sort((a, b) => a - b)
  })
  /** Qatorlar: max(sozlamadagi darslar soni, ishlatilgan eng katta dars, 1); qo'lda qo'shish/olib tashlash bilan */
  const gridLessons = computed(() =>
    rowCountFor(rowsOverride.value ?? settings.value.lessonsPerDay, maxLessonNo(cells.value)),
  )
  const canAddLesson = computed(() => editable.value && gridLessons.value < TIMETABLE_MAX_LESSONS)
  /** Oxirgi qator hamma kunlarda bo'sh bo'lsa (va kamida 1 qator qolsa) olib tashlanadi */
  const canRemoveLesson = computed(
    () => editable.value && gridLessons.value > 1 && maxLessonNo(cells.value) < gridLessons.value,
  )
  function addLesson() {
    if (canAddLesson.value) rowsOverride.value = gridLessons.value + 1
  }
  function removeLastLesson() {
    if (canRemoveLesson.value) rowsOverride.value = gridLessons.value - 1
  }
  const warningsMap = computed(() => warningsByCell(warnings.value))
  /** Majburlashni talab qiladigan (xato) noyob muammolar soni */
  const blockingCount = computed(
    () =>
      new Set(warnings.value.filter((w) => w.severity === 'error').map((w) => issueKey(w))).size,
  )
  const cellSeverity = (weekday: number, lessonNo: number) =>
    severityOf(warningsMap.value[cellKey(weekday, lessonNo)])

  function applyVersion(v: TimetableVersion, w: TimetableWarning[]) {
    version.value = v
    cells.value = entriesToCells(v.entries)
    baseSignature.value = cellsSignature(cells.value)
    validFrom.value = v.validFrom
    baseValidFrom.value = v.validFrom
    note.value = v.note ?? ''
    warnings.value = w
    baseWarnings.value = w
    correcting.value = false
    rowsOverride.value = null
  }

  async function loadVersion(id: string) {
    loadingVersion.value = true
    try {
      const r = await timetableApi.version(id)
      applyVersion(r.version, r.warnings)
    } finally {
      loadingVersion.value = false
    }
  }

  /** Dastlabki versiya: qoralama (boshqaruvchi uchun), joriy, kelgusi, eng oxirgi */
  function initialVersionId(list: ClassVersions['versions']): string | null {
    const pick = (f: (v: ClassVersions['versions'][number]) => boolean) => list.find(f)?.id
    return (
      (canManage() ? pick((v) => v.status === 'draft') : undefined) ??
      pick((v) => v.phase === 'current') ??
      pick((v) => v.phase === 'future') ??
      list[0]?.id ??
      null
    )
  }

  async function refreshInfo() {
    info.value = await timetableApi.versions(classId())
  }

  async function load(selectId?: string) {
    loading.value = true
    error.value = null
    try {
      const [i, o] = await Promise.all([
        timetableApi.versions(classId()),
        canManage() ? timetableApi.options(classId()) : Promise.resolve(null),
      ])
      info.value = i
      options.value = o
      const id = selectId ?? initialVersionId(i.versions)
      if (id) await loadVersion(id)
      else {
        version.value = null
        cells.value = {}
        warnings.value = []
        baseSignature.value = cellsSignature({})
      }
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  const invalidate = (keys: string[]) => {
    if (!warnings.value.length) return
    const set = new Set(keys)
    warnings.value = warnings.value.filter((w) => !set.has(cellKey(w.weekday, w.lessonNo)))
  }

  /** Katakdagi darslarni almashtiradi (bo'sh ro'yxat/null — katakni tozalaydi) */
  function setCell(weekday: number, lessonNo: number, value: CellValue[] | CellValue | null) {
    if (!editable.value) return
    const k = cellKey(weekday, lessonNo)
    const list = value === null ? [] : Array.isArray(value) ? value : [value]
    const next = { ...cells.value }
    if (list.length) next[k] = list
    else delete next[k]
    cells.value = next
    invalidate([k])
  }

  /** Kataklarni to'liq almashtirish (boshqa versiya/sinfdan nusxa) */
  function replaceCells(next: CellMap) {
    if (!editable.value) return
    cells.value = next
    warnings.value = []
  }

  function copyDayTo(from: number, to: number) {
    if (!editable.value || from === to) return
    cells.value = copyDay(cells.value, from, to, gridLessons.value)
    warnings.value = warnings.value.filter((w) => w.weekday !== to)
  }

  function clearDayOf(weekday: number) {
    if (!editable.value) return
    cells.value = clearDay(cells.value, weekday)
    warnings.value = warnings.value.filter((w) => w.weekday !== weekday)
  }

  function discard() {
    if (!version.value) return
    cells.value = entriesToCells(version.value.entries)
    validFrom.value = baseValidFrom.value
    note.value = version.value.note ?? ''
    warnings.value = baseWarnings.value
    rowsOverride.value = null
  }

  function startCorrect() {
    if (
      version.value &&
      version.value.status !== 'draft' &&
      version.value.phase !== 'past' &&
      version.value.phase !== 'replaced'
    ) {
      correcting.value = true
    }
  }
  function cancelCorrect() {
    correcting.value = false
    discard()
  }

  /** Saqlash: qoralama -> PUT, tuzatish -> correct (force/note faqat to'qnashuvda) */
  async function save(opts: { force?: boolean; note?: string } = {}) {
    const v = version.value
    if (!v || !editable.value) return null
    saving.value = true
    try {
      const entries = cellsToPayload(cells.value)
      const r =
        mode.value === 'draft'
          ? await timetableApi.saveDraft(v.id, {
              entries,
              validFrom: validFrom.value,
              note: note.value.trim() || null,
            })
          : await timetableApi.correct(v.id, { entries, force: opts.force, note: opts.note })
      applyVersion(r.version, r.warnings)
      await refreshInfo()
      return r
    } finally {
      saving.value = false
    }
  }

  async function createChange(copyFrom: CopyFrom | undefined, from?: string) {
    const r = await timetableApi.createVersion(classId(), { copyFrom, validFrom: from })
    await refreshInfo()
    applyVersion(r.version, r.warnings)
    return r.version
  }

  async function removeVersion(id: string) {
    await timetableApi.deleteVersion(id)
    await load()
  }

  async function activate(payload: ActivatePayload) {
    const v = version.value
    if (!v) return null
    const r = await timetableApi.activate(v.id, payload)
    await refreshInfo()
    applyVersion(r.version, r.warnings)
    return r
  }

  /** Faollashtirish oynasi uchun: tanlangan sana bo'yicha ogohlantirishlar (saqlangan holat bo'yicha) */
  async function previewWarnings(from: string): Promise<ActivationPreview> {
    const v = version.value
    if (!v) return { warnings: [], willReplace: [] }
    const r = await timetableApi.version(v.id, from)
    return { warnings: r.warnings, willReplace: r.willReplace ?? [] }
  }

  /** Katak uchun boshqa sinflarda band o'qituvchilar (tahrirlash oynasi) */
  async function loadBusy(weekday: number, lessonNo: number): Promise<BusyTeacher[]> {
    const v = version.value
    if (!v || !canManage()) return []
    const r = await timetableApi.busyTeachers(
      v.id,
      weekday,
      lessonNo,
      mode.value === 'draft' ? validFrom.value : undefined,
    )
    return r.items
  }

  return {
    loading,
    loadingVersion,
    saving,
    error,
    info,
    options,
    version,
    cells,
    validFrom,
    note,
    warnings,
    warningsMap,
    blockingCount,
    settings,
    today,
    archived,
    mode,
    editable,
    dirty,
    changeCount,
    outOfRangeKeys,
    gridWeekdays,
    gridLessons,
    canAddLesson,
    canRemoveLesson,
    addLesson,
    removeLastLesson,
    cellSeverity,
    load,
    loadVersion,
    setCell,
    replaceCells,
    copyDayTo,
    clearDayOf,
    discard,
    startCorrect,
    cancelCorrect,
    save,
    createChange,
    removeVersion,
    activate,
    previewWarnings,
    loadBusy,
  }
}
