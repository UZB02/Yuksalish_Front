<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TimetableWarning } from '@/api/timetable.api'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import { cellKey, type CellMap } from '@/utils/timetable'
import TimetableCellContent from './TimetableCellContent.vue'

/** Mobil ko'rinish: hafta kunlari tablari + tanlangan kunning darslari ro'yxati */
const props = defineProps<{
  weekdays: number[]
  lessons: number
  cells: CellMap
  warningsMap: Record<string, TimetableWarning[]>
  outOfRangeKeys: string[]
  editable: boolean
  /** Boshlang'ich kun (bugungi hafta kuni, bo'lsa) */
  initialWeekday?: number
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
const rows = computed(() => Array.from({ length: props.lessons }, (_, i) => i + 1))
const outSet = computed(() => new Set(props.outOfRangeKeys))
const dayItems = computed<DropdownItem[]>(() => [
  { key: 'copy', label: t('timetable.copyDay') },
  { key: 'clear', label: t('timetable.clearDay'), danger: true },
])
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
        class="flex items-stretch gap-2 rounded-xl border border-border bg-surface"
      >
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
          @click="editable && emit('edit', active, n)"
        >
          <TimetableCellContent
            v-if="cells[cellKey(active, n)]"
            :cell="cells[cellKey(active, n)]"
            :warnings="warningsMap[cellKey(active, n)]"
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
  </div>
</template>
