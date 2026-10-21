<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import type { TeacherReportItem } from '@/api/types'
import ReportShell from '@/components/reports/ReportShell.vue'
import ReportTable, { type ReportColumn } from '@/components/reports/ReportTable.vue'
import StatCards from '@/components/reports/StatCards.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useReport } from '@/composables/useReport'
import { formatDateTime } from '@/utils/format'
import { coverageTone, formatScore } from '@/utils/reports'

const props = defineProps<{ from: string; to: string; classId: string }>()
const { t } = useI18n()

const report = useReport(
  () => ({ from: props.from, to: props.to, classId: props.classId || undefined }),
  (p) => reportsApi.teachers(p),
  (d) => d.teachers.length === 0,
)

type Row = TeacherReportItem & { id: string }
const rows = computed<Row[]>(() =>
  (report.data.value?.teachers ?? []).map((x) => ({ ...x, id: x.teacherId })),
)

const columns = computed<ReportColumn<Row>[]>(() => [
  { key: 'fullName', label: t('reports.cols.teacher'), sortValue: (r) => r.fullName },
  { key: 'classes', label: t('reports.cols.classes'), class: 'hidden md:table-cell' },
  {
    key: 'scoresCount',
    label: t('reports.cols.scoresCount'),
    sortValue: (r) => r.scoresCount,
    align: 'right',
  },
  {
    key: 'daysActive',
    label: t('reports.cols.daysActive'),
    sortValue: (r) => r.daysActive,
    align: 'right',
    class: 'hidden sm:table-cell',
  },
  {
    key: 'studentsScored',
    label: t('reports.cols.studentsScored'),
    sortValue: (r) => r.studentsScored,
    align: 'right',
    class: 'hidden lg:table-cell',
  },
  {
    key: 'attendanceUnits',
    label: t('reports.cols.attendanceUnits'),
    sortValue: (r) => r.attendanceUnits,
    align: 'right',
    class: 'hidden lg:table-cell',
  },
  {
    key: 'lastActivityAt',
    label: t('reports.cols.lastActivity'),
    sortValue: (r) => r.lastActivityAt,
    class: 'hidden md:table-cell',
  },
  { key: 'coverage', label: t('reports.cols.coverage'), sortValue: (r) => r.coverage.rate },
])

const stats = computed(() => {
  const list = report.data.value?.teachers ?? []
  const low = list.filter((x) => coverageTone(x.coverage.rate) !== 'success' && x.isActive).length
  return [
    { key: 'teachers', label: t('reports.stats.teachers'), value: list.length },
    {
      key: 'scores',
      label: t('reports.stats.scores'),
      value: list.reduce((n, x) => n + x.scoresCount, 0),
    },
    {
      key: 'low',
      label: t('reports.stats.lowCoverage'),
      value: low,
      tone: low > 0 ? ('warning' as const) : ('neutral' as const),
    },
  ]
})

const barClass = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-fg-muted',
}
const textClass = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-fg-muted',
}
</script>

<template>
  <ReportShell
    :loading="report.loading.value"
    :error="report.error.value"
    :empty="report.empty.value"
    @retry="report.reload"
  >
    <StatCards :items="stats" />
    <p class="text-xs text-fg-muted">{{ t('reports.coverageHint') }}</p>
    <div class="card">
      <ReportTable
        :columns="columns"
        :rows="rows"
        :caption="t('reports.tabs.teachers')"
        :default-sort="{ key: 'scoresCount', dir: 'desc' }"
      >
        <template #cell-fullName="{ row }">
          <div class="font-medium text-fg">{{ row.fullName }}</div>
          <div class="text-xs text-fg-muted">
            {{ row.username }}
            <BaseBadge v-if="!row.isActive" tone="neutral">{{ t('common.inactive') }}</BaseBadge>
          </div>
        </template>
        <template #cell-classes="{ row }">
          {{ row.classes.map((c) => c.name).join(', ') || '-' }}
        </template>
        <template #cell-lastActivityAt="{ row }">
          {{ row.lastActivityAt ? formatDateTime(row.lastActivityAt) : t('reports.noActivity') }}
        </template>
        <template #cell-coverage="{ row }">
          <div
            class="min-w-[7rem]"
            :data-tone="coverageTone(row.coverage.rate)"
            data-testid="coverage"
          >
            <div class="mb-1 text-xs" :class="textClass[coverageTone(row.coverage.rate)]">
              {{ row.coverage.rate === null ? '-' : `${formatScore(row.coverage.rate)}%` }}
              <span class="text-fg-muted"
                >({{ row.coverage.scoredClassDays }}/{{ row.coverage.expectedClassDays }})</span
              >
            </div>
            <div
              class="h-1.5 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              :aria-valuenow="Math.round(row.coverage.rate ?? 0)"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="t('reports.cols.coverage')"
            >
              <div
                class="h-full rounded-full"
                :class="barClass[coverageTone(row.coverage.rate)]"
                :style="{ width: `${Math.min(100, row.coverage.rate ?? 0)}%` }"
              />
            </div>
          </div>
        </template>
      </ReportTable>
    </div>
  </ReportShell>
</template>
