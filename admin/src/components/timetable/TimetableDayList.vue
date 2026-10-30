<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import {
  cellKey,
  maxLessonNo,
  rowCountFor,
  severityOf,
  TIMETABLE_MAX_LESSONS,
  type CellMap,
} from '@/utils/timetable'
import { cellIssueSummary, type TimetableIssue } from '@/utils/timetableIssues'
import TimetableCellContent from './TimetableCellContent.vue'

/** Mobil ko'rinish: hafta kunlari tablari + tanlangan kunning darslari ro'yxati */
const props = defineProps<{
  weekdays: number[]
  /** Sozlamadagi darslar soni: har kunning minimal qatorlari */
  lessonsPerDay: number
  cells: CellMap
  issuesMap: Record<string, TimetableIssue[]>
  outOfRangeKeys: string[]
  editable: boolean
  /** Boshlang'ich kun (bugungi hafta kuni, bo'lsa) */
  initialWeekday?: number
  /** Tashqaridan kunni ko'rsatish (muammodan katakka o'tish) */
  focusWeekday?: number
}>()
const emit = defineEmits<{
  edit: [weekday: number, lessonNo: number]
  clear: [weekday: number, lessonNo: number]
  dayAction: [weekday: number, action: 'copy' | 'clear']
}>()
const { t } = useI18n()

const active = ref(props.weekdays[0] ?? 1)
watch(
  () => props.weekdays,
  (list) => {
    if (!list.includes(active.value)) {
      active.value = list.includes(props.initialWeekday ?? 0)
        ? props.initialWeekday!
        : (list[0] ?? 1)
    }
  },
  { immediate: true },
)
watch(
  () => props.focusWeekday,
  (w) => {
    if (w && props.weekdays.includes(w)) active.value = w
  },
)
/** Kunlar bo'yicha qo'lda o'zgartirilgan qatorlar soni (ko'rinish holati) */
const rowsByDay = ref<Record<number, number>>({})
const usedMax = computed(() => maxLessonNo(props.cells, active.value))
const rowCount = computed(() =>
  rowCountFor(rowsByDay.value[active.value] ?? props.lessonsPerDay, usedMax.value),
)
const rows = computed(() => Array.from({ length: rowCount.value }, (_, i) => i + 1))
const canAdd = computed(() => props.editable && rowCount.value < TIMETABLE_MAX_LESSONS)
const canRemove = computed(
  () => props.editable && rowCount.value > 1 && usedMax.value < rowCount.value,
)
const addSlot = () => {
  if (canAdd.value) rowsByDay.value = { ...rowsByDay.value, [active.value]: rowCount.value + 1 }
}
const removeSlot = () => {
  if (canRemove.value) rowsByDay.value = { ...rowsByDay.value, [active.value]: rowCount.value - 1 }
}
const outSet = computed(() => new Set(props.outOfRangeKeys))
const dayItems = computed<DropdownItem[]>(() => [
  { key: 'copy', label: t('timetable.copyDay') },
  { key: 'clear', label: t('timetable.clearDay'), danger: true },
])
const sevOf = (n: number) => severityOf(props.issuesMap[cellKey(active.value, n)])
const ariaOf = (n: number) =>
  [
    `${t(`journal.weekdayLong.${active.value}`)}, ${n}`,
    cellIssueSummary(props.issuesMap[cellKey(active.value, n)], t),
  ]
    .filter(Boolean)
    .join(', ')
const countOf = (w: number) => Object.keys(props.cells).filter((k) => k.startsWith(`${w}:`)).length
</script>

<template>
  <div class="space-y-3" data-testid="tt-daylist">
    <div class="flex gap-1 overflow-x-auto pb-1" role="tablist">
      <button
        v-for="w in weekdays"
        :key="w"
        type="button"
        role="tab"
        :aria-selected="active === w"
        class="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          active === w
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
        "
        :data-testid="`tt-tab-${w}`"
        @click="active = w"
      >
        {{ t(`journal.weekdayShort.${w}`) }}
        <span class="ml-0.5 text-xs opacity-75">{{ countOf(w) }}</span>
      </button>
    </div>
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-fg">{{ t(`journal.weekdayLong.${active}`) }}</h3>
      <DropdownMenu
        v-if="editable"
        :items="dayItems"
        :label="t('timetable.dayActions', { day: t(`journal.weekdayLong.${active}`) })"
        @select="(k) => emit('dayAction', active, k as 'copy' | 'clear')"
      />
    </div>
    <ul class="space-y-2">
      <li
        v-for="n in rows"
        :key="n"
        class="relative flex items-stretch gap-2 overflow-hidden rounded-xl border border-border bg-surface"
        :class="[
          sevOf(n) === 'error' ? 'bg-danger-soft/25' : '',
          sevOf(n) === 'warning' ? 'bg-warning-soft/30' : '',
        ]"
        :data-cell="cellKey(active, n)"
        :data-severity="sevOf(n) ?? undefined"
      >
        <span
          v-if="sevOf(n)"
          class="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          :class="sevOf(n) === 'error' ? 'bg-danger' : 'bg-warning'"
          aria-hidden="true"
          data-testid="cell-stripe"
        />
        <span
          class="flex w-9 shrink-0 items-center justify-center rounded-l-xl bg-surface-muted text-sm font-semibold text-fg-muted"
        >
          {{ n }}
        </span>
        <component
          :is="editable ? 'button' : 'div'"
          :type="editable ? 'button' : undefined"
          class="min-h-[3.5rem] min-w-0 flex-1 py-2 pr-2 text-left"
          :data-testid="`m-cell-${active}-${n}`"
          :aria-label="editable ? ariaOf(n) : undefined"
          @click="editable && emit('edit', active, n)"
        >
          <TimetableCellContent
            v-if="cells[cellKey(active, n)]"
            :cell="cells[cellKey(active, n)]"
            :issues="issuesMap[cellKey(active, n)]"
            :out-of-range="outSet.has(cellKey(active, n))"
          />
          <span v-else-if="editable" class="flex h-full items-center gap-1 text-sm text-fg-muted">
            <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('timetable.addLesson') }}
          </span>
        </component>
        <button
          v-if="editable && cells[cellKey(active, n)]"
          type="button"
          class="px-2 text-fg-muted hover:text-danger"
          :aria-label="t('timetable.clearCell')"
          @click="emit('clear', active, n)"
        >
          <X class="h-4 w-4" />
        </button>
      </li>
    </ul>
    <div v-if="editable" class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canAdd"
        data-testid="m-add-lesson"
        @click="addSlot"
      >
        <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('timetable.addLesson') }}
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canRemove"
        :title="canRemove ? undefined : t('timetable.removeLessonDisabled')"
        data-testid="m-remove-lesson"
        @click="removeSlot"
      >
        <Trash2 class="h-4 w-4" aria-hidden="true" /> {{ t('timetable.removeLesson') }}
      </button>
    </div>
  </div>
</template>
