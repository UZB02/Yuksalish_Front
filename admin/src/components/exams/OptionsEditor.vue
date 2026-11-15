<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { QuestionBlock, QuestionOption } from '@/api/types'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { QUESTION_LIMITS, addOption, toggleCorrect } from '@/utils/examQuestion'
import BlockEditor from './BlockEditor.vue'

/**
 * Variantlar muharriri. single: bitta to'g'ri (radio); multi: bir nechta to'g'ri (checkbox) va
 * "qisman ball" tanlovi.
 */
const props = defineProps<{
  type: 'single' | 'multi'
  options: QuestionOption[]
  correctOptionId: string
  correctOptionIds: string[]
  partialCredit: boolean
  error?: string
  answerError?: string
}>()
const emit = defineEmits<{
  'update:options': [value: QuestionOption[]]
  'update:correctOptionId': [value: string]
  'update:correctOptionIds': [value: string[]]
  'update:partialCredit': [value: boolean]
  remove: [id: string]
}>()

const { t } = useI18n()
const letter = (i: number) => String.fromCharCode(65 + i)

function setContent(id: string, content: QuestionBlock[]) {
  emit(
    'update:options',
    props.options.map((o) => (o.id === id ? { ...o, content } : o)),
  )
}
</script>

<template>
  <div class="space-y-3" data-testid="options-editor">
    <div
      v-for="(o, i) in options"
      :key="o.id"
      class="flex gap-3 rounded-lg border p-3"
      :class="
        (type === 'single' ? correctOptionId === o.id : correctOptionIds.includes(o.id))
          ? 'border-success/50 bg-success-soft/40'
          : 'border-border'
      "
      data-testid="option-row"
    >
      <div class="flex w-10 shrink-0 flex-col items-center gap-2 pt-1">
        <span class="text-sm font-semibold text-fg-muted" aria-hidden="true">{{ letter(i) }}</span>
        <input
          v-if="type === 'single'"
          type="radio"
          name="correct-option"
          :checked="correctOptionId === o.id"
          :aria-label="t('exams.options.markCorrect', { letter: letter(i) })"
          class="h-5 w-5 cursor-pointer accent-primary-600"
          data-testid="option-correct"
          @change="emit('update:correctOptionId', o.id)"
        />
        <input
          v-else
          type="checkbox"
          :checked="correctOptionIds.includes(o.id)"
          :aria-label="t('exams.options.markCorrect', { letter: letter(i) })"
          class="h-5 w-5 cursor-pointer accent-primary-600"
          data-testid="option-correct"
          @change="emit('update:correctOptionIds', toggleCorrect(correctOptionIds, o.id))"
        />
      </div>
      <div class="min-w-0 flex-1">
        <BlockEditor
          :model-value="o.content"
          compact
          :max="QUESTION_LIMITS.optionBlocks"
          @update:model-value="setContent(o.id, $event)"
        />
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-md text-danger hover:bg-danger-soft disabled:opacity-40"
        :disabled="options.length <= 2"
        :aria-label="t('exams.options.remove', { letter: letter(i) })"
        data-testid="option-remove"
        @click="emit('remove', o.id)"
      >
        <Trash2 class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-fg-muted hover:border-primary-600 hover:text-primary-700 disabled:opacity-50"
        :disabled="options.length >= QUESTION_LIMITS.options"
        data-testid="option-add"
        @click="emit('update:options', addOption(options))"
      >
        <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('exams.options.add') }}
      </button>
      <BaseSwitch
        v-if="type === 'multi'"
        :model-value="partialCredit"
        :label="t('exams.options.partialCredit')"
        data-testid="partial-credit"
        @update:model-value="emit('update:partialCredit', $event)"
      />
    </div>
    <p v-if="type === 'multi'" class="text-xs text-fg-muted">
      {{ t('exams.options.partialCreditHint') }}
    </p>
    <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
    <p v-if="answerError" class="text-xs text-danger" role="alert" data-testid="answer-error">
      {{ answerError }}
    </p>
  </div>
</template>
