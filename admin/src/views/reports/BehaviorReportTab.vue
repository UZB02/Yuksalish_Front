<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import DistributionBars from '@/components/reports/DistributionBars.vue'
import ReportShell from '@/components/reports/ReportShell.vue'
import ReportTable, { type ReportColumn } from '@/components/reports/ReportTable.vue'
import { useReport } from '@/composables/useReport'

const props = defineProps<{ from: string; to: string; classId: string }>()
const { t } = useI18n()

const report = useReport(
  () => ({ from: props.from, to: props.to, classId: props.classId || undefined }),
  (p) => reportsApi.behavior(p),
  (d) => d.byType.length === 0 && d.byClass.length === 0,
)

type Row = NonNullable<typeof report.data.value>['byClass'][number] & { id: string }
const rows = computed<Row[]>(() =>
  (report.data.value?.byClass ?? []).map((c) => ({ ...c, id: c.classId })),
)
const columns = computed<ReportColumn<Row>[]>(() => [
  { key: 'className', label: t('reports.cols.class'), sortValue: (r) => r.className },
  {
    key: 'positive',
    label: t('reports.kinds.positive'),
    sortValue: (r) => r.positive,
    align: 'right',
  },
  {
    key: 'negative',
    label: t('reports.kinds.negative'),
    sortValue: (r) => r.negative,
    align: 'right',
  },
  {
    key: 'neutral',
    label: t('reports.kinds.neutral'),
    sortValue: (r) => r.neutral,
    align: 'right',
    class: 'hidden sm:table-cell',
  },
  { key: 'total', label: t('reports.cols.total'), sortValue: (r) => r.total, align: 'right' },
])

const kinds = computed(() => {
  const k = report.data.value?.byKind
  if (!k) return []
  const total = k.positive + k.negative + k.neutral
  return (['positive', 'negative', 'neutral'] as const).map((key) => ({
    key,
    count: k[key],
    pct: total ? Math.round((k[key] / total) * 100) : 0,
    width: total ? (k[key] / total) * 100 : 0,
    bar: { positive: 'bg-success', negative: 'bg-danger', neutral: 'bg-fg-muted' }[key],
  }))
})
</script>

<template>
  <ReportShell
    :loading="report.loading.value"
    :error="report.error.value"
    :empty="report.empty.value"
    @retry="report.reload"
  >
    <template v-if="report.data.value">
      <section class="card p-4 sm:p-5" data-testid="kind-ratio">
        <h2 class="mb-3 text-base font-semibold text-fg">{{ t('reports.kindRatio') }}</h2>
        <div
          class="flex h-3 overflow-hidden rounded-full bg-surface-muted"
          role="img"
          :aria-label="t('reports.kindRatio')"
        >
          <div v-for="k in kinds" :key="k.key" :class="k.bar" :style="{ width: `${k.width}%` }" />
        </div>
        <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <li v-for="k in kinds" :key="k.key" class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :class="k.bar" />
            <span class="text-fg-muted">{{ t(`reports.kinds.${k.key}`) }}</span>
            <span class="font-medium text-fg">{{ k.count }} ({{ k.pct }}%)</span>
          </li>
        </ul>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="card p-4 sm:p-5">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('reports.byType') }}</h2>
          <DistributionBars
            :items="
              report.data.value.byType.map((b) => ({
                key: b.behaviorTypeId ?? undefined,
                name: b.name,
                count: b.count,
                color: b.color,
              }))
            "
          />
        </section>
        <section class="card">
          <h2 class="p-4 pb-0 text-base font-semibold text-fg sm:px-5">
            {{ t('reports.byClass') }}
          </h2>
          <ReportTable
            :columns="columns"
            :rows="rows"
            :caption="t('reports.byClass')"
            :default-sort="{ key: 'total', dir: 'desc' }"
          />
        </section>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <section
          v-for="side in ['positive', 'negative'] as const"
          :key="side"
          class="card p-4 sm:p-5"
          :data-testid="`top-${side}`"
        >
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t(`reports.top.${side}`) }}</h2>
          <p
            v-if="report.data.value.topStudents[side].length === 0"
            class="py-4 text-center text-sm text-fg-muted"
          >
            {{ t('reports.noTop') }}
          </p>
          <ol v-else class="space-y-2 text-sm">
            <li
              v-for="(s, i) in report.data.value.topStudents[side].slice(0, 10)"
              :key="s.studentId"
              class="flex items-center gap-3"
            >
              <span class="w-5 text-right text-fg-muted">{{ i + 1 }}</span>
              <RouterLink
                :to="{ name: 'student-profile', params: { id: s.studentId } }"
                class="min-w-0 flex-1 truncate font-medium text-fg hover:text-primary-700"
              >
                {{ s.fullName }}
              </RouterLink>
              <span class="text-fg-muted">{{ s.className }}</span>
              <span class="w-8 text-right font-semibold text-fg">{{ s.count }}</span>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </ReportShell>
</template>
