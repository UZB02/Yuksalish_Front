<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  Search,
  UserCheck,
  Users,
} from 'lucide-vue-next'
import AttendanceRow from '@/components/attendance/AttendanceRow.vue'
import AttendanceStats from '@/components/attendance/AttendanceStats.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StickySaveBar from '@/components/ui/StickySaveBar.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useAttendanceSheet, type LessonChip } from '@/composables/useAttendanceSheet'
import { useDirtySource } from '@/composables/useDirtyRegistry'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { dateBounds, shiftDate, todayTashkent } from '@/utils/scoring'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()

const classId = computed(() => String(route.params.id))
const sheet = useAttendanceSheet(() => classId.value)
const search = ref('')
const onlyUnmarked = ref(false)
const today = ref(todayTashkent())

const bounds = computed(() => dateBounds(today.value, sheet.settings.value.backdateDays))
const canPrev = computed(() => sheet.date.value > bounds.value.min)
const canNext = computed(() => sheet.date.value < bounds.value.max)

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sheet.rows.value.filter((r) => {
    if (onlyUnmarked.value && r.draft.statusId !== null) return false
    return (
      q === '' ||
      r.fullName.toLowerCase().includes(q) ||
      (r.studentCode ?? '').toLowerCase().includes(q)
    )
  })
})

/** Saqlanmagan o'zgarish bor bo'lsa, sana/dars almashtirishdan oldin tasdiq so'raydi. */
async function confirmDiscard(text: string): Promise<boolean> {
  if (!sheet.hasUnsaved.value) return true
  return confirm({
    title: t('attendance.unsaved.title'),
    message: text,
    confirmText: t('attendance.unsaved.discard'),
    variant: 'danger',
  })
}

async function changeDate(next: string) {
  if (next === sheet.date.value || next < bounds.value.min || next > bounds.value.max) return
  if (!(await confirmDiscard(t('attendance.unsaved.dateText')))) return
  await sheet.goTo({ date: next })
}

async function changeLesson(n: number) {
  if (n === sheet.lessonNo.value) return
  if (!(await confirmDiscard(t('attendance.unsaved.lessonText')))) return
  await sheet.goTo({ lessonNo: n })
}

/** "1 · Matematika · Aliyev" / "3 · (bo'sh)"; jadvalsiz sinfda faqat raqam */
function chipLabel(chip: LessonChip): string {
  if (chip.lesson) {
    const surname = chip.lesson.teacher?.fullName.split(' ')[0] ?? ''
    return [chip.n, chip.lesson.subject?.name, surname].filter(Boolean).join(' · ')
  }
  return chip.empty ? t('attendance.emptyLesson', { n: chip.n }) : String(chip.n)
}

const subjectOptions = computed(() =>
  sheet.subjects.value.map((s) => ({ value: s.id, label: s.name })),
)

async function changeSubject(id: string) {
  if (id === sheet.subjectId.value) return
  if (!(await confirmDiscard(t('attendance.unsaved.subjectText')))) return
  if (sheet.hasUnsaved.value) sheet.discard()
  sheet.setSubject(id)
}

const onDateInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  if (v) void changeDate(v)
}

async function save() {
  try {
    const res = await sheet.save()
    if (!res) return
    const failed = res.failed.length
    if (failed > 0)
      toast.error(t('attendance.savedPartial', { ok: res.created + res.updated, failed }))
    else toast.success(t('attendance.saved', { n: res.created + res.updated }))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

useDirtySource(() => sheet.hasUnsaved.value)
onBeforeRouteLeave(async () => {
  if (!sheet.hasUnsaved.value) return true
  return confirm({
    title: t('attendance.unsaved.title'),
    message: t('attendance.unsaved.leaveText'),
    confirmText: t('attendance.unsaved.leave'),
    variant: 'danger',
  })
})
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (sheet.hasUnsaved.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
/** URL dagi `?date=YYYY-MM-DD` (berilsa shu sana ochiladi). */
const initialDate = () => (typeof route.query.date === 'string' ? route.query.date : null)
/** URL dagi `?lessonNo=N` ("Bugungi darslarim" dan o'tganda shu dars ochiladi). */
const initialLessonNo = () => {
  const n = typeof route.query.lessonNo === 'string' ? Number(route.query.lessonNo) : NaN
  return Number.isInteger(n) && n >= 1 ? n : null
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void sheet.init(initialDate(), initialLessonNo())
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
watch(classId, () => void sheet.init(initialDate(), initialLessonNo()))
</script>

<template>
  <RouterLink
    :to="{ name: 'class-detail', params: { id: classId } }"
    class="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
  >
    <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('scoring.backToClass') }}
  </RouterLink>

  <header class="mb-4 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-fg sm:text-2xl">
        {{ t('attendance.title')
        }}<span v-if="sheet.className.value">: {{ sheet.className.value }}</span>
      </h1>
      <div class="flex items-center gap-1">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="!canPrev"
          :aria-label="t('scoring.prevDay')"
          @click="changeDate(shiftDate(sheet.date.value, -1))"
        >
          <ChevronLeft class="h-4 w-4" />
        </BaseButton>
        <input
          type="date"
          :value="sheet.date.value"
          :min="bounds.min"
          :max="bounds.max"
          :aria-label="t('scoring.date')"
          class="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-primary-500"
          @change="onDateInput"
        />
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="!canNext"
          :aria-label="t('scoring.nextDay')"
          @click="changeDate(shiftDate(sheet.date.value, 1))"
        >
          <ChevronRight class="h-4 w-4" />
        </BaseButton>
      </div>
    </div>

    <div
      v-if="sheet.mode.value === 'lesson'"
      role="group"
      :aria-label="t('attendance.lesson')"
      class="flex flex-wrap gap-2"
      data-testid="lesson-chips"
    >
      <button
        v-for="chip in sheet.chips.value"
        :key="chip.n"
        type="button"
        class="relative inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border-2 px-3 text-sm font-semibold transition-colors"
        :class="[
          sheet.lessonNo.value === chip.n
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-border bg-surface text-fg hover:bg-surface-muted',
          chip.lesson?.cancelled ? 'line-through opacity-70' : '',
          chip.empty && sheet.lessonNo.value !== chip.n ? 'text-fg-muted' : '',
        ]"
        :aria-pressed="sheet.lessonNo.value === chip.n"
        :aria-label="t('attendance.lessonN', { n: chip.n })"
        data-testid="lesson-chip"
        @click="changeLesson(chip.n)"
      >
        {{ chipLabel(chip) }}
        <span
          v-if="chip.lesson?.mine && sheet.lessonNo.value !== chip.n"
          class="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary-500"
          :title="t('attendance.myLesson')"
          data-testid="mine-dot"
        />
        <span
          v-if="(sheet.lessonMarked.value[chip.n] ?? 0) > 0"
          class="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-surface"
          :class="
            (sheet.lessonMarked.value[chip.n] ?? 0) >= sheet.total.value
              ? 'bg-success'
              : 'bg-warning'
          "
          :title="
            t('attendance.lessonProgress', {
              done: sheet.lessonMarked.value[chip.n] ?? 0,
              total: sheet.total.value,
            })
          "
          data-testid="lesson-dot"
        />
      </button>
    </div>

    <!-- Jadvaldan aniqlangan dars: fan faqat o'qish uchun chip; admin/sinf rahbari o'zgartira oladi -->
    <div
      v-if="sheet.mode.value === 'lesson' && sheet.scheduledLesson.value && !sheet.overriding.value"
      class="flex flex-wrap items-center gap-2"
      data-testid="subject-chip-row"
    >
      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700"
        data-testid="subject-chip"
      >
        <BookOpen class="h-4 w-4" aria-hidden="true" />
        {{ sheet.subjectLabel.value }}
        <span v-if="sheet.scheduledLesson.value.teacher" class="font-normal text-fg-muted">
          · {{ sheet.scheduledLesson.value.teacher.fullName }}
        </span>
      </span>
      <button
        v-if="sheet.canOverrideSubject.value"
        type="button"
        class="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        data-testid="subject-override"
        @click="sheet.startOverride()"
      >
        {{ t('attendance.changeSubject') }}
      </button>
    </div>

    <div v-else-if="sheet.mode.value === 'lesson'" class="max-w-sm" data-testid="subject-field">
      <BaseSelect
        :model-value="sheet.subjectId.value"
        :options="subjectOptions"
        :label="t('attendance.subject')"
        :placeholder="t('attendance.subjectPlaceholder')"
        :disabled="sheet.loading.value || subjectOptions.length === 0"
        required
        :error="
          !sheet.loading.value && subjectOptions.length === 0
            ? t('attendance.noSubjects')
            : undefined
        "
        @update:model-value="changeSubject"
      />
      <button
        v-if="sheet.scheduledLesson.value && sheet.overriding.value"
        type="button"
        class="mt-1 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        data-testid="subject-revert"
        @click="sheet.stopOverride()"
      >
        {{
          t('attendance.backToScheduled', { name: sheet.scheduledLesson.value.subject?.name ?? '' })
        }}
      </button>
    </div>

    <div
      v-if="sheet.mode.value === 'lesson' && !sheet.canTake.value && !sheet.loading.value"
      class="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger"
      role="alert"
      data-testid="cannot-take"
    >
      <Lock class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {{ sheet.cannotTakeReason.value || t('attendance.cannotTake') }}
    </div>

    <div
      v-if="!sheet.isWorkingDay.value && !sheet.loading.value"
      class="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"
      role="alert"
      data-testid="not-working-day"
    >
      <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {{ t('attendance.notWorkingDay') }}
    </div>

    <AttendanceStats v-if="sheet.rows.value.length" :counts="sheet.live.value" />

    <div v-if="sheet.rows.value.length" class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          v-model="search"
          type="search"
          :aria-label="t('common.search')"
          :placeholder="t('students.searchPlaceholder')"
          class="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg focus:border-primary-500"
        />
      </div>
      <BaseCheckbox v-model="onlyUnmarked" :label="t('attendance.onlyUnmarked')" />
    </div>

    <div v-if="sheet.rows.value.length" class="flex flex-wrap gap-2">
      <BaseButton
        variant="secondary"
        :disabled="!sheet.defaultStatus.value"
        @click="sheet.markAllDefault()"
      >
        <CheckCheck class="h-4 w-4" />
        {{ t('attendance.markAll', { name: sheet.defaultStatus.value?.name ?? '' }) }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        :disabled="!sheet.defaultStatus.value"
        @click="sheet.markRemainingDefault()"
      >
        <UserCheck class="h-4 w-4" />
        {{ t('attendance.markRemaining', { name: sheet.defaultStatus.value?.name ?? '' }) }}
      </BaseButton>
    </div>
  </header>

  <div v-if="sheet.loading.value && sheet.rows.value.length === 0" class="space-y-3">
    <Skeleton v-for="n in 4" :key="n" class="h-32 w-full" />
  </div>

  <div v-else-if="sheet.loadError.value" class="card">
    <EmptyState
      :title="t('errors.loadFailed')"
      :description="errorMessage(sheet.loadError.value, t)"
    >
      <BaseButton variant="secondary" @click="sheet.load()">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="sheet.rows.value.length === 0" class="card">
    <EmptyState
      :icon="Users"
      :title="t('scoring.emptyTitle')"
      :description="t('scoring.emptyText')"
    />
  </div>

  <template v-else>
    <p v-if="visible.length === 0" class="py-8 text-center text-sm text-fg-muted">
      {{ t('scoring.noMatches') }}
    </p>
    <ul class="space-y-3 pb-28">
      <AttendanceRow
        v-for="(row, i) in visible"
        :key="row.studentId"
        :row="row"
        :index="i"
        :state="sheet.stateOf(row)"
        :errors="sheet.errorsOf(row)"
        :statuses="sheet.statuses.value"
        :settings="sheet.settings.value"
        :show-errors="sheet.isDirty(row) || !!row.serverError"
        @pick="sheet.pick"
        @patch="sheet.patch"
      />
    </ul>

    <StickySaveBar
      :message="
        !sheet.isWorkingDay.value
          ? t('attendance.saveBlocked')
          : !sheet.canTake.value
            ? t('attendance.saveNotAllowed')
            : sheet.subjectMissing.value && sheet.hasUnsaved.value
              ? t('attendance.subjectRequired')
              : sheet.invalidDirty.value.length
                ? t('scoring.invalidRows', { n: sheet.invalidDirty.value.length })
                : sheet.hasUnsaved.value
                  ? t('scoring.unsavedHint')
                  : ''
      "
      :danger="sheet.invalidDirty.value.length > 0"
      :show-discard="sheet.hasUnsaved.value"
      :saving="sheet.saving.value"
      :can-save="sheet.canSave.value"
      :count="sheet.changedCount.value"
      :save-label="t('attendance.save', { n: sheet.changedCount.value })"
      @discard="sheet.discard()"
      @save="save"
    />
  </template>
</template>
