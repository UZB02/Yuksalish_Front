<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FilterKey, StatCell } from '@/utils/examBoard'

/**
 * Raqamlar qatori (har katak ~ 2 qator): filtri bor kataklar tugma (aria-pressed), qolganlari oddiy ma'lumot.
 * Tanlangan filtr pastidan chiziq bilan ajratiladi.
 */
const props = defineProps<{ cells: StatCell[]; active: FilterKey }>()
const emit = defineEmits<{ filter: [key: FilterKey] }>()
const { t } = useI18n()

/** Telefonda qator to'la bo'lsin: 5 katak = 3 + 2 (6 ustunli grid: 2,2,2 / 3,3), 6 katak = 3 + 3 */
const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-6 sm:grid-cols-5',
  6: 'grid-cols-6',
}
const span = (i: number): string => {
  const n = props.cells.length
  if (n === 5) return i < 3 ? 'col-span-2 sm:col-span-1' : 'col-span-3 sm:col-span-1'
  if (n === 6) return 'col-span-2 sm:col-span-1'
  return ''
}
const TONE = {
  primary: 'text-primary-700',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

const sub = (c: StatCell): string | null => {
  if (c.key === 'students') return t('examBoard.cellSub.classes', { n: Number(c.sub ?? 0) })
  if (c.key === 'subjects' && c.value !== '—') return t('examBoard.cellSub.approved')
  return null
}
const cols = () => COLS[props.cells.length] ?? 'grid-cols-2 sm:grid-cols-4'
</script>

<template>
  <div
    class="card mb-3 grid overflow-hidden"
    :class="cols()"
    role="group"
    :aria-label="t('examBoard.stripAria')"
    data-testid="stat-strip"
  >
    <template v-for="(c, i) in cells" :key="c.key">
      <button
        v-if="c.filter"
        type="button"
        class="-mb-px -mr-px border-b border-r border-border px-4 py-2 text-left hover:bg-surface-muted"
        :class="[span(i), active === c.filter ? 'bg-primary-50' : '']"
        :style="
          active === c.filter ? { boxShadow: 'inset 0 -3px 0 rgb(var(--primary-600))' } : undefined
        "
        :aria-pressed="active === c.filter"
        :data-testid="`stat-${c.key}`"
        @click="emit('filter', c.filter)"
      >
        <span class="block text-xs text-fg-muted">{{ t(`examBoard.cells.${c.label}`) }}</span>
        <span
          class="block text-xl font-semibold leading-7 tabular-nums"
          :class="c.tone ? TONE[c.tone] : 'text-fg'"
          data-testid="stat-value"
          >{{ c.value }}</span
        >
      </button>
      <div
        v-else
        class="-mb-px -mr-px border-b border-r border-border px-4 py-2"
        :class="span(i)"
        :data-testid="`stat-${c.key}`"
      >
        <span class="block text-xs text-fg-muted">
          {{ t(`examBoard.cells.${c.label}`) }}
          <template v-if="sub(c)">· {{ sub(c) }}</template>
        </span>
        <span
          class="block text-xl font-semibold leading-7 tabular-nums"
          :class="c.tone ? TONE[c.tone] : 'text-fg'"
          data-testid="stat-value"
          >{{ c.value }}</span
        >
      </div>
    </template>
  </div>
</template>
