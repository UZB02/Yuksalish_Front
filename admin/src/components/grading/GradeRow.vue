<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Lock, MessageSquare, Pencil } from 'lucide-vue-next'
import type { GradeRowStatus, GradeSheetRow } from '@/composables/useGradeSheet'
import { GRADE_COMMENT_MAX, type GradeDraft, type GradeDraftErrors } from '@/utils/grades'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import GradeButtons from './GradeButtons.vue'

const props = defineProps<{
  row: GradeSheetRow
  status: GradeRowStatus
  errors: GradeDraftErrors
  /** Xatolarni faqat qator o'zgargan bo'lsa ko'rsatamiz */
  showErrors: boolean
}>()
const emit = defineEmits<{ patch: [studentId: string, change: Partial<GradeDraft>] }>()
const { t } = useI18n()

const locked = computed(() => props.status === 'locked')
// Izoh maydoni ixtiyoriy: izoh bor bo'lsa ochiq, aks holda tugma orqali ochiladi.
const commentOpen = ref(props.row.draft.comment !== '')
const showComment = computed(() => commentOpen.value || props.row.draft.comment !== '')

const border = computed(
  () =>
    ({
      empty: 'border-border',
      saved: 'border-success/50',
      dirty: 'border-primary-500',
      error: 'border-danger',
      locked: 'border-border opacity-80',
    })[props.status],
)
const errText = (key?: string) =>
  key && props.showErrors ? t(`grading.errors.${key}`, { limit: GRADE_COMMENT_MAX }) : ''
</script>

<template>
  <li class="card p-3 sm:p-4" :class="border" :data-status="status">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2.5">
        <AvatarImage :name="row.fullName" :src="row.photo" size="sm" alt="" />
        <div class="min-w-0">
          <p class="truncate font-medium text-fg">{{ row.fullName }}</p>
          <p v-if="row.studentCode" class="text-xs text-fg-muted">{{ row.studentCode }}</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span
          v-if="row.gradeId && status !== 'dirty'"
          class="rounded-full bg-success-soft px-2 py-0.5 text-success"
          data-testid="already-graded"
          :title="row.gradedBy ?? undefined"
        >
          {{ t('grading.alreadyGraded') }}
        </span>
        <span v-if="status === 'locked'" class="inline-flex items-center gap-1 text-fg-muted">
          <Lock class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('grading.status.locked') }}
        </span>
        <span v-else-if="status === 'saved'" class="inline-flex items-center gap-1 text-success">
          <CheckCircle2 class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('grading.status.saved') }}
        </span>
        <span
          v-else-if="status === 'dirty'"
          class="inline-flex items-center gap-1 text-primary-700"
        >
          <Pencil class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('grading.status.dirty') }}
        </span>
        <span v-else-if="status === 'error'" class="inline-flex items-center gap-1 text-danger">
          <AlertCircle class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('grading.status.error') }}
        </span>
      </div>
    </div>

    <GradeButtons
      class="mt-3"
      :model-value="row.draft.value"
      :disabled="locked"
      :invalid="!!errText(errors.value)"
      :name="row.fullName"
      @update:model-value="emit('patch', row.studentId, { value: $event })"
    />
    <p v-if="errText(errors.value)" class="mt-1 text-xs text-danger" role="alert">
      {{ errText(errors.value) }}
    </p>

    <div class="mt-2">
      <button
        v-if="!showComment && !locked"
        type="button"
        class="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
        @click="commentOpen = true"
      >
        <MessageSquare class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('grading.addComment') }}
      </button>
      <template v-else-if="showComment">
        <label :for="`gc-${row.studentId}`" class="sr-only">{{ t('scoring.comment') }}</label>
        <textarea
          :id="`gc-${row.studentId}`"
          :value="row.draft.comment"
          rows="2"
          :disabled="locked"
          :placeholder="t('grading.commentPlaceholder')"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500 disabled:opacity-70"
          @input="
            emit('patch', row.studentId, { comment: ($event.target as HTMLTextAreaElement).value })
          "
        />
        <p v-if="errText(errors.comment)" class="mt-1 text-xs text-danger" role="alert">
          {{ errText(errors.comment) }}
        </p>
      </template>
    </div>
    <p v-if="row.serverError" class="mt-2 text-xs text-danger" role="alert">
      {{ row.serverError }}
    </p>
  </li>
</template>
