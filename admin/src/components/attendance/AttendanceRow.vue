<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Lock, MessageSquare, Pencil } from 'lucide-vue-next'
import type { AttendanceSettings, AttendanceStatus } from '@/api/types'
import type { AttendanceRow, AttendanceRowState } from '@/composables/useAttendanceSheet'
import { NOTE_MAX, type AttendanceDraft, type AttendanceErrors } from '@/utils/attendance'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import StatusChips from './StatusChips.vue'

const props = defineProps<{
  row: AttendanceRow
  index: number
  state: AttendanceRowState
  errors: AttendanceErrors
  statuses: AttendanceStatus[]
  settings: AttendanceSettings
  /** Xatolarni faqat qator o'zgargan bo'lsa ko'rsatamiz */
  showErrors: boolean
}>()
const emit = defineEmits<{
  pick: [studentId: string, statusId: string]
  patch: [studentId: string, change: Partial<AttendanceDraft>]
}>()
const { t } = useI18n()

const status = computed(() => props.statuses.find((s) => s.id === props.row.draft.statusId))
const isLate = computed(() => status.value?.category === 'late')
const noteRequired = computed(
  () => !!status.value && props.settings.noteRequiredCategories.includes(status.value.category),
)
const locked = computed(() => props.state === 'locked')
const noteOpen = ref(false)
const showNote = computed(() => noteOpen.value || props.row.draft.note !== '' || noteRequired.value)

const err = (key?: string) =>
  key && props.showErrors
    ? t(`attendance.errors.${key}`, { max: NOTE_MAX, min: 1, limit: 600 })
    : ''

const border = computed(
  () =>
    ({
      empty: 'border-border',
      saved: 'border-success/50',
      dirty: 'border-primary-500',
      error: 'border-danger',
      locked: 'border-border opacity-80',
    })[props.state],
)
</script>

<template>
  <li class="card p-3 sm:p-4" :class="border" :data-state="state" data-testid="attendance-row">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2.5">
        <AvatarImage :name="row.fullName" :src="row.photo" size="sm" alt="" />
        <div class="min-w-0">
          <p class="truncate font-medium text-fg">{{ row.fullName }}</p>
          <p v-if="row.studentCode" class="text-xs text-fg-muted">{{ row.studentCode }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span v-if="state === 'locked'" class="inline-flex items-center gap-1 text-fg-muted">
          <Lock class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('attendance.state.locked') }}
        </span>
        <span v-else-if="state === 'saved'" class="inline-flex items-center gap-1 text-success">
          <CheckCircle2 class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('attendance.state.saved') }}
        </span>
        <span v-else-if="state === 'dirty'" class="inline-flex items-center gap-1 text-primary-700">
          <Pencil class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('attendance.state.dirty') }}
        </span>
        <span v-else-if="state === 'error'" class="inline-flex items-center gap-1 text-danger">
          <AlertCircle class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('attendance.state.error') }}
        </span>
      </div>
    </div>

    <p v-if="locked" class="mt-1 text-xs text-fg-muted" data-testid="locked-reason">
      {{
        t('attendance.lockedReason', {
          name: row.record?.markedBy.fullName ?? '',
          hours: settings.editWindowHours,
        })
      }}
    </p>
    <p v-if="row.serverError" class="mt-1 text-xs text-danger" role="alert">
      {{ row.serverError }}
    </p>

    <div class="mt-3 flex flex-wrap items-start gap-2">
      <StatusChips
        class="min-w-0 flex-1"
        :statuses="statuses"
        :model-value="row.draft.statusId"
        :disabled="locked"
        :invalid="!!errors.status && showErrors"
        :label="`${t('attendance.status')}: ${row.fullName}`"
        @pick="emit('pick', row.studentId, $event)"
      />
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-fg-muted hover:bg-surface-muted disabled:opacity-50"
        :class="row.draft.note ? '!border-primary-500 !text-primary-700' : ''"
        :disabled="locked"
        :aria-label="`${t('attendance.note')}: ${row.fullName}`"
        :aria-expanded="showNote"
        data-testid="note-toggle"
        @click="noteOpen = !noteOpen"
      >
        <MessageSquare class="h-5 w-5" />
      </button>
    </div>
    <p v-if="err(errors.status)" class="mt-1 text-xs text-danger" role="alert">
      {{ err(errors.status) }}
    </p>

    <div v-if="isLate" class="mt-2 flex items-center gap-2">
      <label class="text-sm text-fg-muted" :for="`late-${row.studentId}`">
        {{ t('attendance.minutesLate') }}
      </label>
      <input
        :id="`late-${row.studentId}`"
        type="number"
        inputmode="numeric"
        min="1"
        max="600"
        :value="row.draft.minutesLate"
        :disabled="locked"
        :aria-invalid="!!errors.minutes && showErrors"
        placeholder="-"
        class="h-10 w-24 rounded-lg border bg-surface px-2 text-center text-fg focus:border-primary-500"
        :class="errors.minutes && showErrors ? 'border-danger' : 'border-border'"
        data-testid="minutes-input"
        @input="
          emit('patch', row.studentId, { minutesLate: ($event.target as HTMLInputElement).value })
        "
      />
      <span class="text-sm text-fg-muted">{{ t('attendance.minutesUnit') }}</span>
    </div>
    <p v-if="err(errors.minutes)" class="mt-1 text-xs text-danger" role="alert">
      {{ err(errors.minutes) }}
    </p>

    <div v-if="showNote" class="mt-2">
      <textarea
        rows="2"
        :value="row.draft.note"
        :disabled="locked"
        :maxlength="NOTE_MAX + 50"
        :aria-label="`${t('attendance.note')}: ${row.fullName}`"
        :aria-required="noteRequired"
        :placeholder="
          noteRequired ? t('attendance.noteRequiredPlaceholder') : t('attendance.notePlaceholder')
        "
        class="w-full resize-none rounded-lg border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted/70 focus:border-primary-500 disabled:opacity-60"
        :class="errors.note && showErrors ? 'border-danger' : 'border-border'"
        data-testid="note-input"
        @input="
          emit('patch', row.studentId, { note: ($event.target as HTMLTextAreaElement).value })
        "
      />
      <p v-if="err(errors.note)" class="mt-1 text-xs text-danger" role="alert">
        {{ err(errors.note) }}
      </p>
    </div>
  </li>
</template>
