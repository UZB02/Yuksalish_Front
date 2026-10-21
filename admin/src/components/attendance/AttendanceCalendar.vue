<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { AttendanceDay } from '@/api/types'
import { CATEGORY_COLORS, isWorkingDay, monthGrid, shiftMonth, textOn } from '@/utils/attendance'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  /** 'YYYY-MM' */
  month: string
  days: AttendanceDay[]
  workingWeekdays: number[]
  /** Davr chegarasi: undan tashqaridagi kunlar xira */
  from?: string
  to?: string
}>()
const emit = defineEmits<{ 'update:month': [value: string] }>()
const { t } = useI18n()

const byDate = computed(() => new Map(props.days.map((d) => [d.date, d])))
const weeks = computed(() => monthGrid(props.month))
const title = computed(() => {
  const [y, m] = props.month.split('-')
  return `${t(`calendar.months.${Number(m)}`)} ${y}`
})

type Kind = 'record' | 'rest' | 'empty' | 'outside'
function kindOf(date: string): Kind {
  if ((props.from && date < props.from) || (props.to && date > props.to)) return 'outside'
  if (!isWorkingDay(date, props.workingWeekdays)) return 'rest'
  return byDate.value.has(date) ? 'record' : 'empty'
}

function tooltip(date: string): string {
  const d = byDate.value.get(date)
  const k = kindOf(date)
  const base = formatDate(date)
  if (k === 'rest') return `${base}: ${t('calendar.rest')}`
  if (!d) return `${base}: ${t('calendar.noRecord')}`
  return `${base}: ${t(`attendance.categories.${d.category}`)}${d.lessons ? `, ${t('calendar.lessons', { n: d.lessons })}` : ''}`
}

function cellStyle(date: string) {
  const d = byDate.value.get(date)
  if (kindOf(date) === 'record' && d) {
    const c = CATEGORY_COLORS[d.category]
    return { backgroundColor: c, color: textOn(c) }
  }
  return {}
}
</script>

<template>
  <div data-testid="calendar">
    <div class="mb-2 flex items-center justify-between">
      <button
        type="button"
        class="rounded-lg p-2 text-fg-muted hover:bg-surface-muted"
        :aria-label="t('calendar.prev')"
        @click="emit('update:month', shiftMonth(month, -1))"
      >
        <ChevronLeft class="h-5 w-5" />
      </button>
      <p class="text-sm font-semibold text-fg" aria-live="polite" data-testid="calendar-title">
        {{ title }}
      </p>
      <button
        type="button"
        class="rounded-lg p-2 text-fg-muted hover:bg-surface-muted"
        :aria-label="t('calendar.next')"
        @click="emit('update:month', shiftMonth(month, 1))"
      >
        <ChevronRight class="h-5 w-5" />
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-xs text-fg-muted" aria-hidden="true">
      <span v-for="d in 7" :key="d">{{ t(`settingsAttendance.weekdays.${d}`) }}</span>
    </div>
    <div class="mt-1 space-y-1">
      <div v-for="(week, wi) in weeks" :key="wi" class="grid grid-cols-7 gap-1">
        <template v-for="(cell, ci) in week" :key="ci">
          <span v-if="!cell.date" />
          <span
            v-else
            class="flex aspect-square items-center justify-center rounded-lg text-sm font-medium"
            :class="{
              'bg-surface-muted text-fg-muted/70': kindOf(cell.date) === 'rest',
              'border border-dashed border-border text-fg-muted': kindOf(cell.date) === 'empty',
              'text-fg-muted/40': kindOf(cell.date) === 'outside',
            }"
            :style="cellStyle(cell.date)"
            :title="tooltip(cell.date)"
            :data-date="cell.date"
            :data-kind="kindOf(cell.date)"
            :data-category="byDate.get(cell.date)?.category"
            role="img"
            :aria-label="tooltip(cell.date)"
          >
            {{ cell.day }}
          </span>
        </template>
      </div>
    </div>

    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
      <li
        v-for="(color, cat) in CATEGORY_COLORS"
        :key="cat"
        class="inline-flex items-center gap-1.5"
      >
        <span class="h-3 w-3 rounded" :style="{ backgroundColor: color }" aria-hidden="true" />
        {{ t(`attendance.categories.${cat}`) }}
      </li>
      <li class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded bg-surface-muted" aria-hidden="true" />
        {{ t('calendar.rest') }}
      </li>
    </ul>
  </div>
</template>
