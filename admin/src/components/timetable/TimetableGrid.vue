<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import { cellKey, severityOf, type CellMap } from '@/utils/timetable'
import { cellIssueSummary, type TimetableIssue } from '@/utils/timetableIssues'
import TimetableCellContent from './TimetableCellContent.vue'

/** Hafta kuni x dars raqami to'ri (kompyuter ko'rinishi) */
const props = defineProps<{
  weekdays: number[]
  lessons: number
  cells: CellMap
  issuesMap: Record<string, TimetableIssue[]>
  outOfRangeKeys: string[]
  /** Sozlamadagi ish kunlari: undan tashqari ustunlar qizil */
  workingWeekdays: number[]
  editable: boolean
  canAddLesson?: boolean
  canRemoveLesson?: boolean
}>()
const emit = defineEmits<{
  edit: [weekday: number, lessonNo: number]
  clear: [weekday: number, lessonNo: number]
  dayAction: [weekday: number, action: 'copy' | 'clear']
  addLesson: []
  removeLesson: []
}>()
const { t } = useI18n()

const rows = computed(() => Array.from({ length: props.lessons }, (_, i) => i + 1))
const outSet = computed(() => new Set(props.outOfRangeKeys))
const dayItems = computed<DropdownItem[]>(() => [
  { key: 'copy', label: t('timetable.copyDay') },
  { key: 'clear', label: t('timetable.clearDay'), danger: true },
])
const badDay = (w: number) => !props.workingWeekdays.includes(w)
const sevOf = (w: number, n: number) => severityOf(props.issuesMap[cellKey(w, n)])
const ariaOf = (w: number, n: number) =>
  [`${t(`journal.weekdayLong.${w}`)}, ${n}`, cellIssueSummary(props.issuesMap[cellKey(w, n)], t)]
    .filter(Boolean)
    .join(', ')
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-border bg-surface">
    <table class="w-full min-w-[720px] table-fixed border-collapse text-sm" data-testid="tt-grid">
      <thead>
        <tr class="bg-surface-muted">
          <th class="w-12 border-b border-border px-2 py-2 text-center text-xs text-fg-muted">#</th>
          <th
            v-for="w in weekdays"
            :key="w"
            class="border-b border-l border-border px-2 py-2 text-left text-xs font-semibold"
            :class="badDay(w) ? 'text-danger' : 'text-fg'"
            :data-testid="`tt-day-${w}`"
          >
            <div class="flex items-center justify-between gap-1">
              <span>{{ t(`journal.weekdayLong.${w}`) }}</span>
              <DropdownMenu
                v-if="editable"
                :items="dayItems"
                :label="t('timetable.dayActions', { day: t(`journal.weekdayLong.${w}`) })"
                @select="(k) => emit('dayAction', w, k as 'copy' | 'clear')"
              />
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="n in rows" :key="n">
          <th
            class="border-t border-border px-2 py-2 text-center text-xs font-semibold text-fg-muted"
          >
            {{ n }}
            <button
              v-if="editable && n === rows.length && rows.length > 1"
              type="button"
              class="mx-auto mt-1 block rounded p-0.5 text-fg-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!canRemoveLesson"
              :title="
                canRemoveLesson ? t('timetable.removeLesson') : t('timetable.removeLessonDisabled')
              "
              :aria-label="t('timetable.removeLesson')"
              data-testid="remove-lesson"
              @click="emit('removeLesson')"
            >
              <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </th>
          <td
            v-for="w in weekdays"
            :key="w"
            class="group relative h-[4.5rem] border-l border-t border-border p-0 align-top"
            :class="[
              badDay(w) ? 'bg-danger-soft/40' : '',
              sevOf(w, n) === 'error' ? 'bg-danger-soft/25' : '',
              sevOf(w, n) === 'warning' ? 'bg-warning-soft/30' : '',
            ]"
            :data-cell="cellKey(w, n)"
            :data-severity="sevOf(w, n) ?? undefined"
          >
            <span
              v-if="sevOf(w, n)"
              class="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
              :class="sevOf(w, n) === 'error' ? 'bg-danger' : 'bg-warning'"
              aria-hidden="true"
              data-testid="cell-stripe"
            />
            <button
              v-if="editable"
              type="button"
              class="block h-full w-full px-2 py-1.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600"
              :data-testid="`cell-${w}-${n}`"
              :aria-label="ariaOf(w, n)"
              @click="emit('edit', w, n)"
            >
              <TimetableCellContent
                v-if="cells[cellKey(w, n)]"
                :cell="cells[cellKey(w, n)]"
                :issues="issuesMap[cellKey(w, n)]"
                :out-of-range="outSet.has(cellKey(w, n))"
              />
              <span
                v-else
                class="flex h-full items-center justify-center text-fg-muted/50 group-hover:text-primary-600"
              >
                <Plus class="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
            <div v-else class="h-full px-2 py-1.5" :data-testid="`cell-${w}-${n}`">
              <TimetableCellContent
                v-if="cells[cellKey(w, n)]"
                :cell="cells[cellKey(w, n)]"
                :issues="issuesMap[cellKey(w, n)]"
                :out-of-range="outSet.has(cellKey(w, n))"
              />
            </div>
            <button
              v-if="editable && cells[cellKey(w, n)]"
              type="button"
              class="absolute right-0.5 top-0.5 hidden rounded p-0.5 text-fg-muted hover:bg-surface hover:text-danger group-hover:block group-focus-within:block"
              :aria-label="t('timetable.clearCell')"
              :data-testid="`clear-${w}-${n}`"
              @click.stop="emit('clear', w, n)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="editable" class="border-t border-border p-2">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canAddLesson"
        :title="canAddLesson ? undefined : t('timetable.maxLessonsReached', { n: 12 })"
        data-testid="add-lesson"
        @click="emit('addLesson')"
      >
        <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('timetable.addLesson') }}
      </button>
    </div>
  </div>
</template>
