<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Lock, Pencil } from 'lucide-vue-next'
import type { BehaviorType, ScoringSettings } from '@/api/types'
import type { RowStatus, SheetRow } from '@/composables/useScoringSheet'
import {
  COMMENT_MAX,
  isCommentRequired,
  quickScores,
  type DraftErrors,
  type RowDraft,
} from '@/utils/scoring'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BehaviorChips from './BehaviorChips.vue'
import ScoreSlider from './ScoreSlider.vue'

const props = defineProps<{
  row: SheetRow
  index: number
  status: RowStatus
  errors: DraftErrors
  settings: ScoringSettings
  types: BehaviorType[]
  selected: boolean
  /** Xatolarni faqat qator o'zgargan bo'lsa ko'rsatamiz */
  showErrors: boolean
}>()
const emit = defineEmits<{
  patch: [studentId: string, change: Partial<RowDraft>]
  select: [studentId: string, on: boolean]
  next: [index: number]
}>()
const { t } = useI18n()

const quick = computed(() => quickScores(props.settings))
const locked = computed(() => props.status === 'locked')
const commentRequired = computed(() => isCommentRequired(props.row.draft, props.settings))
const area = ref<HTMLTextAreaElement | null>(null)

const errText = (key?: string) =>
  key && props.showErrors
    ? t(`scoring.errors.${key}`, {
        min: props.settings.minScore,
        max: props.settings.maxScore,
        below: props.settings.commentRequiredBelow ?? 0,
        limit: COMMENT_MAX,
      })
    : ''

function onComment(e: Event) {
  emit('patch', props.row.studentId, { comment: (e.target as HTMLTextAreaElement).value })
  autosize()
}

function autosize() {
  const el = area.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
watch(
  () => props.row.draft.comment,
  () => nextTick(autosize),
)

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
</script>

<template>
  <li class="card p-3 sm:p-4" :class="border" :data-status="status">
    <div class="flex items-start gap-3">
      <BaseCheckbox
        class="pt-1"
        :model-value="selected"
        :disabled="locked"
        :aria-label="t('scoring.selectRow', { name: row.fullName })"
        @update:model-value="emit('select', row.studentId, $event)"
      />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2.5">
            <AvatarImage :name="row.fullName" :src="row.photo" size="sm" alt="" />
            <div class="min-w-0">
              <p class="truncate font-medium text-fg">{{ row.fullName }}</p>
              <p v-if="row.studentCode" class="text-xs text-fg-muted">{{ row.studentCode }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span
              v-if="row.dayScore !== null"
              class="rounded-full bg-surface-muted px-2 py-0.5 text-fg-muted"
              :title="t('scoring.dayScoreHint', { n: row.scoresCount })"
            >
              {{ t('scoring.dayScore') }}: <b class="text-fg">{{ row.dayScore }}</b>
            </span>
            <span v-if="status === 'locked'" class="inline-flex items-center gap-1 text-fg-muted">
              <Lock class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('scoring.status.locked') }}
            </span>
            <span
              v-else-if="status === 'saved'"
              class="inline-flex items-center gap-1 text-success"
            >
              <CheckCircle2 class="h-3.5 w-3.5" aria-hidden="true" />
              {{ t('scoring.status.saved') }}
            </span>
            <span
              v-else-if="status === 'dirty'"
              class="inline-flex items-center gap-1 text-primary-700"
            >
              <Pencil class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('scoring.status.dirty') }}
            </span>
            <span v-else-if="status === 'error'" class="inline-flex items-center gap-1 text-danger">
              <AlertCircle class="h-3.5 w-3.5" aria-hidden="true" /> {{ t('scoring.status.error') }}
            </span>
          </div>
        </div>

        <p v-if="locked" class="mt-1 text-xs text-fg-muted">
          {{ t('scoring.lockedReason', { hours: settings.editWindowHours }) }}
        </p>
        <p v-if="row.serverError" class="mt-1 text-xs text-danger" role="alert">
          {{ row.serverError }}
        </p>

        <div class="mt-3 grid gap-3 lg:grid-cols-[16rem_1fr]">
          <div>
            <ScoreSlider
              :model-value="row.draft.value"
              :min="settings.minScore"
              :max="settings.maxScore"
              :quick="quick"
              :disabled="locked"
              :invalid="!!errors.value && showErrors"
              :index="index"
              :label="`${t('scoring.score')}: ${row.fullName}`"
              @update:model-value="emit('patch', row.studentId, { value: $event })"
              @enter="emit('next', index)"
            />
            <p v-if="errText(errors.value)" class="mt-1 text-xs text-danger" role="alert">
              {{ errText(errors.value) }}
            </p>
          </div>
          <div class="space-y-2">
            <BehaviorChips
              :types="types"
              :model-value="row.draft.behaviorTypeId"
              :disabled="locked"
              :invalid="!!errors.behavior && showErrors"
              :label="`${t('scoring.behaviorType')}: ${row.fullName}`"
              @update:model-value="emit('patch', row.studentId, { behaviorTypeId: $event })"
            />
            <p v-if="errText(errors.behavior)" class="text-xs text-danger" role="alert">
              {{ errText(errors.behavior) }}
            </p>
            <div>
              <textarea
                ref="area"
                rows="1"
                :value="row.draft.comment"
                :disabled="locked"
                :maxlength="COMMENT_MAX + 50"
                :aria-label="`${t('scoring.comment')}: ${row.fullName}`"
                :aria-required="commentRequired"
                :placeholder="
                  commentRequired
                    ? t('scoring.commentRequiredPlaceholder')
                    : t('scoring.commentPlaceholder')
                "
                class="min-h-[2.5rem] w-full resize-none rounded-lg border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted/70 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                :class="errors.comment && showErrors ? 'border-danger' : 'border-border'"
                @input="onComment"
              />
              <p v-if="errText(errors.comment)" class="mt-1 text-xs text-danger" role="alert">
                {{ errText(errors.comment) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </li>
</template>
