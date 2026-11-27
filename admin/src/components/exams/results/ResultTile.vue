<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import type { ExamResultRow } from '@/api/types'
import ProgressRing from '@/components/exams/session/ProgressRing.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { minutes, rowTone, TONE_COLOR } from './resultsModel'

/** O'quvchi kartasi (balandligi 56 px): o'rin, foiz halqasi, ism, ball/variant/vaqt yoki to'xtatilgan sababi, belgilar */
const props = defineProps<{ row: ExamResultRow }>()
const emit = defineEmits<{ open: [key: string] }>()
const { t } = useI18n()

const tone = computed(() => rowTone(props.row))
const color = computed(() => TONE_COLOR[tone.value])
const pct = computed(() => Math.round(props.row.percent ?? 0))
const sub = computed(() => {
  const r = props.row
  if (r.terminated) return t('examResults.terminated', { reason: r.terminated.reason })
  if (r.earned === null) return t(`examResults.status.${r.status}`)
  const min = minutes(r.timeSpentSec)
  return [
    `${r.earned}/${r.max}`,
    r.variant ? r.variant : null,
    min === null ? null : t('examResults.cards.min', { n: min }),
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <button
    type="button"
    class="flex h-14 w-full min-w-0 items-center gap-2 rounded-lg border border-border px-2 text-left hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
    :class="tone === 't' ? 'bg-warning-soft/50' : 'bg-surface'"
    :style="{ borderLeft: `4px solid ${color}` }"
    :aria-label="t('examResults.cards.open', { name: row.fullName })"
    data-testid="result-row"
    :data-tone="tone"
    @click="emit('open', row.key)"
  >
    <span
      class="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-fg-muted"
      data-testid="cell-rank"
      >{{ row.rank ?? '—' }}</span
    >
    <ProgressRing
      :pct="row.percent === null ? 0 : row.percent"
      :color="color"
      :label="row.percent === null ? '—' : pct + '%'"
    />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-[13px] font-medium leading-5" data-testid="cell-name">{{
        row.fullName
      }}</span>
      <span
        class="block truncate text-[11px] leading-4"
        :class="row.terminated ? 'text-danger' : 'text-fg-muted'"
        data-testid="cell-sub"
        >{{ sub }}</span
      >
    </span>
    <span class="flex shrink-0 flex-col items-end gap-0.5">
      <BaseBadge
        v-if="row.essayPending > 0"
        tone="warning"
        class="!px-1.5"
        data-testid="essay-badge"
        >{{ t('examResults.cards.essayShort') }}</BaseBadge
      >
      <span
        v-if="row.warnings > 0"
        class="inline-flex items-center gap-0.5 text-[11px] text-warning"
        :title="t('examResults.cards.warnings', { n: row.warnings })"
      >
        <AlertTriangle class="h-3 w-3" aria-hidden="true" />{{ row.warnings }}
      </span>
    </span>
  </button>
</template>
