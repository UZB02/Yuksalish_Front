<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { attendanceApi } from '@/api/attendance.api'
import { isApiError } from '@/api/errors'
import type { AttendanceRecord, AttendanceSettings, AttendanceStatus } from '@/api/types'
import StatusChips from '@/components/attendance/StatusChips.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import {
  NOTE_MAX,
  hasAttendanceErrors,
  validateAttendanceDraft,
  type AttendanceDraft,
} from '@/utils/attendance'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  open: boolean
  record: AttendanceRecord | null
  statuses: AttendanceStatus[]
  settings: AttendanceSettings
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const draft = ref<AttendanceDraft>({ statusId: null, minutesLate: '', note: '' })
const submitted = ref(false)
const submitting = ref(false)
const serverError = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen || !props.record) return
    const r = props.record
    draft.value = {
      statusId: r.statusId,
      minutesLate: r.minutesLate === null ? '' : String(r.minutesLate),
      note: r.note ?? '',
    }
    submitted.value = false
    serverError.value = ''
  },
  { immediate: true },
)

// Joriy holat nofaol bo'lsa ham chiplar orasida ko'rinadi
const choices = computed(() => {
  const cur = props.record?.status
  const list = props.statuses.filter((s) => s.isActive || s.id === cur?.id)
  return list
})
const status = computed(() => props.statuses.find((s) => s.id === draft.value.statusId))
const isLate = computed(() => status.value?.category === 'late')
const errors = computed(() => validateAttendanceDraft(draft.value, status.value, props.settings))
const err = (k?: string) =>
  k && submitted.value ? t(`attendance.errors.${k}`, { max: NOTE_MAX, limit: 600 }) : ''

function pick(id: string) {
  const cat = props.statuses.find((s) => s.id === id)?.category
  draft.value = {
    ...draft.value,
    statusId: id,
    minutesLate: cat === 'late' ? draft.value.minutesLate : '',
  }
}

async function save() {
  submitted.value = true
  if (!props.record || hasAttendanceErrors(errors.value)) return
  submitting.value = true
  serverError.value = ''
  try {
    const minutes = draft.value.minutesLate.trim()
    await attendanceApi.update(props.record.id, {
      statusId: draft.value.statusId!,
      minutesLate: isLate.value && minutes !== '' ? Number(minutes) : null,
      note: draft.value.note.trim() === '' ? null : draft.value.note.trim(),
    })
    toast.success(t('attendance.updated'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (isApiError(e) && e.details.length)
      serverError.value = e.details.map((d) => d.message).join('; ')
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('attendance.edit')"
    :description="
      record
        ? `${record.student.fullName} - ${formatDate(record.date)}${record.lessonNo ? `, ${t('attendance.lessonN', { n: record.lessonNo })}` : ''}`
        : undefined
    "
    persistent
    @close="emit('close')"
  >
    <div class="space-y-4">
      <div>
        <p class="mb-1.5 text-sm font-medium text-fg">{{ t('attendance.status') }}</p>
        <StatusChips
          :statuses="choices"
          :model-value="draft.statusId"
          :invalid="submitted && !draft.statusId"
          @pick="pick"
        />
        <p v-if="err(errors.status)" class="mt-1 text-xs text-danger" role="alert">
          {{ err(errors.status) }}
        </p>
      </div>
      <BaseInput
        v-if="isLate"
        v-model="draft.minutesLate"
        type="number"
        inputmode="numeric"
        min="1"
        max="600"
        :label="t('attendance.minutesLate')"
        :error="err(errors.minutes)"
      />
      <div>
        <label for="att-edit-note" class="mb-1.5 block text-sm font-medium text-fg">
          {{ t('attendance.note') }}
        </label>
        <textarea
          id="att-edit-note"
          v-model="draft.note"
          rows="3"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500"
        />
        <p v-if="err(errors.note)" class="mt-1 text-xs text-danger" role="alert">
          {{ err(errors.note) }}
        </p>
      </div>
      <p v-if="serverError" class="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
        {{ serverError }}
      </p>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
