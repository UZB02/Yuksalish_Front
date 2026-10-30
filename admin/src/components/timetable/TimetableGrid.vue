<script setup lang="ts">
import { computed } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TimetableWarning } from '@/api/timetable.api'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import { cellKey, type CellMap } from '@/utils/timetable'
import TimetableCellContent from './TimetableCellContent.vue'

/** Hafta kuni x dars raqami to'ri (kompyuter ko'rinishi) */
const props = defineProps<{
  weekdays: number[]
  lessons: number
  cells: CellMap
  warningsMap: Record<string, TimetableWarning[]>
  outOfRangeKeys: string[]
  /** Sozlamadagi ish kunlari: undan tashqari ustunlar qizil */
  workingWeekdays: number[]
  lessonsPerDay: number
  editable: boolean
}>()
const emit = defineEmits<{
  edit: [weekday: number, lessonNo: number]
  clear: [weekday: number, lessonNo: number]
  dayAction: [weekday: number, action: 'copy' | 'clear']
}>()
const { t } = useI18n()

const rows = computed(() => Array.from({ length: props.lessons }, (_, i) => i + 1))
const outSet = computed(() => new Set(props.outOfRangeKeys))
const dayItems = computed<DropdownItem[]>(() => [
  { key: 'copy', label: t('timetable.copyDay') },
  { key: 'clear', label: t('timetable.clearDay'), danger: true },
])
const badDay = (w: number) => !props.workingWeekdays.includes(w)
const badRow = (n: number) => n > props.lessonsPerDay
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
        <tr v-for="n in rows" :key="n" :class="badRow(n) ? 'bg-danger-soft/40' : ''">
          <th
            class="border-t border-border px-2 py-2 text-center text-xs font-semibold"
            :class="badRow(n) ? 'text-danger' : 'text-fg-muted'"
          >
            {{ n }}
          </th>
          <td
            v-for="w in weekdays"
            :key="w"
            class="group relative h-[4.5rem] border-l border-t border-border p-0 align-top"
            :class="[
              badDay(w) ? 'bg-danger-soft/40' : '',
              warningsMap[cellKey(w, n)]?.some((x) => x.severity === 'error')
                ? 'bg-danger-soft/60'
                : '',
            ]"
          >
            <button
              v-if="editable"
              type="button"
              class="block h-full w-full px-2 py-1.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600"
              :data-testid="`cell-${w}-${n}`"
              :aria-label="`${t(`journal.weekdayLong.${w}`)}, ${n}`"
              @click="emit('edit', w, n)"
            >
              <TimetableCellContent
                v-if="cells[cellKey(w, n)]"
                :cell="cells[cellKey(w, n)]"
                :warnings="warningsMap[cellKey(w, n)]"
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
                :warnings="warningsMap[cellKey(w, n)]"
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
  </div>
</template>
