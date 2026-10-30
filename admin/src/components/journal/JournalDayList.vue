<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-vue-next'
import type { JournalColumn, JournalGridData } from '@/api/journal.api'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import { ABSENCE_CLASS, GRADE_CLASS, fmtAvg, fmtDate, isLowAvg } from './journal.utils'

/** Mobil ko'rinish: bitta kun bo'yicha o'quvchilar ro'yxati + har bir o'quvchi xulosasi */
const props = defineProps<{ data: JournalGridData; today: string }>()
const { t } = useI18n()

const index = ref(0)

/** Kunlar (har kunda bir yoki bir nechta dars ustuni) */
const days = computed(() => {
  const out: { date: string; weekday: number; columns: JournalColumn[] }[] = []
  for (const c of props.data.columns) {
    const last = out[out.length - 1]
    if (last && last.date === c.date) last.columns.push(c)
    else out.push({ date: c.date, weekday: c.weekday, columns: [c] })
  }
  return out
})

/** Boshlang'ich kun: bugun (yoki undan oldingi eng yaqin ish kuni), bo'lmasa oxirgisi */
function initialIndex(): number {
  const ds = days.value
  if (!ds.length) return 0
  let best = -1
  ds.forEach((d, i) => {
    if (d.date <= props.today) best = i
  })
  return best === -1 ? 0 : best
}
watch(
  () => props.data,
  () => (index.value = initialIndex()),
  { immediate: true },
)

const day = computed(() => days.value[index.value])
const canPrev = computed(() => index.value > 0)
const canNext = computed(() => index.value < days.value.length - 1)
const go = (n: number) => {
  const next = index.value + n
  if (next >= 0 && next < days.value.length) index.value = next
}
const cellOf = (studentId: string, key: string) => props.data.cells[studentId]?.[key]
/** Bir kunda bir nechta dars bo'lsa har bir chip oldida dars belgisi chiqadi */
const showLesson = (c: JournalColumn) => c.lessonNo > 0
</script>

<template>
  <div class="space-y-3" data-testid="journal-daylist">
    <p class="rounded-lg bg-surface-muted px-3 py-2 text-xs text-fg-muted">
      {{ t('journal.mobile.note') }}
    </p>
    <div
      v-if="day"
      class="flex items-center justify-between rounded-xl border border-border bg-surface p-2"
    >
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted disabled:opacity-40"
        :disabled="!canPrev"
        :aria-label="t('journal.mobile.prev')"
        data-testid="day-prev"
        @click="go(-1)"
      >
        <ChevronLeft class="h-5 w-5" />
      </button>
      <div class="text-center">
        <div class="text-sm font-semibold text-fg" data-testid="day-label">
          {{ fmtDate(day.date) }}
        </div>
        <div class="text-xs text-fg-muted">{{ t(`journal.weekdayLong.${day.weekday}`) }}</div>
      </div>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted disabled:opacity-40"
        :disabled="!canNext"
        :aria-label="t('journal.mobile.next')"
        data-testid="day-next"
        @click="go(1)"
      >
        <ChevronRight class="h-5 w-5" />
      </button>
    </div>
    <p v-else class="text-sm text-fg-muted">{{ t('journal.empty.noDays') }}</p>

    <ul v-if="day" class="divide-y divide-border rounded-xl border border-border bg-surface">
      <li
        v-for="s in data.students"
        :key="s.id"
        class="flex items-center gap-3 px-3 py-2.5"
        :data-student="s.id"
      >
        <AvatarImage :name="s.fullName" :src="s.photo" size="sm" alt="" />
        <div class="min-w-0 flex-1">
          <div
            class="truncate text-sm font-medium text-fg"
            :class="s.transferred ? 'opacity-60' : ''"
          >
            {{ s.fullName }}
          </div>
          <div
            class="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-fg-muted"
            data-testid="student-summary"
          >
            <span
              class="inline-flex items-center gap-1"
              :class="isLowAvg(data.summary.perStudent[s.id].avg) ? 'text-danger' : ''"
            >
              <TriangleAlert v-if="isLowAvg(data.summary.perStudent[s.id].avg)" class="h-3 w-3" />
              {{ t('journal.summary.avg') }}: {{ fmtAvg(data.summary.perStudent[s.id].avg) }}
            </span>
            <span>{{ t('journal.summary.count') }}: {{ data.summary.perStudent[s.id].count }}</span>
            <span>N: {{ data.summary.perStudent[s.id].absentN }}</span>
            <span>B: {{ data.summary.perStudent[s.id].absentB }}</span>
          </div>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1" data-testid="day-chips">
          <div
            v-for="col in day.columns"
            :key="col.key"
            class="flex items-center gap-1.5"
            :class="col.cancelled ? 'opacity-50' : ''"
            :data-column="col.key"
          >
            <span
              v-if="showLesson(col)"
              class="text-[11px] font-medium text-fg-muted"
              data-testid="lesson-tag"
              :title="col.cancelled ? t('journal.cancelledLesson') : undefined"
              >{{ t('journal.lessonShort', { n: col.lessonNo }) }}</span
            >
            <span
              v-if="cellOf(s.id, col.key)?.grade !== undefined"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold"
              :class="GRADE_CLASS[cellOf(s.id, col.key)!.grade as number]"
              data-testid="chip-grade"
              >{{ cellOf(s.id, col.key)!.grade }}</span
            >
            <span
              v-if="
                cellOf(s.id, col.key)?.absence === 'N' || cellOf(s.id, col.key)?.absence === 'B'
              "
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm font-semibold"
              :class="ABSENCE_CLASS[cellOf(s.id, col.key)!.absence as 'N' | 'B']"
              data-testid="chip-absence"
              >{{ cellOf(s.id, col.key)!.absence }}</span
            >
            <span
              v-if="cellOf(s.id, col.key)?.absence === 'partial'"
              class="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-fg-muted"
              data-testid="chip-partial"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-fg-muted" />{{
                t('journal.absence.partial')
              }}
            </span>
            <span v-if="!cellOf(s.id, col.key)" class="text-sm text-fg-muted">—</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
