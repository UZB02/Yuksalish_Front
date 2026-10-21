<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BehaviorType, ScoringSettings } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { RowDraft } from '@/utils/scoring'
import { quickScores } from '@/utils/scoring'
import BehaviorChips from './BehaviorChips.vue'

const props = defineProps<{ count: number; settings: ScoringSettings; types: BehaviorType[] }>()
const emit = defineEmits<{ apply: [change: Partial<RowDraft>]; clear: [] }>()
const { t } = useI18n()

// type=number input v-model qiymatni songa aylantiradi, shuning uchun har doim satrga o'giramiz.
const value = ref<string | number>('')
const valueText = computed(() => String(value.value ?? '').trim())
const behaviorTypeId = ref<string | null>(null)
const comment = ref('')
const quick = computed(() => quickScores(props.settings))

const canApply = computed(
  () => valueText.value !== '' || behaviorTypeId.value !== null || comment.value.trim() !== '',
)

function apply() {
  const change: Partial<RowDraft> = {}
  if (valueText.value !== '') change.value = valueText.value
  if (behaviorTypeId.value) change.behaviorTypeId = behaviorTypeId.value
  if (comment.value.trim() !== '') change.comment = comment.value.trim()
  emit('apply', change)
}
</script>

<template>
  <section
    class="card space-y-3 border-primary-500 p-3 sm:p-4"
    :aria-label="t('scoring.bulk.title')"
  >
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-fg">
        {{ t('scoring.bulk.title') }} - {{ t('scoring.bulk.selected', { n: count }) }}
      </h2>
      <BaseButton size="sm" variant="ghost" @click="emit('clear')">
        {{ t('scoring.bulk.clear') }}
      </BaseButton>
    </div>
    <div class="grid gap-3 sm:grid-cols-[auto_1fr]">
      <div class="flex flex-wrap items-center gap-1.5">
        <input
          v-model="value"
          type="number"
          inputmode="numeric"
          :min="settings.minScore"
          :max="settings.maxScore"
          :aria-label="t('scoring.score')"
          placeholder="-"
          class="h-9 w-20 rounded-lg border border-border bg-surface px-2 text-center font-semibold text-fg focus:border-primary-500"
        />
        <button
          v-for="q in quick"
          :key="q"
          type="button"
          class="h-8 rounded-md border border-border px-2 text-xs text-fg-muted hover:bg-surface-muted"
          @click="value = String(q)"
        >
          {{ q }}
        </button>
      </div>
      <BehaviorChips v-model="behaviorTypeId" :types="types" />
    </div>
    <input
      v-model="comment"
      type="text"
      :aria-label="t('scoring.comment')"
      :placeholder="t('scoring.commentPlaceholder')"
      class="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-primary-500"
    />
    <BaseButton :disabled="!canApply" @click="apply">{{ t('scoring.bulk.apply') }}</BaseButton>
  </section>
</template>
