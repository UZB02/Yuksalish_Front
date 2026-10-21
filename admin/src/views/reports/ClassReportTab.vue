<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import type { ClassReportStudent } from '@/api/types'
import DistributionBars from '@/components/reports/DistributionBars.vue'
import ReportShell from '@/components/reports/ReportShell.vue'
import ReportTable, { type ReportColumn } from '@/components/reports/ReportTable.vue'
import StatCards from '@/components/reports/StatCards.vue'
import RankBadge from '@/components/ratings/RankBadge.vue'
import { useReport } from '@/composables/useReport'
import { formatRate, rateTone } from '@/utils/attendance'
import { formatScore, toneTextClass } from '@/utils/reports'

const props = defineProps<{ from: string; to: string; classId: string }>()
const { t } = useI18n()

const report = useReport(
  () => (props.classId ? { classId: props.classId, from: props.from, to: props.to } : null),
  (p) => reportsApi.class(p),
  (d) => d.students.length === 0,
)

type Row = ClassReportStudent & { id: string }
const rows = computed<Row[]>(() =>
  (report.data.value?.students ?? []).map((s) => ({ ...s, id: s.studentId })),
)

const columns = computed<ReportColumn<Row>[]>(() => [
  { key: 'classRank', label: t('reports.cols.classRank'), sortValue: (r) => r.classRank },
  {
    key: 'rank',
    label: t('reports.cols.schoolRank'),
    sortValue: (r) => r.rank,
    class: 'hidden sm:table-cell',
  },
  { key: 'fullName', label: t('common.fullName'), sortValue: (r) => r.fullName },
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
    key: 'daysCount',
    label: t('reports.cols.days'),
    sortValue: (r) => r.daysCount,
    align: 'right',
    class: 'hidden md:table-cell',
  },
  {
    key: 'attendance',
    label: t('reports.cols.attendanceRate'),
    sortValue: (r) => r.attendance.rate,
    align: 'right',
  },
  {
    key: 'penalty',
    label: t('reports.cols.penalty'),
    sortValue: (r) => r.penalty,
    align: 'right',
    class: 'hidden md:table-cell',
  },
  { key: 'topBehavior', label: t('reports.cols.topBehavior'), class: 'hidden lg:table-cell' },
])

const stats = computed(() => {
  const s = report.data.value?.summary
  if (!s) return []
  return [
    {
      key: 'students',
      label: t('reports.stats.students'),
      value: s.students,
      hint: t('reports.stats.rated', { n: s.ratedStudents }),
    },
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
</script>

<template>
  <ReportShell
    :loading="report.loading.value"
    :error="report.error.value"
    :empty="report.empty.value"
    :idle="report.idle.value"
    :idle-text="t('reports.pickClass')"
    @retry="report.reload"
  >
    <template v-if="report.data.value">
      <p class="text-sm text-fg-muted" data-testid="class-meta">
        <span class="font-medium text-fg">{{ report.data.value.class.name }}</span>
        <template v-if="report.data.value.class.homeroomTeacher">
          - {{ t('reports.homeroom') }}: {{ report.data.value.class.homeroomTeacher.fullName }}
        </template>
      </p>
      <StatCards :items="stats" />
      <div class="card">
        <ReportTable
          :columns="columns"
          :rows="rows"
          :caption="t('reports.tabs.class')"
          :default-sort="{ key: 'classRank', dir: 'asc' }"
        >
          <template #cell-classRank="{ row }">
            <RankBadge v-if="row.classRank" :rank="row.classRank" />
            <span v-else class="text-fg-muted">—</span>
          </template>
          <template #cell-rank="{ row }">
            <span v-if="row.rank">{{ row.rank }}</span>
            <span v-else class="text-fg-muted">—</span>
          </template>
          <template #cell-fullName="{ row }">
            <RouterLink
              :to="{ name: 'student-profile', params: { id: row.studentId } }"
              class="font-medium text-fg hover:text-primary-700"
            >
              {{ row.fullName }}
            </RouterLink>
          </template>
          <template #cell-avgScore="{ row }">{{ formatScore(row.avgScore) }}</template>
          <template #cell-ratingScore="{ row }">{{ formatScore(row.ratingScore) }}</template>
          <template #cell-attendance="{ row }">
            <span :class="toneTextClass[rateTone(row.attendance.rate)]">{{
              formatRate(row.attendance.rate)
            }}</span>
          </template>
          <template #cell-penalty="{ row }">
            <span v-if="row.penalty > 0" class="text-danger">-{{ row.penalty }}</span>
            <span v-else class="text-fg-muted">0</span>
          </template>
          <template #cell-topBehavior="{ row }">
            <span v-if="row.topBehavior"
              >{{ row.topBehavior.name }}
              <span class="text-fg-muted">x{{ row.topBehavior.count }}</span></span
            >
            <span v-else class="text-fg-muted">-</span>
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
