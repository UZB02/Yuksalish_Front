<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from 'lucide-vue-next'
import type { JournalGridData } from '@/api/journal.api'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import JournalCell from './JournalCell.vue'
import type { JournalColumn } from '@/api/journal.api'
import { dayOf, fmtAvg, groupByMonth, isLowAvg } from './journal.utils'

const props = defineProps<{ data: JournalGridData; today: string }>()

const { t } = useI18n()
const months = computed(() => groupByMonth(props.data.columns))

// Qat'iy balandliklar (sticky sarlavha qatorlari uchun top ofsetlari)
const H1 = 28
const H2 = 24
const head1 = { top: '0px', height: `${H1}px` }
const head2 = { top: `${H1}px`, height: `${H2}px` }
const head3 = { top: `${H1 + H2}px`, height: `${H2}px` }

const COL = 56
/** O'ng tomondagi yopishqoq yig'indi ustunlari: o'rtacha, soni, N, B */
const sumCols = ['avg', 'count', 'N', 'B'] as const
const rightOf = (i: number) => ({
  right: `${(sumCols.length - 1 - i) * COL}px`,
  width: `${COL}px`,
  minWidth: `${COL}px`,
})

/** Sarlavhaning 3-qatori: dars ustuni uchun "3-d", ish kuni ustuni uchun hafta kuni */
const subLabel = (c: JournalColumn) =>
  c.lessonNo > 0
    ? t('journal.lessonShort', { n: c.lessonNo })
    : t(`journal.weekdayShort.${c.weekday}`)
const headTone = (c: JournalColumn, strong: boolean) => {
  if (c.cancelled) return 'bg-surface-muted text-fg-muted opacity-60 line-through'
  if (c.date === props.today) return 'bg-primary-100 text-primary-700'
  return strong ? 'bg-surface-muted text-fg' : 'bg-surface-muted text-fg-muted'
}
const headTitle = (c: JournalColumn) =>
  c.cancelled
    ? t('journal.cancelledLesson')
    : c.source === 'record'
      ? t('journal.recordColumn')
      : undefined

const stickyName = 'sticky left-0 z-20 bg-surface'
</script>

<template>
  <div
    class="max-h-[calc(100vh-13rem)] min-h-[16rem] overflow-auto rounded-xl border border-border bg-surface shadow-card"
    data-testid="journal-grid"
  >
    <table class="border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th
            rowspan="3"
            class="sticky left-0 top-0 z-30 min-w-[230px] border-b border-r border-border bg-surface-muted px-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted"
          >
            {{ t('journal.grid.student') }}
          </th>
          <th
            v-for="m in months"
            :key="m.key"
            :colspan="m.dates.length"
            class="sticky z-10 border-b border-r border-border bg-surface-muted px-2 text-center text-xs font-semibold text-fg"
            :style="head1"
            data-testid="month-head"
          >
            {{ t(`journal.months.${m.month}`) }}
          </th>
          <th
            v-for="(c, i) in sumCols"
            :key="c"
            rowspan="3"
            class="sticky top-0 z-30 border-b border-l border-border bg-surface-muted px-1 text-center text-[11px] font-semibold uppercase leading-tight tracking-wide text-fg-muted"
            :style="rightOf(i)"
            :data-testid="`sum-head-${c}`"
          >
            {{ t(`journal.summary.${c}`) }}
          </th>
        </tr>
        <tr>
          <th
            v-for="d in data.columns"
            :key="d.key"
            class="sticky z-10 min-w-9 border-b border-r border-border px-0 text-center text-xs font-semibold"
            :class="headTone(d, true)"
            :style="head2"
            :title="headTitle(d)"
            :data-date="d.date"
            :data-column="d.key"
            :data-cancelled="d.cancelled ? 'true' : undefined"
            :data-today="d.date === today ? 'true' : undefined"
          >
            {{ dayOf(d.date) }}
          </th>
        </tr>
        <tr>
          <th
            v-for="d in data.columns"
            :key="d.key"
            class="sticky z-10 border-b border-r border-border px-0 text-center text-[10px] font-medium"
            :class="[headTone(d, false), d.lessonNo > 0 ? '' : 'uppercase']"
            :style="head3"
            :title="headTitle(d)"
            data-testid="sub-head"
          >
            {{ subLabel(d) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(s, idx) in data.students" :key="s.id" :data-student="s.id" class="group">
          <td class="min-w-[230px] border-b border-r border-border px-3 py-1" :class="stickyName">
            <div class="flex items-center gap-2" :class="s.transferred ? 'opacity-60' : ''">
              <span class="w-5 shrink-0 text-right text-xs tabular-nums text-fg-muted">{{
                idx + 1
              }}</span>
              <AvatarImage :name="s.fullName" :src="s.photo" size="sm" alt="" />
              <span class="min-w-0">
                <span
                  class="block max-w-[150px] truncate font-medium text-fg"
                  :title="s.fullName"
                  >{{ s.fullName }}</span
                >
                <span
                  v-if="s.transferred"
                  class="block text-[10px] text-fg-muted"
                  data-testid="transferred"
                >
                  {{ t('journal.grid.transferred') }}
                </span>
              </span>
            </div>
          </td>
          <JournalCell
            v-for="d in data.columns"
            :key="d.key"
            :cell="data.cells[s.id]?.[d.key]"
            :date="d.date"
            :lesson-no="d.lessonNo"
            :cancelled="d.cancelled"
            :student-name="s.fullName"
            :today="d.date === today"
          />
          <td
            class="sticky z-10 border-b border-l border-border bg-surface text-center font-semibold tabular-nums"
            :class="isLowAvg(data.summary.perStudent[s.id].avg) ? 'text-danger' : 'text-fg'"
            :style="rightOf(0)"
            data-testid="sum-avg"
          >
            <span class="inline-flex items-center justify-center gap-1">
              <TriangleAlert
                v-if="isLowAvg(data.summary.perStudent[s.id].avg)"
                class="h-3.5 w-3.5"
                :aria-label="t('journal.summary.lowAvg')"
                data-testid="low-avg-icon"
              />
              {{ fmtAvg(data.summary.perStudent[s.id].avg) }}
            </span>
          </td>
          <td
            class="sticky z-10 border-b border-l border-border bg-surface text-center tabular-nums"
            :style="rightOf(1)"
            data-testid="sum-count"
          >
            {{ data.summary.perStudent[s.id].count }}
          </td>
          <td
            class="sticky z-10 border-b border-l border-border bg-surface text-center tabular-nums text-danger/80"
            :style="rightOf(2)"
            data-testid="sum-n"
          >
            {{ data.summary.perStudent[s.id].absentN }}
          </td>
          <td
            class="sticky z-10 border-b border-l border-border bg-surface text-center tabular-nums text-fg-muted"
            :style="rightOf(3)"
            data-testid="sum-b"
          >
            {{ data.summary.perStudent[s.id].absentB }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="bg-surface-muted" data-testid="foot-avg">
          <th
            class="sticky left-0 z-20 border-b border-r border-border bg-surface-muted px-3 py-1 text-left text-xs font-semibold text-fg"
          >
            {{ t('journal.grid.classAvg') }}
          </th>
          <td
            v-for="d in data.columns"
            :key="d.key"
            class="h-7 border-b border-r border-border text-center text-[11px] tabular-nums text-fg-muted"
          >
            {{
              data.summary.perColumn[d.key]?.avg === null
                ? ''
                : fmtAvg(data.summary.perColumn[d.key]?.avg)
            }}
          </td>
          <td
            class="sticky z-10 border-b border-l border-border bg-surface-muted text-center text-sm font-bold tabular-nums"
            :style="rightOf(0)"
            data-testid="class-avg"
          >
            {{ fmtAvg(data.summary.classAvg, 2) }}
          </td>
          <td
            class="sticky z-10 border-b border-l border-border bg-surface-muted"
            :style="rightOf(1)"
          />
          <td
            class="sticky z-10 border-b border-l border-border bg-surface-muted"
            :style="rightOf(2)"
          />
          <td
            class="sticky z-10 border-b border-l border-border bg-surface-muted"
            :style="rightOf(3)"
          />
        </tr>
        <tr class="bg-surface-muted" data-testid="foot-count">
          <th
            class="sticky left-0 z-20 border-r border-border bg-surface-muted px-3 py-1 text-left text-xs font-semibold text-fg"
          >
            {{ t('journal.grid.gradeCount') }}
          </th>
          <td
            v-for="d in data.columns"
            :key="d.key"
            class="h-7 border-r border-border text-center text-[11px] tabular-nums text-fg-muted"
          >
            {{ data.summary.perColumn[d.key]?.count || '' }}
          </td>
          <td
            class="sticky z-10 border-l border-border bg-surface-muted text-center text-sm font-bold tabular-nums"
            :style="rightOf(0)"
            data-testid="class-count"
          >
            {{ data.summary.classCount }}
          </td>
          <td class="sticky z-10 border-l border-border bg-surface-muted" :style="rightOf(1)" />
          <td class="sticky z-10 border-l border-border bg-surface-muted" :style="rightOf(2)" />
          <td class="sticky z-10 border-l border-border bg-surface-muted" :style="rightOf(3)" />
        </tr>
      </tfoot>
    </table>
  </div>
</template>
