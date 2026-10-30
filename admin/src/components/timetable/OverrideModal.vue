<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  timetableApi,
  type ClassOverviewRow,
  type CreateOverridePayload,
  type TimetableOptions,
} from '@/api/timetable.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage, isConflictOrValidation } from '@/utils/errors'
import { TIMETABLE_MAX_LESSONS } from '@/utils/timetable'
import FreeTeacherPicker from './FreeTeacherPicker.vue'

export type OverrideMode = 'substitute' | 'replace' | 'cancel' | 'move' | 'extra'
export interface OverrideLesson {
  classId: string
  className: string
  lessonNo: number
  subjectId: string
  subjectName: string
}

/** Almashtirish oynasi: o'rinbosar / fan almashtirish / bekor / ko'chirish / qo'shimcha dars */
const props = defineProps<{
  open: boolean
  mode: OverrideMode
  date: string
  lesson: OverrideLesson | null
}>()
const emit = defineEmits<{ close: []; done: [] }>()

const { t } = useI18n()
const toast = useToast()

const lessonNos = Array.from({ length: TIMETABLE_MAX_LESSONS }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

const classId = ref('')
const lessonNo = ref('')
const subjectId = ref('')
const teacherId = ref('')
const targetDate = ref('')
const reason = ref('')
const submitting = ref(false)
const error = ref('')
const classes = ref<ClassOverviewRow[]>([])
const options = ref<TimetableOptions | null>(null)

const isExtra = computed(() => props.mode === 'extra')
const needsSubject = computed(() => props.mode === 'replace' || isExtra.value)
const needsTeacher = computed(() => ['substitute', 'replace', 'extra'].includes(props.mode))
const showPicker = computed(() => needsTeacher.value || props.mode === 'move')

/** Tanlovchi so'raydigan dars (sana + raqam) va fan */
const pickDate = computed(() => (props.mode === 'move' ? targetDate.value : props.date))
const pickLesson = computed(() => {
  const own = props.mode === 'substitute' || props.mode === 'replace'
  return (own ? props.lesson?.lessonNo : Number(lessonNo.value)) || null
})
const pickSubject = computed(
  () => (needsSubject.value ? subjectId.value : props.lesson?.subjectId) || undefined,
)

const TITLES = {
  substitute: 'substitutions.modal.titleSubstitute',
  replace: 'substitutions.modal.titleReplace',
  cancel: 'substitutions.modal.titleCancel',
  move: 'substitutions.modal.titleMove',
  extra: 'substitutions.modal.titleExtra',
} as const
const SUBMITS: Partial<Record<OverrideMode, string>> = {
  cancel: 'substitutions.modal.submitCancel',
  move: 'substitutions.modal.submitMove',
  extra: 'substitutions.modal.submitExtra',
}
const title = computed(() => t(TITLES[props.mode]))
const submitText = computed(() => t(SUBMITS[props.mode] ?? 'substitutions.modal.submit'))
const lessonLabel = computed(() =>
  props.lesson
    ? `${props.lesson.className} · ${t('substitutions.lessonNo', { n: props.lesson.lessonNo })} · ${props.lesson.subjectName}`
    : '',
)

const classOptions = computed(() => classes.value.map((c) => ({ value: c.classId, label: c.name })))
const subjectOptions = computed(() =>
  (options.value?.subjects ?? []).map((s) => ({ value: s.id, label: s.name })),
)

const canSubmit = computed(() => {
  switch (props.mode) {
    case 'substitute':
      return !!teacherId.value
    case 'replace':
      return !!subjectId.value && !!teacherId.value
    case 'cancel':
      return true
    case 'move':
      return !!targetDate.value && !!lessonNo.value
    default:
      return !!classId.value && !!lessonNo.value && !!subjectId.value && !!teacherId.value
  }
})

async function loadOptions(id: string) {
  options.value = null
  if (!id) return
  try {
    options.value = await timetableApi.options(id)
  } catch (e) {
    error.value = errorMessage(e, t)
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    classId.value = props.lesson?.classId ?? ''
    lessonNo.value = ''
    subjectId.value = ''
    teacherId.value = ''
    targetDate.value = props.mode === 'move' ? props.date : ''
    reason.value = ''
    error.value = ''
    submitting.value = false
    options.value = null
    if (isExtra.value) {
      classId.value = ''
      try {
        classes.value = (await timetableApi.overview()).classes
      } catch (e) {
        error.value = errorMessage(e, t)
      }
    } else if (props.mode === 'replace') {
      await loadOptions(classId.value)
    }
  },
  { immediate: true },
)
watch(classId, (id, old) => {
  if (!isExtra.value || id === old) return
  subjectId.value = ''
  teacherId.value = ''
  void loadOptions(id)
})
watch(subjectId, () => (teacherId.value = ''))

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  error.value = ''
  const why = reason.value.trim() || undefined
  try {
    if (props.mode === 'move') {
      await timetableApi.moveLesson({
        classId: props.lesson!.classId,
        from: { date: props.date, lessonNo: props.lesson!.lessonNo },
        to: { date: targetDate.value, lessonNo: Number(lessonNo.value) },
        teacherId: teacherId.value || undefined,
        reason: why,
      })
    } else {
      const body: CreateOverridePayload = {
        classId: isExtra.value ? classId.value : props.lesson!.classId,
        date: props.date,
        lessonNo: isExtra.value ? Number(lessonNo.value) : props.lesson!.lessonNo,
        type: props.mode,
      }
      if (needsSubject.value) body.subjectId = subjectId.value
      if (needsTeacher.value) body.teacherId = teacherId.value
      if (why) body.reason = why
      await timetableApi.createOverride(body)
    }
    toast.success(t(`substitutions.toast.${props.mode}`))
    emit('done')
  } catch (e) {
    // 409/422: serverning aniq xabari (masalan, "O'qituvchi band") ko'rsatiladi
    error.value = isConflictOrValidation(e) ? e.message : errorMessage(e, t)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="title"
    :description="lessonLabel || undefined"
    size="lg"
    persistent
    @close="emit('close')"
  >
    <form id="override-form" class="space-y-4" @submit.prevent="submit">
      <p v-if="mode === 'cancel'" class="text-sm text-fg-muted">
        {{ t('substitutions.modal.cancelText', { lesson: lessonLabel }) }}
      </p>

      <div v-if="isExtra" class="grid gap-3 sm:grid-cols-2">
        <BaseSelect
          v-model="classId"
          :label="t('substitutions.modal.class')"
          :placeholder="t('substitutions.modal.classPlaceholder')"
          :options="classOptions"
          data-testid="extra-class"
        />
        <BaseSelect
          v-model="lessonNo"
          :label="t('substitutions.modal.lessonNo')"
          :options="lessonNos"
          :searchable="false"
          data-testid="extra-lesson"
        />
      </div>

      <div v-if="mode === 'move'" class="grid gap-3 sm:grid-cols-2">
        <BaseInput
          v-model="targetDate"
          type="date"
          :label="t('substitutions.modal.targetDate')"
          data-testid="move-date"
        />
        <BaseSelect
          v-model="lessonNo"
          :label="t('substitutions.modal.targetLesson')"
          :options="lessonNos"
          :searchable="false"
          data-testid="move-lesson"
        />
      </div>

      <BaseSelect
        v-if="needsSubject"
        v-model="subjectId"
        :label="t('substitutions.modal.subject')"
        :placeholder="t('substitutions.modal.subjectPlaceholder')"
        :options="subjectOptions"
        :disabled="subjectOptions.length === 0"
        data-testid="subject-select"
      />

      <div v-if="showPicker">
        <p class="mb-1.5 text-sm font-medium text-fg">
          {{
            t(
              mode === 'move'
                ? 'substitutions.modal.teacherOptional'
                : 'substitutions.modal.teacher',
            )
          }}
        </p>
        <button
          v-if="mode === 'move' && teacherId"
          type="button"
          class="mb-2 text-xs text-primary-700 hover:underline"
          @click="teacherId = ''"
        >
          {{ t('substitutions.modal.keepTeacher') }}
        </button>
        <FreeTeacherPicker
          v-model="teacherId"
          :date="pickDate"
          :lesson-no="pickLesson"
          :subject-id="pickSubject"
        />
      </div>

      <BaseInput
        v-model="reason"
        :label="t('substitutions.modal.reason')"
        :placeholder="t('substitutions.modal.reasonPlaceholder')"
        maxlength="200"
        data-testid="reason"
      />

      <p
        v-if="error"
        class="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
        role="alert"
        data-testid="override-error"
      >
        {{ error }}
      </p>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">
        {{ t('common.cancel') }}
      </BaseButton>
      <BaseButton
        :variant="mode === 'cancel' ? 'danger' : 'primary'"
        :loading="submitting"
        :disabled="!canSubmit"
        data-testid="override-submit"
        @click="submit"
      >
        {{ submitText }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
