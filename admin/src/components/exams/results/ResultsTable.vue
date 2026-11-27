<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import type { ExamResultBlockHeader, ExamResultRow } from '@/api/types'
import ProgressRing from '@/components/exams/session/ProgressRing.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AbsentChips from './AbsentChips.vue'
import { fmtTime, rowTone, TONE_COLOR, type SortKey } from './resultsModel'

/** Jadval ko'rinishi (Kartalar/Jadval almashtirgichining ikkinchisi): md+ jadval, kichikda ro'yxat qatorlari */
const props = defineProps<{
  rows: ExamResultRow[]
  blockCols: ExamResultBlockHeader[]
  hasVariant: boolean
  hasPass: boolean
  sortKey: SortKey
  sortDir: 1 | -1
  absent: string[]
}>()
const emit = defineEmits<{ sort: [key: SortKey]; open: [key: string]; expandAbsent: [] }>()
const { t } = useI18n()

const blockCell = (r: ExamResultRow, id: string) => {
  const b = r.blocks?.find((x) => x.blockId === id)
  return b ? `${b.earned}/${b.max}` : '—'
}
const statusTone = (s: string) =>
  s === 'submitted'
    ? 'success'
    : s === 'auto_submitted'
      ? 'primary'
      : s === 'in_progress'
        ? 'warning'
        : 'neutral'
const ariaSort = (k: SortKey) =>
  props.sortKey === k ? (props.sortDir === 1 ? 'ascending' : 'descending') : 'none'
</script>

<template>
  <div class="card overflow-hidden" data-testid="results-table-card">
    <div class="hidden overflow-x-auto md:block">
      <table class="w-full min-w-[860px] text-left text-sm" data-testid="results-table">
        <thead class="border-b border-border text-xs text-fg-muted">
          <tr>
            <th class="py-2.5 pl-3 pr-3 font-medium" :aria-sort="ariaSort('rank')">
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-fg"
                :class="sortKey === 'rank' ? 'text-fg' : ''"
                data-testid="sort-rank"
                @click="emit('sort', 'rank')"
              >
                {{ t('examResults.cols.rank') }}
                <component
                  :is="sortDir === 1 ? ChevronUp : ChevronDown"
                  v-if="sortKey === 'rank'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
              </button>
            </th>
            <th class="px-3 py-2.5 font-medium" :aria-sort="ariaSort('name')">
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-fg"
                :class="sortKey === 'name' ? 'text-fg' : ''"
                data-testid="sort-name"
                @click="emit('sort', 'name')"
              >
                {{ t('examResults.cols.name') }}
                <component
                  :is="sortDir === 1 ? ChevronUp : ChevronDown"
                  v-if="sortKey === 'name'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
              </button>
            </th>
            <th class="px-3 py-2.5 font-medium">{{ t('examResults.cols.cls') }}</th>
            <th v-if="hasVariant" class="px-3 py-2.5 font-medium" data-testid="col-variant">
              {{ t('examResults.cols.variant') }}
            </th>
            <th class="px-3 py-2.5 font-medium">{{ t('examResults.cols.status') }}</th>
            <th
              v-for="(h, hi) in blockCols"
              :key="h.id"
              class="px-3 py-2.5 font-medium"
              :data-testid="`block-col-${hi}`"
            >
              {{ h.title || h.subjectName }}
            </th>
            <th class="px-3 py-2.5 font-medium">{{ t('examResults.cols.score') }}</th>
            <th class="px-3 py-2.5 font-medium" :aria-sort="ariaSort('percent')">
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-fg"
                :class="sortKey === 'percent' ? 'text-fg' : ''"
                data-testid="sort-percent"
                @click="emit('sort', 'percent')"
              >
                {{ t('examResults.cols.percent') }}
                <component
                  :is="sortDir === 1 ? ChevronUp : ChevronDown"
                  v-if="sortKey === 'percent'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
              </button>
            </th>
            <th v-if="hasPass" class="px-3 py-2.5 font-medium">
              {{ t('examResults.cols.passed') }}
            </th>
            <th class="px-3 py-2.5 font-medium">{{ t('examResults.cols.answered') }}</th>
            <th class="px-3 py-2.5 font-medium" :aria-sort="ariaSort('time')">
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-fg"
                :class="sortKey === 'time' ? 'text-fg' : ''"
                data-testid="sort-time"
                @click="emit('sort', 'time')"
              >
                {{ t('examResults.cols.time') }}
                <component
                  :is="sortDir === 1 ? ChevronUp : ChevronDown"
                  v-if="sortKey === 'time'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
              </button>
            </th>
            <th class="px-3 py-2.5 font-medium">{{ t('examResults.cols.warnings') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="r in rows"
            :key="r.key"
            class="cursor-pointer hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
            :class="r.terminated ? 'bg-warning-soft/40' : ''"
            tabindex="0"
            data-testid="result-row"
            @click="emit('open', r.key)"
            @keydown.enter="emit('open', r.key)"
          >
            <td class="py-2 pl-3 pr-3 font-semibold" data-testid="cell-rank">
              {{ r.rank ?? '—' }}
            </td>
            <td class="px-3 py-2 font-medium text-fg" data-testid="cell-name">{{ r.fullName }}</td>
            <td class="px-3 py-2 text-fg-muted">{{ r.className ?? '—' }}</td>
            <td v-if="hasVariant" class="px-3 py-2 font-semibold" data-testid="cell-variant">
              {{ r.variant ?? '—' }}
            </td>
            <td class="px-3 py-2">
              <BaseBadge :tone="statusTone(r.status)" data-testid="cell-status">{{
                t(`examResults.status.${r.status}`)
              }}</BaseBadge>
              <p
                v-if="r.terminated"
                class="mt-0.5 text-xs text-danger"
                data-testid="cell-terminated"
              >
                {{ t('examResults.terminated', { reason: r.terminated.reason }) }}
              </p>
            </td>
            <td
              v-for="(h, hi) in blockCols"
              :key="h.id"
              class="px-3 py-2"
              :data-testid="`cell-block-${hi}`"
            >
              {{ r.earned !== null ? blockCell(r, h.id) : '—' }}
            </td>
            <td class="px-3 py-2" data-testid="cell-score">
              <template v-if="r.earned !== null">{{ r.earned }} / {{ r.max }}</template>
              <template v-else>—</template>
              <BaseBadge
                v-if="r.essayPending"
                tone="warning"
                class="ml-1"
                data-testid="essay-badge"
                >{{ t('examResults.essayN', { n: r.essayPending }) }}</BaseBadge
              >
            </td>
            <td class="px-3 py-2" data-testid="cell-percent">
              {{ r.percent ?? '—' }}<span v-if="r.percent !== null">%</span>
            </td>
            <td v-if="hasPass" class="px-3 py-2">
              <BaseBadge
                v-if="r.passed !== null"
                :tone="r.passed ? 'success' : 'danger'"
                data-testid="cell-passed"
                >{{ r.passed ? t('examResults.yes') : t('examResults.no') }}</BaseBadge
              >
              <span v-else class="text-fg-muted">—</span>
            </td>
            <td class="px-3 py-2 text-fg-muted">
              {{ r.total ? `${r.answered}/${r.total}` : '—' }}
            </td>
            <td class="px-3 py-2 text-fg-muted">{{ fmtTime(r.timeSpentSec) }}</td>
            <td class="px-3 py-2">
              <BaseBadge v-if="r.warnings > 0" tone="warning">{{ r.warnings }}</BaseBadge>
              <span v-else class="text-fg-muted">0</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Telefon / tor ekran: ro'yxat qatorlari -->
    <div class="divide-y divide-border md:hidden">
      <button
        v-for="r in rows"
        :key="r.key"
        type="button"
        class="flex w-full items-center gap-2.5 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
        :class="r.terminated ? 'bg-warning-soft/40' : ''"
        :aria-label="t('examResults.cards.open', { name: r.fullName })"
        data-testid="result-item"
        @click="emit('open', r.key)"
      >
        <span class="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-fg-muted">{{
          r.rank ?? '—'
        }}</span>
        <ProgressRing
          :pct="r.percent ?? 0"
          :color="TONE_COLOR[rowTone(r)]"
          :label="r.percent === null ? '—' : Math.round(r.percent) + '%'"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ r.fullName }}</span>
          <span class="block truncate text-xs text-fg-muted"
            >{{ r.className ?? '—' }}{{ r.variant ? ' · ' + r.variant : ''
            }}{{ r.earned !== null ? ` · ${r.earned}/${r.max}` : ''
            }}<span v-if="r.terminated" class="text-danger">
              · {{ t('examResults.terminated', { reason: r.terminated.reason }) }}</span
            ></span
          >
        </span>
        <span class="flex shrink-0 flex-col items-end gap-1">
          <BaseBadge :tone="statusTone(r.status)">{{
            t(`examResults.status.${r.status}`)
          }}</BaseBadge>
          <span v-if="r.essayPending > 0 || r.warnings > 0" class="flex items-center gap-1">
            <BaseBadge v-if="r.essayPending > 0" tone="warning">{{
              t('examResults.cards.essayShort')
            }}</BaseBadge>
            <span
              v-if="r.warnings > 0"
              class="inline-flex items-center gap-0.5 text-xs text-warning"
            >
              <AlertTriangle class="h-3.5 w-3.5" aria-hidden="true" />{{ r.warnings }}
            </span>
          </span>
        </span>
      </button>
    </div>

    <AbsentChips :names="absent" expandable class="px-3 pb-2.5" @expand="emit('expandAbsent')" />
  </div>
</template>
