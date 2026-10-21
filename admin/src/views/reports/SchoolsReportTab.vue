<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import type { SchoolsReportItem } from '@/api/types'
import ReportShell from '@/components/reports/ReportShell.vue'
import ReportTable, { type ReportColumn } from '@/components/reports/ReportTable.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useReport } from '@/composables/useReport'
import { formatRate, rateTone } from '@/utils/attendance'
import { formatScore, toneTextClass } from '@/utils/reports'

const props = defineProps<{ from: string; to: string }>()
const { t } = useI18n()

const report = useReport(
  () => ({ from: props.from, to: props.to }),
  (p) => reportsApi.schools(p),
  (d) => d.schools.length === 0,
)

type Row = SchoolsReportItem & { id: string }
const rows = computed<Row[]>(() =>
  (report.data.value?.schools ?? []).map((s) => ({ ...s, id: s.schoolId })),
)
const columns = computed<ReportColumn<Row>[]>(() => [
  { key: 'name', label: t('reports.cols.school'), sortValue: (r) => r.name },
  {
    key: 'students',
    label: t('reports.cols.students'),
    sortValue: (r) => r.students,
    align: 'right',
    class: 'hidden md:table-cell',
  },
  {
    key: 'classes',
    label: t('reports.cols.classes'),
    sortValue: (r) => r.classes,
    align: 'right',
    class: 'hidden lg:table-cell',
  },
  {
    key: 'activeTeachers',
    label: t('reports.cols.activeTeachers'),
    sortValue: (r) => r.activeTeachers,
    align: 'right',
  },
  {
    key: 'scoresCount',
    label: t('reports.cols.scoresCount'),
    sortValue: (r) => r.scoresCount,
    align: 'right',
    class: 'hidden sm:table-cell',
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
    class: 'hidden md:table-cell',
  },
  {
    key: 'attendanceRate',
    label: t('reports.cols.attendanceRate'),
    sortValue: (r) => r.attendanceRate,
    align: 'right',
  },
])
</script>

<template>
  <ReportShell
    :loading="report.loading.value"
    :error="report.error.value"
    :empty="report.empty.value"
    @retry="report.reload"
  >
    <div class="card">
      <ReportTable
        :columns="columns"
        :rows="rows"
        :caption="t('reports.tabs.schools')"
        :default-sort="{ key: 'avgScore', dir: 'desc' }"
      >
        <template #cell-name="{ row }">
          <div class="font-medium text-fg">{{ row.name }}</div>
          <BaseBadge v-if="!row.enabled" tone="neutral">{{ t('common.inactive') }}</BaseBadge>
        </template>
        <template #cell-activeTeachers="{ row }"
          >{{ row.activeTeachers }} / {{ row.teachers }}</template
        >
        <template #cell-avgScore="{ row }">{{ formatScore(row.avgScore) }}</template>
        <template #cell-ratingScore="{ row }">{{ formatScore(row.ratingScore) }}</template>
        <template #cell-attendanceRate="{ row }">
          <span :class="toneTextClass[rateTone(row.attendanceRate)]">{{
            formatRate(row.attendanceRate)
          }}</span>
        </template>
      </ReportTable>
    </div>
  </ReportShell>
</template>
