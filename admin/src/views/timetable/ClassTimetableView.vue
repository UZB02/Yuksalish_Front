<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, CircleCheck, CirclePlus, CircleX, Pencil, TriangleAlert } from 'lucide-vue-next'
import { isApiError } from '@/api/errors'
import {
  timetableApi,
  type ActivatePayload,
  type BusyTeacher,
  type ClassOverviewRow,
} from '@/api/timetable.api'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ActivateModal from '@/components/timetable/ActivateModal.vue'
import CellEditorModal from '@/components/timetable/CellEditorModal.vue'
import TimetableIssuesDrawer from '@/components/timetable/TimetableIssuesDrawer.vue'
import TimetableDayList from '@/components/timetable/TimetableDayList.vue'
import TimetableGrid from '@/components/timetable/TimetableGrid.vue'
import VersionPanel from '@/components/timetable/VersionPanel.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StickySaveBar from '@/components/ui/StickySaveBar.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { usePermission } from '@/composables/usePermission'
import { useTimetableEditor } from '@/composables/useTimetableEditor'
import { useToast } from '@/composables/useToast'
import { PERMISSIONS } from '@/constants/permissions'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { cellKey, versionLabel, type CellValue } from '@/utils/timetable'
import {
  buildIssues,
  countIssues,
  issueContextFrom,
  issuesByCell,
  type TimetableIssue,
} from '@/utils/timetableIssues'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const { can, isSuperadmin } = usePermission()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()
const mobile = useMediaQuery('(max-width: 767px)')

const classId = computed(() => String(route.params.id))
const canManage = computed(() => isSuperadmin() || can(PERMISSIONS.TIMETABLE_MANAGE))
const canViewAll = computed(() => canManage.value || can(PERMISSIONS.TIMETABLE_VIEW))
const ed = useTimetableEditor(
  () => classId.value,
  () => canManage.value,
)

const loadError = computed(() => (ed.error.value ? errorMessage(ed.error.value, t) : ''))
const className = computed(() => ed.info.value?.class.name ?? '')
const v = computed(() => ed.version.value)
const fmt = (d: string | null) => (d ? formatDate(d) : '')
const todayWeekday = computed(() => {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
})

/** Muvaffaqiyatli faollashtirish/chiqishdan keyin ogohlantirilmaydi */
let skipLeaveGuard = false
const backTo = computed(() =>
  canViewAll.value
    ? { name: 'timetable' }
    : { name: 'class-detail', params: { id: classId.value } },
)

// ---------- Versiya tanlash ----------
const versionOptions = computed(() =>
  (ed.info.value?.versions ?? []).map((x) => ({ value: x.id, label: versionLabel(x, t, fmt) })),
)

async function confirmDiscard(): Promise<boolean> {
  if (!ed.dirty.value) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: t('timetable.unsavedText'),
    confirmText: t('scoring.unsaved.leave'),
    variant: 'danger',
  })
}

async function selectVersion(id: string) {
  if (id === v.value?.id) return
  if (!(await confirmDiscard())) return
  try {
    await ed.loadVersion(id)
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

// ---------- Yangi o'zgarish / nusxa ----------
async function createChange(copyFrom?: 'active' | string | { classId: string }) {
  if (!(await confirmDiscard())) return
  try {
    await ed.createChange(copyFrom)
    toast.success(t('timetable.draftCreated'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

const hasActive = computed(() => (ed.info.value?.versions ?? []).some((x) => x.status !== 'draft'))
const prevVersions = computed(() =>
  (ed.info.value?.versions ?? []).filter((x) => x.id !== v.value?.id && x.status !== 'draft'),
)

const copyOpen = ref<'version' | 'class' | null>(null)
const copySource = ref('')
const otherClasses = ref<ClassOverviewRow[]>([])
const copyOptions = computed(() =>
  copyOpen.value === 'version'
    ? prevVersions.value.map((x) => ({ value: x.id, label: versionLabel(x, t, fmt) }))
    : otherClasses.value
        .filter((c) => c.classId !== classId.value && (c.current || c.upcoming))
        .map((c) => ({ value: c.classId, label: c.name })),
)
async function openCopy(kind: 'version' | 'class') {
  copySource.value = ''
  copyOpen.value = kind
  if (kind === 'class' && !otherClasses.value.length) {
    try {
      otherClasses.value = (await timetableApi.overview()).classes
    } catch (e) {
      toast.error(errorMessage(e, t))
    }
  }
}
/** Qoralamaga nusxa: hozirgi qoralama yozuvlari almashtiriladi (yangi qoralama yaratilmaydi) */
async function applyCopy() {
  if (!copySource.value || !v.value) return
  const kind = copyOpen.value
  copyOpen.value = null
  try {
    const row = otherClasses.value.find((c) => c.classId === copySource.value)
    // Boshqa sinfdan: uning joriy (bo'lmasa kelgusi) jadvali
    const versionId = kind === 'version' ? copySource.value : (row?.current ?? row?.upcoming)?.id
    if (!versionId) return
    const cells: Record<string, CellValue> = {}
    for (const e of (await timetableApi.version(versionId)).version.entries) {
      if (e.outOfRange) continue
      cells[cellKey(e.weekday, e.lessonNo)] = {
        subjectId: e.subjectId,
        teacherId: e.teacherId,
        room: e.room,
        subjectName: e.subject?.name,
        teacherName: e.teacher?.fullName,
      }
    }
    ed.replaceCells(cells)
    toast.info(t('timetable.copied'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

// ---------- Muammolar ----------
const issueCtx = computed(() => issueContextFrom(ed.options.value, ed.cells.value))
const issues = computed(() => buildIssues(ed.warnings.value, t, issueCtx.value))
const issueCounts = computed(() => countIssues(issues.value))
const issuesMap = computed(() => issuesByCell(issues.value))
const issuesOpen = ref(false)
const focusWeekday = ref<number | undefined>()
const issueSummaryLabel = computed(() =>
  [
    issueCounts.value.error ? t('timetable.issues.nError', { n: issueCounts.value.error }) : '',
    issueCounts.value.warning
      ? t('timetable.issues.nWarning', { n: issueCounts.value.warning })
      : '',
  ]
    .filter(Boolean)
    .join(', '),
)

/** Katakni ko'rinadigan qilib, qisqa vaqt ajratib ko'rsatadi */
async function jumpToCell(weekday: number, lessonNo: number) {
  focusWeekday.value = undefined
  await nextTick()
  focusWeekday.value = weekday
  await nextTick()
  const el = document.querySelector<HTMLElement>(`[data-cell="${cellKey(weekday, lessonNo)}"]`)
  if (!el) return
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  el.classList.remove('tt-pulse')
  void el.offsetWidth
  el.classList.add('tt-pulse')
  setTimeout(() => el.classList.remove('tt-pulse'), 2000)
}
function onIssueJump(i: TimetableIssue) {
  if (mobile.value) issuesOpen.value = false
  void jumpToCell(i.weekday, i.lessonNo)
}
function onIssueEdit(i: TimetableIssue) {
  openCell(i.weekday, i.lessonNo)
}

// ---------- Katak tahriri ----------
const cellOpen = ref<{ weekday: number; lessonNo: number } | null>(null)
const editingCell = computed(() =>
  cellOpen.value
    ? ed.cells.value[cellKey(cellOpen.value.weekday, cellOpen.value.lessonNo)]
    : undefined,
)
const busy = ref<BusyTeacher[]>([])
let busySeq = 0
function openCell(weekday: number, lessonNo: number) {
  if (!ed.editable.value) return
  cellOpen.value = { weekday, lessonNo }
  busy.value = []
  const my = ++busySeq
  ed.loadBusy(weekday, lessonNo)
    .then((items) => {
      if (my === busySeq) busy.value = items
    })
    .catch(() => {
      /* band belgilari ixtiyoriy: yuklanmasa jim o'tadi */
    })
}
function saveCell(value: CellValue) {
  if (!cellOpen.value) return
  ed.setCell(cellOpen.value.weekday, cellOpen.value.lessonNo, value)
  cellOpen.value = null
}
function clearCell(weekday?: number, lessonNo?: number) {
  const c = weekday !== undefined && lessonNo !== undefined ? { weekday, lessonNo } : cellOpen.value
  if (!c) return
  ed.setCell(c.weekday, c.lessonNo, null)
  cellOpen.value = null
}

// ---------- Kun amallari ----------
const copyDayFrom = ref<number | null>(null)
const copyDayTarget = ref('')
async function onDayAction(weekday: number, action: 'copy' | 'clear') {
  if (action === 'copy') {
    copyDayFrom.value = weekday
    copyDayTarget.value = ''
    return
  }
  const ok = await confirm({
    title: t('timetable.clearDayTitle', { day: t(`journal.weekdayLong.${weekday}`) }),
    message: t('timetable.clearDayText'),
    confirmText: t('timetable.clearDay'),
    variant: 'danger',
  })
  if (ok) ed.clearDayOf(weekday)
}
const dayTargetOptions = computed(() =>
  ed.gridWeekdays.value
    .filter((w) => w !== copyDayFrom.value)
    .map((w) => ({ value: String(w), label: t(`journal.weekdayLong.${w}`) })),
)
function applyCopyDay() {
  if (copyDayFrom.value === null || !copyDayTarget.value) return
  ed.copyDayTo(copyDayFrom.value, Number(copyDayTarget.value))
  copyDayFrom.value = null
}

// ---------- Saqlash ----------
const forceOpen = ref(false)
const forceNote = ref('')
async function save(opts: { force?: boolean; note?: string } = {}) {
  try {
    const r = await ed.save(opts)
    if (r) toast.success(t(ed.mode.value === 'draft' ? 'timetable.saved' : 'timetable.corrected'))
    forceOpen.value = false
  } catch (e) {
    if (
      isApiError(e) &&
      e.code === 'CONFLICT' &&
      ed.mode.value === 'correct' &&
      e.details.some((d) => d.path === 'force')
    ) {
      forceNote.value = ''
      forceOpen.value = true
      return
    }
    toast.error(errorMessage(e, t))
  }
}

const saveMessage = computed(() => {
  if (ed.mode.value === 'correct') return t('timetable.correctBar')
  return ed.dirty.value ? t('timetable.unsavedBar') : ''
})

// ---------- Faollashtirish ----------
const activateOpen = ref(false)
const activating = ref(false)
async function onActivate(payload: ActivatePayload) {
  activating.value = true
  try {
    const r = await ed.activate(payload)
    activateOpen.value = false
    toast.success(t('timetable.activated'))
    if (r?.syncedAssignments?.length) {
      toast.info(t('timetable.syncedN', { n: r.syncedAssignments.length }))
    }
  } catch (e) {
    toast.error(isApiError(e) && e.status === 409 ? e.message : errorMessage(e, t))
  } finally {
    activating.value = false
  }
}
async function openActivate() {
  // Saqlanmagan o'zgarishlar bilan faollashtirib bo'lmaydi: avval saqlaymiz
  if (ed.dirty.value) {
    await save()
    if (ed.dirty.value) return
  }
  activateOpen.value = true
}

// ---------- Versiya amallari ----------
async function removeVersion(id: string) {
  const target = ed.info.value?.versions.find((x) => x.id === id)
  const ok = await confirm({
    title: t('timetable.deleteTitle'),
    message: t(
      target?.phase === 'future' ? 'timetable.deleteFutureText' : 'timetable.deleteDraftText',
    ),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await ed.removeVersion(id)
    toast.success(t('timetable.deleted'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

const menuItems = computed<DropdownItem[]>(() => {
  const items: DropdownItem[] = []
  if (ed.mode.value === 'draft') {
    items.push(
      {
        key: 'copyVersion',
        label: t('timetable.copyFromVersion'),
        disabled: !prevVersions.value.length,
      },
      { key: 'copyClass', label: t('timetable.copyFromClass') },
    )
  }
  if (ed.mode.value === 'view' && v.value && v.value.phase !== 'past') {
    items.push({ key: 'correct', label: t('timetable.correct') })
  }
  if (v.value && (v.value.phase === 'draft' || v.value.phase === 'future')) {
    items.push({
      key: 'remove',
      label: t('timetable.deleteVersion'),
      danger: true,
      separator: true,
    })
  }
  return items
})
async function onMenu(key: string) {
  if (key === 'copyVersion') await openCopy('version')
  else if (key === 'copyClass') await openCopy('class')
  else if (key === 'correct') ed.startCorrect()
  else if (key === 'remove' && v.value) await removeVersion(v.value.id)
}

const phaseTone = { draft: 'warning', current: 'success', future: 'info', past: 'neutral' } as const
const showEditor = computed(() => !ed.loading.value && !loadError.value && !!v.value)
const noVersions = computed(() => !ed.loading.value && !loadError.value && !v.value)

// ---------- Hayot tsikli ----------
function reload() {
  if (!needsSchool.value) void ed.load()
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  reload()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
watch(classId, reload)
watch(
  () => schoolCtx.schoolId,
  () => {
    skipLeaveGuard = true
    void router.replace({ name: 'timetable' })
  },
)
onBeforeRouteLeave(async () => {
  if (skipLeaveGuard || !ed.dirty.value) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: t('timetable.unsavedText'),
    confirmText: t('scoring.unsaved.leave'),
    variant: 'danger',
  })
})
function beforeUnload(e: BeforeUnloadEvent) {
  if (!skipLeaveGuard && ed.dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <header class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      <RouterLink
        :to="backTo"
        class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('timetable.back') }}
      </RouterLink>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl" data-testid="tt-title">
          {{ t('timetable.classTitle', { name: className }) }}
        </h1>
        <p class="mt-0.5 text-sm text-fg-muted">
          {{ ed.info.value?.academicYear.name }}
          <BaseBadge v-if="ed.archived.value" tone="warning" class="ml-1">
            {{ t('timetable.archivedClass') }}
          </BaseBadge>
        </p>
      </div>
      <div v-if="showEditor || noVersions" class="flex flex-wrap items-end gap-2">
        <BaseSelect
          v-if="ed.info.value?.versions.length"
          :model-value="v?.id ?? ''"
          :options="versionOptions"
          :label="t('timetable.version')"
          class="w-full sm:w-72"
          data-testid="version-select"
          @update:model-value="selectVersion"
        />
        <BaseButton
          v-if="canManage && !ed.archived.value && hasActive"
          variant="secondary"
          data-testid="new-change"
          @click="createChange('active')"
        >
          <CirclePlus class="h-4 w-4" /> {{ t('timetable.newChange') }}
        </BaseButton>
        <DropdownMenu
          v-if="menuItems.length"
          :items="menuItems"
          :label="t('timetable.moreActions')"
          @select="onMenu"
        />
      </div>
    </header>

    <div v-if="ed.loading.value" class="space-y-3">
      <Skeleton class="h-10 w-full" />
      <Skeleton class="h-72 w-full" />
    </div>

    <div v-else-if="loadError" class="card">
      <EmptyState :title="t('timetable.loadFailed')" :description="loadError">
        <BaseButton variant="secondary" @click="reload">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>

    <div v-else-if="noVersions" class="card" data-testid="no-versions">
      <EmptyState :title="t('timetable.noTimetable')" :description="t('timetable.noTimetableText')">
        <div v-if="canManage && !ed.archived.value" class="flex flex-wrap justify-center gap-2">
          <BaseButton data-testid="create-first" @click="createChange()">
            <CirclePlus class="h-4 w-4" /> {{ t('timetable.create') }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            @click="
              async () => {
                await createChange()
                await openCopy('class')
              }
            "
          >
            {{ t('timetable.copyFromClass') }}
          </BaseButton>
        </div>
      </EmptyState>
    </div>

    <template v-else-if="v">
      <!-- Holat paneli -->
      <section
        class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3"
        data-testid="status-bar"
      >
        <BaseBadge :tone="phaseTone[v.phase]">{{ t(`timetable.phase.${v.phase}`) }}</BaseBadge>
        <template v-if="ed.mode.value === 'draft'">
          <BaseInput
            v-model="ed.validFrom.value"
            type="date"
            :min="ed.info.value?.academicYear.startDate"
            :max="ed.info.value?.academicYear.endDate"
            :aria-label="t('timetable.validFrom')"
            class="w-44"
            data-testid="valid-from"
          />
        </template>
        <span v-else class="text-sm text-fg">
          {{ fmt(v.validFrom) }} – {{ v.validTo ? fmt(v.validTo) : '…' }}
        </span>
        <button
          v-if="issueCounts.total"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-sm font-medium hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          :aria-label="`${t('timetable.issues.panelTitle')}: ${issueSummaryLabel}`"
          aria-haspopup="dialog"
          data-testid="issue-summary"
          @click="issuesOpen = true"
        >
          <span
            v-if="issueCounts.error"
            class="inline-flex items-center gap-1 text-danger"
            data-testid="summary-errors"
          >
            <CircleX class="h-4 w-4" aria-hidden="true" />
            {{ t('timetable.issues.summaryErrors', { n: issueCounts.error }) }}
          </span>
          <span
            v-if="issueCounts.error && issueCounts.warning"
            class="text-fg-muted"
            aria-hidden="true"
          >
            ·
          </span>
          <span
            v-if="issueCounts.warning"
            class="inline-flex items-center gap-1 text-warning"
            data-testid="summary-warnings"
          >
            <TriangleAlert class="h-4 w-4" aria-hidden="true" />
            {{ t('timetable.issues.summaryWarnings', { n: issueCounts.warning }) }}
          </span>
        </button>
        <span
          v-else
          class="inline-flex items-center gap-1 text-sm text-success"
          data-testid="issue-summary-ok"
        >
          <CircleCheck class="h-4 w-4" aria-hidden="true" />
          {{ t('timetable.issues.none') }}
        </span>
        <BaseBadge v-if="v.forced" tone="danger">{{ t('timetable.forced') }}</BaseBadge>
        <div v-if="ed.mode.value === 'draft'" class="ml-auto flex flex-wrap items-center gap-3">
          <p
            v-if="issueCounts.error"
            class="flex items-center gap-1.5 text-xs text-danger"
            data-testid="activate-blocked-hint"
          >
            <CircleX class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ t('timetable.issues.blockedHint', { n: issueCounts.error }) }}</span>
            <button
              type="button"
              class="font-medium underline underline-offset-2 hover:no-underline"
              data-testid="activate-hint-open"
              @click="issuesOpen = true"
            >
              {{ t('timetable.issues.openPanel') }}
            </button>
          </p>
          <BaseButton
            :loading="ed.saving.value"
            :title="
              issueCounts.error
                ? t('timetable.issues.blockedHint', { n: issueCounts.error })
                : undefined
            "
            data-testid="activate-open"
            @click="openActivate"
          >
            {{ t('timetable.activate.open') }}
          </BaseButton>
        </div>
        <BaseButton
          v-else-if="
            canManage && !ed.archived.value && ed.mode.value === 'view' && v.phase !== 'past'
          "
          class="ml-auto"
          variant="secondary"
          data-testid="correct-start"
          @click="ed.startCorrect()"
        >
          <Pencil class="h-4 w-4" /> {{ t('timetable.correct') }}
        </BaseButton>
        <BaseButton
          v-else-if="ed.mode.value === 'correct'"
          class="ml-auto"
          variant="ghost"
          @click="ed.cancelCorrect()"
        >
          {{ t('timetable.cancelCorrect') }}
        </BaseButton>
      </section>

      <div
        v-if="ed.mode.value === 'correct'"
        class="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
        data-testid="correct-banner"
      >
        {{ t('timetable.correctWarning') }}
      </div>
      <div
        v-if="v.phase === 'past' && canManage"
        class="mb-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-fg-muted"
      >
        {{ t('timetable.pastReadonly') }}
      </div>

      <TimetableDayList
        v-if="mobile"
        :weekdays="ed.gridWeekdays.value"
        :lessons-per-day="ed.settings.value.lessonsPerDay"
        :cells="ed.cells.value"
        :issues-map="issuesMap"
        :out-of-range-keys="ed.outOfRangeKeys.value"
        :editable="ed.editable.value"
        :initial-weekday="todayWeekday"
        :focus-weekday="focusWeekday"
        @edit="openCell"
        @clear="clearCell"
        @day-action="onDayAction"
      />
      <TimetableGrid
        v-else
        :weekdays="ed.gridWeekdays.value"
        :lessons="ed.gridLessons.value"
        :cells="ed.cells.value"
        :issues-map="issuesMap"
        :out-of-range-keys="ed.outOfRangeKeys.value"
        :working-weekdays="ed.settings.value.workingWeekdays"
        :editable="ed.editable.value"
        :can-add-lesson="ed.canAddLesson.value"
        :can-remove-lesson="ed.canRemoveLesson.value"
        @add-lesson="ed.addLesson"
        @remove-lesson="ed.removeLastLesson"
        @edit="openCell"
        @clear="clearCell"
        @day-action="onDayAction"
      />

      <!-- Belgilar -->
      <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span class="inline-flex items-center gap-1">
          <CircleX class="h-3.5 w-3.5 text-danger" aria-hidden="true" />
          {{ t('timetable.issues.legendError') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <TriangleAlert class="h-3.5 w-3.5 text-warning" aria-hidden="true" />
          {{ t('timetable.issues.legendWarning') }}
        </span>
      </p>

      <!-- Versiyalar tarixi -->
      <details class="mt-6" data-testid="history">
        <summary class="cursor-pointer text-sm font-semibold text-fg">
          {{ t('timetable.history') }} ({{ ed.info.value?.versions.length }})
        </summary>
        <div class="mt-2">
          <VersionPanel
            :versions="ed.info.value?.versions ?? []"
            :selected-id="v.id"
            :can-manage="canManage && !ed.archived.value"
            @select="selectVersion"
            @remove="removeVersion"
          />
        </div>
      </details>

      <div v-if="ed.editable.value" class="h-20" aria-hidden="true" />
      <StickySaveBar
        v-if="ed.editable.value && (ed.dirty.value || ed.mode.value === 'correct')"
        :message="saveMessage"
        :danger="false"
        show-discard
        :saving="ed.saving.value"
        :can-save="ed.dirty.value"
        :count="ed.changeCount.value"
        :save-label="t('timetable.saveN', { n: ed.changeCount.value })"
        @discard="ed.discard()"
        @save="save()"
      />
    </template>

    <TimetableIssuesDrawer
      v-if="v"
      :open="issuesOpen"
      :issues="issues"
      :mobile="mobile"
      :can-edit="ed.editable.value"
      @close="issuesOpen = false"
      @jump="onIssueJump"
      @edit="onIssueEdit"
    />

    <!-- Modallar -->
    <CellEditorModal
      v-if="ed.options.value && cellOpen"
      :open="!!cellOpen"
      :weekday="cellOpen.weekday"
      :lesson-no="cellOpen.lessonNo"
      :value="editingCell"
      :options="ed.options.value"
      :issues="issuesMap[cellKey(cellOpen.weekday, cellOpen.lessonNo)]"
      :busy="busy"
      @close="cellOpen = null"
      @save="saveCell"
      @clear="clearCell()"
    />

    <ActivateModal
      v-if="v && ed.mode.value === 'draft'"
      :open="activateOpen"
      :title="t('timetable.activate.title', { name: className })"
      :default-from="ed.validFrom.value"
      :today="ed.today.value"
      :min="ed.info.value?.academicYear.startDate"
      :max="ed.info.value?.academicYear.endDate"
      :busy="activating"
      :load-warnings="ed.previewWarnings"
      :issue-context="issueCtx"
      @close="activateOpen = false"
      @submit="onActivate"
    />

    <BaseModal
      :open="copyDayFrom !== null"
      :title="t('timetable.copyDayTitle')"
      size="sm"
      @close="copyDayFrom = null"
    >
      <BaseSelect
        v-model="copyDayTarget"
        :options="dayTargetOptions"
        :label="t('timetable.copyDayTo')"
        data-testid="copy-day-target"
      />
      <p class="mt-2 text-xs text-fg-muted">{{ t('timetable.copyDayHint') }}</p>
      <template #footer>
        <BaseButton variant="secondary" @click="copyDayFrom = null">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton :disabled="!copyDayTarget" data-testid="copy-day-apply" @click="applyCopyDay">
          {{ t('timetable.copy') }}
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="copyOpen !== null"
      :title="
        copyOpen === 'version' ? t('timetable.copyFromVersion') : t('timetable.copyFromClass')
      "
      size="sm"
      @close="copyOpen = null"
    >
      <BaseSelect
        v-model="copySource"
        :options="copyOptions"
        :label="copyOpen === 'version' ? t('timetable.version') : t('timetable.class')"
        data-testid="copy-source"
      />
      <p class="mt-2 text-xs text-fg-muted">{{ t('timetable.copyReplaceHint') }}</p>
      <template #footer>
        <BaseButton variant="secondary" @click="copyOpen = null">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton :disabled="!copySource" data-testid="copy-apply" @click="applyCopy">
          {{ t('timetable.copy') }}
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="forceOpen"
      :title="t('timetable.forceTitle')"
      size="md"
      persistent
      @close="forceOpen = false"
    >
      <p class="mb-3 text-sm text-fg-muted">{{ t('timetable.forceText') }}</p>
      <textarea
        v-model="forceNote"
        rows="3"
        maxlength="500"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500"
        :placeholder="t('timetable.activate.note')"
        data-testid="correct-force-note"
      />
      <template #footer>
        <BaseButton variant="secondary" @click="forceOpen = false">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton
          variant="danger"
          :disabled="!forceNote.trim()"
          :loading="ed.saving.value"
          data-testid="correct-force-submit"
          @click="save({ force: true, note: forceNote.trim() })"
        >
          {{ t('timetable.forceSubmit') }}
        </BaseButton>
      </template>
    </BaseModal>
  </template>
</template>

<style>
@keyframes tt-pulse {
  0% {
    box-shadow: inset 0 0 0 3px rgb(var(--primary-500));
    background-color: rgb(var(--primary-100));
  }
  100% {
    box-shadow: inset 0 0 0 3px transparent;
  }
}
.tt-pulse {
  animation: tt-pulse 1.8s ease-out 1;
}
@media (prefers-reduced-motion: reduce) {
  .tt-pulse {
    animation: none;
    box-shadow: inset 0 0 0 3px rgb(var(--primary-500));
  }
}
</style>
