<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { scoresApi } from '@/api/scores.api'
import type { BehaviorType, Score, ScoringSettings } from '@/api/types'
import BehaviorChips from '@/components/scoring/BehaviorChips.vue'
import ScoreSlider from '@/components/scoring/ScoreSlider.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import {
  COMMENT_MAX,
  hasErrors,
  isCommentRequired,
  quickScores,
  validateDraft,
  type RowDraft,
} from '@/utils/scoring'

const props = defineProps<{
  open: boolean
  score: Score | null
  types: BehaviorType[]
  settings: ScoringSettings
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const draft = ref<RowDraft>({ value: '', behaviorTypeId: null, comment: '' })
const submitted = ref(false)
const submitting = ref(false)
const serverErrors = ref<Record<string, string>>({})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen || !props.score) return
    draft.value = {
      value: String(props.score.value),
      behaviorTypeId: props.score.behaviorTypeId,
      comment: props.score.comment ?? '',
    }
    submitted.value = false
    serverErrors.value = {}
  },
  { immediate: true },
)

const errors = computed(() => validateDraft(draft.value, props.settings))
const quick = computed(() => quickScores(props.settings))
const msg = (key?: string) =>
  key && submitted.value
    ? t(`scoring.errors.${key}`, {
        min: props.settings.minScore,
        max: props.settings.maxScore,
        below: props.settings.commentRequiredBelow ?? 0,
        limit: COMMENT_MAX,
      })
    : ''

async function save() {
  submitted.value = true
  if (!props.score || hasErrors(errors.value)) return
  submitting.value = true
  try {
    await scoresApi.update(props.score.id, {
      value: Number(draft.value.value),
      behaviorTypeId: draft.value.behaviorTypeId,
      comment: draft.value.comment.trim() === '' ? null : draft.value.comment.trim(),
    })
    toast.success(t('scores.updated'))
    emit('saved')
    emit('close')
  } catch (e) {
    // Server qoidasi buzilishi (details path: value, behaviorTypeId, comment) maydonga bog'lanadi.
    const mapped: Record<string, string> = {}
    if (isApiError(e))
      for (const d of e.details) mapped[d.path.split('.').pop() ?? d.path] = d.message
    if (Object.keys(mapped).length) serverErrors.value = mapped
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('scores.edit')"
    :description="score ? `${score.student.fullName} - ${formatDate(score.date)}` : undefined"
    persistent
    @close="emit('close')"
  >
    <div class="space-y-4">
      <div>
        <p class="mb-1.5 text-sm font-medium text-fg">{{ t('scoring.score') }}</p>
        <ScoreSlider
          v-model="draft.value"
          :min="settings.minScore"
          :max="settings.maxScore"
          :quick="quick"
          :invalid="!!msg(errors.value)"
        />
        <p v-if="msg(errors.value)" class="mt-1 text-xs text-danger" role="alert">
          {{ msg(errors.value) }}
        </p>
        <p v-if="serverErrors.value" class="mt-1 text-xs text-danger" role="alert">
          {{ serverErrors.value }}
        </p>
      </div>
      <div>
        <p class="mb-1.5 text-sm font-medium text-fg">{{ t('scoring.behaviorType') }}</p>
        <BehaviorChips
          v-model="draft.behaviorTypeId"
          :types="types"
          :invalid="!!msg(errors.behavior)"
        />
        <p v-if="msg(errors.behavior)" class="mt-1 text-xs text-danger" role="alert">
          {{ msg(errors.behavior) }}
        </p>
        <p v-if="serverErrors.behaviorTypeId" class="mt-1 text-xs text-danger" role="alert">
          {{ serverErrors.behaviorTypeId }}
        </p>
      </div>
      <div>
        <label for="score-comment" class="mb-1.5 block text-sm font-medium text-fg">
          {{ t('scoring.comment') }}
          <span v-if="isCommentRequired(draft, settings)" class="text-danger">*</span>
        </label>
        <textarea
          id="score-comment"
          v-model="draft.comment"
          rows="3"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500"
        />
        <p v-if="msg(errors.comment)" class="mt-1 text-xs text-danger" role="alert">
          {{ msg(errors.comment) }}
        </p>
        <p v-if="serverErrors.comment" class="mt-1 text-xs text-danger" role="alert">
          {{ serverErrors.comment }}
        </p>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
