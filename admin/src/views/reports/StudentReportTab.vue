<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportsApi } from '@/api/reports.api'
import type { AttendanceDay } from '@/api/types'
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar.vue'
import DistributionBars from '@/components/reports/DistributionBars.vue'
import ReportShell from '@/components/reports/ReportShell.vue'
import StatCards from '@/components/reports/StatCards.vue'
import TrendChart from '@/components/scoring/TrendChart.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useReport } from '@/composables/useReport'
import { CATEGORY_COLORS, CATEGORIES, formatRate, monthOf, rateTone } from '@/utils/attendance'
import { formatDate } from '@/utils/format'
import { formatScore } from '@/utils/reports'

const props = defineProps<{ from: string; to: string; studentId: string }>()
const { t } = useI18n()

const report = useReport(
  () => (props.studentId ? { id: props.studentId, from: props.from, to: props.to } : null),
  (p) => reportsApi.student(p.id, { from: p.from, to: p.to }),
  (d) => d.score.scoresCount === 0 && d.attendance.total === 0,
)

const month = ref(monthOf(props.to))
watch(
  () => [props.studentId, props.to],
  () => (month.value = monthOf(props.to)),
)

const calendarDays = computed<AttendanceDay[]>(() =>
  (report.data.value?.attendance.days ?? []).map((d) => ({
    date: d.date,
    category: d.category,
    status: d.status,
    lessons: 1,
    records: [],
  })),
)

const stats = computed(() => {
  const s = report.data.value?.score
  if (!s) return []
  return [
    { key: 'avgScore', label: t('reports.stats.avgScore'), value: formatScore(s.avgScore) },
    {
      key: 'classRank',
      label: t('reports.stats.classRank'),
      value: s.classRank ?? '—',
      hint: t('reports.stats.outOf', { n: s.ratedStudentsInClass }),
    },
    {
      key: 'rank',
      label: t('reports.stats.schoolRank'),
      value: s.rank ?? '—',
    },
    { key: 'days', label: t('reports.stats.days'), value: s.daysCount },
    { key: 'scores', label: t('reports.stats.scores'), value: s.scoresCount },
  ]
})

const countOf = (key: 'present' | 'late' | 'absentExcused' | 'absentUnexcused') =>
  report.data.value?.attendance[key] ?? 0
const catKey = {
  present: 'present',
  late: 'late',
  absent_excused: 'absentExcused',
  absent_unexcused: 'absentUnexcused',
} as const
</script>

<template>
  <ReportShell
    :loading="report.loading.value"
    :error="report.error.value"
    :empty="report.empty.value"
    :idle="report.idle.value"
    :idle-text="t('reports.pickStudent')"
    @retry="report.reload"
  >
    <template v-if="report.data.value">
      <div class="flex flex-wrap items-center gap-2" data-testid="student-meta">
        <span class="text-lg font-semibold text-fg">{{ report.data.value.student.fullName }}</span>
        <BaseBadge tone="primary">{{ report.data.value.student.class.name }}</BaseBadge>
        <span v-if="report.data.value.student.studentCode" class="text-sm text-fg-muted">
          {{ report.data.value.student.studentCode }}
        </span>
      </div>
      <StatCards :items="stats" />

      <section class="card p-4 sm:p-5">
        <h2 class="mb-3 text-base font-semibold text-fg">{{ t('profile2.trend') }}</h2>
        <TrendChart :points="report.data.value.trend" />
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
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

        <section class="card p-4 sm:p-5" data-testid="student-attendance">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-fg">{{ t('reports.attendanceBlock') }}</h2>
            <span
              class="text-lg font-semibold"
              :class="{
                'text-success': rateTone(report.data.value.attendance.rate) === 'success',
                'text-warning': rateTone(report.data.value.attendance.rate) === 'warning',
                'text-danger': rateTone(report.data.value.attendance.rate) === 'danger',
              }"
              >{{ formatRate(report.data.value.attendance.rate) }}</span
            >
          </div>
          <ul class="mb-4 grid grid-cols-2 gap-2 text-sm">
            <li v-for="c in CATEGORIES" :key="c" class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: CATEGORY_COLORS[c] }"
              />
              <span class="text-fg-muted">{{ t(`attendance.categories.${c}`) }}</span>
              <span class="ml-auto font-medium text-fg">{{ countOf(catKey[c]) }}</span>
            </li>
          </ul>
          <p v-if="report.data.value.attendance.penalty > 0" class="mb-3 text-sm text-danger">
            {{ t('reports.cols.penalty') }}: -{{ report.data.value.attendance.penalty }}
          </p>
          <AttendanceCalendar
            v-model:month="month"
            :days="calendarDays"
            :working-weekdays="[1, 2, 3, 4, 5, 6]"
            :from="from"
            :to="to"
          />
        </section>
      </div>

      <section class="card">
        <h2 class="p-4 pb-0 text-base font-semibold text-fg sm:px-5">
          {{ t('reports.entries') }}
        </h2>
        <p
          v-if="report.data.value.entries.length === 0"
          class="p-5 text-center text-sm text-fg-muted"
        >
          {{ t('reports.noEntries') }}
        </p>
        <ul v-else class="divide-y divide-border" data-testid="student-entries">
          <li v-for="(e, i) in report.data.value.entries" :key="i" class="flex gap-3 p-4 sm:px-5">
            <span class="w-12 shrink-0 text-right text-lg font-semibold text-fg">{{
              e.value
            }}</span>
            <div class="min-w-0 flex-1 text-sm">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-fg-muted">
                <span>{{ formatDate(e.date) }}</span>
                <span
                  v-if="e.behaviorType"
                  class="font-medium"
                  :style="e.behaviorType.color ? { color: e.behaviorType.color } : undefined"
                  >{{ e.behaviorType.name }}</span
                >
                <span>- {{ e.teacher.fullName }}</span>
              </div>
              <p v-if="e.comment" class="mt-0.5 break-words text-fg">{{ e.comment }}</p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </ReportShell>
</template>
