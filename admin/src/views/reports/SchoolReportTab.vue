<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import type { TrendPoint } from '@/api/types'
import DistributionBars from '@/components/reports/DistributionBars.vue'
import ReportShell from '@/components/reports/ReportShell.vue'
import ReportTable, { type ReportColumn } from '@/components/reports/ReportTable.vue'
import StatCards from '@/components/reports/StatCards.vue'
import RankBadge from '@/components/ratings/RankBadge.vue'
import TrendChart from '@/components/scoring/TrendChart.vue'
import { useReport } from '@/composables/useReport'
import { formatRate, rateTone } from '@/utils/attendance'
import { formatScore, toneTextClass } from '@/utils/reports'

const props = defineProps<{ from: string; to: string }>()
const { t } = useI18n()

const report = useReport(
  () => ({ from: props.from, to: props.to }),
  (p) => reportsApi.school(p),
  (d) => d.totals.scoresCount === 0 && d.classes.length === 0,
)

type Row = NonNullable<typeof report.data.value>['classes'][number] & { id: string }
const rows = computed<Row[]>(() =>
  (report.data.value?.classes ?? []).map((c) => ({ ...c, id: c.classId })),
)

const columns = computed<ReportColumn<Row>[]>(() => [
  { key: 'rank', label: t('reports.cols.rank'), sortValue: (r) => r.rank },
  { key: 'className', label: t('reports.cols.class'), sortValue: (r) => r.className },
  {
    key: 'studentsCount',
    label: t('reports.cols.students'),
    sortValue: (r) => r.studentsCount,
    align: 'right',
    class: 'hidden md:table-cell',
  },
  {
    key: 'avgScore',
    label: t('reports.cols.avgScore'),
    sortValue: (r) => r.avgScore,
    align: 'right',
  },
  {
    key: 'ratingScore',
    label: t('reports.cols.ratingScore'),
    sortValue: (r) => r.ratingScore,
    align: 'right',
    class: 'hidden sm:table-cell',
  },
  {
    key: 'attendanceRate',
    label: t('reports.cols.attendanceRate'),
    sortValue: (r) => r.attendanceRate,
    align: 'right',
  },
  {
    key: 'scoresCount',
    label: t('reports.cols.scoresCount'),
    sortValue: (r) => r.scoresCount,
    align: 'right',
    class: 'hidden md:table-cell',
  },
])

const stats = computed(() => {
  const s = report.data.value?.totals
  if (!s) return []
  return [
    { key: 'students', label: t('reports.stats.students'), value: s.students },
    { key: 'classes', label: t('reports.stats.classes'), value: s.classes },
    { key: 'teachers', label: t('reports.stats.teachers'), value: s.teachers },
    { key: 'scores', label: t('reports.stats.scores'), value: s.scoresCount },
    { key: 'avgScore', label: t('reports.stats.avgScore'), value: formatScore(s.avgScore) },
    {
      key: 'attendance',
      label: t('reports.stats.attendance'),
      value: formatRate(s.attendanceRate),
      tone: rateTone(s.attendanceRate),
    },
    { key: 'penalty', label: t('reports.stats.penalty'), value: s.penaltyTotal },
  ]
})

const scoreTrend = computed<TrendPoint[]>(() =>
  (report.data.value?.dailyTrend ?? [])
    .filter((d) => d.avgScore !== null)
    .map((d) => ({ date: d.date, dayScore: d.avgScore as number })),
)
const attendanceTrend = computed<TrendPoint[]>(() =>
  (report.data.value?.dailyTrend ?? [])
    .filter((d) => d.attendanceRate !== null)
    .map((d) => ({ date: d.date, dayScore: d.attendanceRate as number })),
)
</script>

<template>
  <ReportShell
    :loading="report.loading.value"
    :error="report.error.value"
    :empty="report.empty.value"
    @retry="report.reload"
  >
    <template v-if="report.data.value">
      <StatCards :items="stats" />
      <div class="grid gap-4 lg:grid-cols-2">
        <section class="card p-4 sm:p-5" data-testid="score-trend">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('reports.dailyScore') }}</h2>
          <TrendChart :points="scoreTrend" />
        </section>
        <section class="card p-4 sm:p-5" data-testid="attendance-trend">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('reports.dailyAttendance') }}</h2>
          <TrendChart :points="attendanceTrend" :min="0" :max="100" tone="success" />
        </section>
      </div>
      <div class="card">
        <h2 class="p-4 pb-0 text-base font-semibold text-fg sm:px-5">
          {{ t('reports.classesTable') }}
        </h2>
        <ReportTable
          :columns="columns"
          :rows="rows"
          :caption="t('reports.classesTable')"
          :default-sort="{ key: 'rank', dir: 'asc' }"
        >
          <template #cell-rank="{ row }">
            <RankBadge v-if="row.rank" :rank="row.rank" />
            <span v-else class="text-fg-muted">-</span>
          </template>
          <template #cell-className="{ row }">
            <RouterLink
              :to="{ name: 'reports', query: { tab: 'class', classId: row.classId } }"
              class="font-medium text-fg hover:text-primary-700"
            >
              {{ row.className }}
            </RouterLink>
          </template>
          <template #cell-avgScore="{ row }">{{ formatScore(row.avgScore) }}</template>
          <template #cell-ratingScore="{ row }">{{ formatScore(row.ratingScore) }}</template>
          <template #cell-attendanceRate="{ row }">
            <span :class="toneTextClass[rateTone(row.attendanceRate)]">{{
              formatRate(row.attendanceRate)
            }}</span>
          </template>
        </ReportTable>
      </div>
      <section class="card p-4 sm:p-5">
        <h2 class="mb-3 text-base font-semibold text-fg">
          {{ t('reports.behaviorDistribution') }}
        </h2>
        <DistributionBars
          :items="
            report.data.value.behaviorDistribution.map((b) => ({
              key: b.behaviorTypeId ?? undefined,
              name: b.name,
              count: b.count,
              color: b.color,
            }))
          "
        />
      </section>
    </template>
  </ReportShell>
</template>
