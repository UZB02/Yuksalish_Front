<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import type { AttendanceSummaryStudent } from '@/api/types'
import { formatRate, rateTone } from '@/utils/attendance'

const props = defineProps<{ rows: AttendanceSummaryStudent[]; unit: 'day' | 'lesson' }>()
const emit = defineEmits<{ open: [studentId: string] }>()
const { t } = useI18n()

type SortKey =
  'fullName' | 'present' | 'late' | 'absentExcused' | 'absentUnexcused' | 'total' | 'rate'
const sortKey = ref<SortKey>('rate')
const dir = ref<1 | -1>(1) // rate: pastdan yuqoriga (e'tibor talab qiluvchilar birinchi)

function sortBy(k: SortKey) {
  if (sortKey.value === k) dir.value = dir.value === 1 ? -1 : 1
  else {
    sortKey.value = k
    dir.value = k === 'fullName' || k === 'rate' ? 1 : -1
  }
}

const sorted = computed(() => {
  const k = sortKey.value
  return [...props.rows].sort((a, b) => {
    const av = a[k]
    const bv = b[k]
    if (k === 'fullName') return dir.value * String(av).localeCompare(String(bv), 'uz')
    // null foizlar (ma'lumot yo'q) oxirida
    if (av === null) return 1
    if (bv === null) return -1
    return dir.value * ((av as number) - (bv as number))
  })
})

const COLS: { key: SortKey; label: string; cls?: string }[] = [
  { key: 'fullName', label: 'common.fullName' },
  {
    key: 'present',
    label: 'attendance.categories.present',
    cls: 'hidden sm:table-cell text-right',
  },
  { key: 'late', label: 'attendance.categories.late', cls: 'hidden sm:table-cell text-right' },
  {
    key: 'absentExcused',
    label: 'attendance.categories.absent_excused',
    cls: 'hidden md:table-cell text-right',
  },
  {
    key: 'absentUnexcused',
    label: 'attendance.categories.absent_unexcused',
    cls: 'hidden md:table-cell text-right',
  },
  { key: 'total', label: 'attendance.summary.total', cls: 'hidden lg:table-cell text-right' },
  { key: 'rate', label: 'attendance.summary.rate', cls: 'w-40' },
]

const barColor = (rate: number | null) =>
  ({ success: '#16a34a', warning: '#d97706', danger: '#dc2626', neutral: '#94a3b8' })[
    rateTone(rate)
  ]
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-full text-left text-sm" data-testid="summary-table">
      <caption class="sr-only">
        {{
          t('attendance.summary.caption', { unit: t(`attendance.units.${unit}`) })
        }}
      </caption>
      <thead>
        <tr class="border-b border-border bg-surface-muted/60">
          <th
            v-for="c in COLS"
            :key="c.key"
            scope="col"
            class="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted"
            :class="c.cls"
            :aria-sort="sortKey === c.key ? (dir === 1 ? 'ascending' : 'descending') : 'none'"
          >
            <button
              type="button"
              class="inline-flex items-center gap-1 uppercase"
              @click="sortBy(c.key)"
            >
              {{ t(c.label) }}
              <template v-if="sortKey === c.key">
                <ArrowUp v-if="dir === 1" class="h-3 w-3" aria-hidden="true" />
                <ArrowDown v-else class="h-3 w-3" aria-hidden="true" />
              </template>
            </button>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr
          v-for="r in sorted"
          :key="r.studentId"
          class="cursor-pointer transition-colors hover:bg-surface-muted/50"
          data-testid="summary-row"
          tabindex="0"
          @click="emit('open', r.studentId)"
          @keydown.enter="emit('open', r.studentId)"
        >
          <td class="px-4 py-3 font-medium text-fg">{{ r.fullName }}</td>
          <td class="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{{ r.present }}</td>
          <td class="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{{ r.late }}</td>
          <td class="hidden px-4 py-3 text-right tabular-nums md:table-cell">
            {{ r.absentExcused }}
          </td>
          <td class="hidden px-4 py-3 text-right tabular-nums md:table-cell">
            {{ r.absentUnexcused }}
          </td>
          <td class="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{{ r.total }}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <div
                class="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                :aria-valuenow="r.rate ?? 0"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="t('attendance.summary.rate')"
              >
                <div
                  class="h-full rounded-full"
                  :style="{
                    width: `${Math.min(100, r.rate ?? 0)}%`,
                    backgroundColor: barColor(r.rate),
                  }"
                />
              </div>
              <span class="w-12 text-right text-xs font-semibold tabular-nums text-fg">
                {{ formatRate(r.rate) }}
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
