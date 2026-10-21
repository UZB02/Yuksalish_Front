<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { attendanceApi } from '@/api/attendance.api'
import type { StudentAttendanceSummary } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useEffectiveAttendance } from '@/composables/useAttendanceSettings'
import { CATEGORY_COLORS, formatRate, monthOf, rateTone, textOn } from '@/utils/attendance'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import AttendanceCalendar from './AttendanceCalendar.vue'

const props = defineProps<{ studentId: string; from: string; to: string }>()
const { t } = useI18n()
const effective = useEffectiveAttendance()

const summary = ref<StudentAttendanceSummary | null>(null)
const loading = ref(false)
const error = ref('')
const month = ref(monthOf(props.to))

async function load() {
  if (!props.from || !props.to || props.from > props.to) return
  loading.value = true
  error.value = ''
  try {
    summary.value = await attendanceApi.studentSummary(props.studentId, {
      from: props.from,
      to: props.to,
    })
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

const root = ref<HTMLElement | null>(null)
onMounted(() => {
  void effective.load()
  void load()
  // Hisobot sahifasidan "#attendance" bilan kelganda bo'limga o'tish
  if (window.location.hash === '#attendance') root.value?.scrollIntoView?.()
})
watch(
  () => [props.studentId, props.from, props.to],
  () => {
    month.value = monthOf(props.to)
    void load()
  },
)

const counts = computed(() => [
  { key: 'present' as const, n: summary.value?.present ?? 0 },
  { key: 'late' as const, n: summary.value?.late ?? 0 },
  { key: 'absent_excused' as const, n: summary.value?.absentExcused ?? 0 },
  { key: 'absent_unexcused' as const, n: summary.value?.absentUnexcused ?? 0 },
])
const maxStatus = computed(() =>
  Math.max(1, ...(summary.value?.byStatus.map((s) => s.count) ?? [1])),
)
const tone = computed(() => rateTone(summary.value?.rate ?? null))
</script>

<template>
  <section id="attendance" ref="root" class="mt-8 scroll-mt-20" data-testid="attendance-section">
    <h2 class="mb-3 text-lg font-semibold text-fg">{{ t('attendance.profileTitle') }}</h2>

    <Skeleton v-if="loading && !summary" class="h-64 w-full" />
    <div v-else-if="error" class="card">
      <EmptyState :title="t('errors.loadFailed')" :description="error">
        <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <template v-else-if="summary">
      <div class="mb-4 grid gap-3 sm:grid-cols-5">
        <div class="card p-4 sm:col-span-1">
          <p class="text-xs text-fg-muted">{{ t('attendance.summary.rate') }}</p>
          <p
            class="mt-1 text-3xl font-extrabold tabular-nums"
            :class="{
              'text-success': tone === 'success',
              'text-warning': tone === 'warning',
              'text-danger': tone === 'danger',
              'text-fg': tone === 'neutral',
            }"
            data-testid="student-rate"
          >
            {{ formatRate(summary.rate) }}
          </p>
          <p class="text-xs text-fg-muted">
            {{ t('attendance.summary.totalN', { n: summary.total }) }}
          </p>
        </div>
        <div v-for="c in counts" :key="c.key" class="card p-4">
          <p class="flex items-center gap-1.5 text-xs text-fg-muted">
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ backgroundColor: CATEGORY_COLORS[c.key] }"
            />
            {{ t(`attendance.categories.${c.key}`) }}
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-fg">{{ c.n }}</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="card p-5">
          <h3 class="mb-3 text-base font-semibold text-fg">{{ t('attendance.calendarTitle') }}</h3>
          <AttendanceCalendar
            v-model:month="month"
            :days="summary.days"
            :working-weekdays="effective.settings.value.workingWeekdays"
            :from="summary.from"
            :to="summary.to"
          />
        </section>

        <div class="space-y-4">
          <section class="card p-5">
            <h3 class="mb-3 text-base font-semibold text-fg">{{ t('attendance.byStatus') }}</h3>
            <p v-if="summary.byStatus.length === 0" class="py-4 text-center text-sm text-fg-muted">
              {{ t('attendance.recordsEmptyTitle') }}
            </p>
            <ul v-else class="space-y-3">
              <li v-for="s in summary.byStatus" :key="s.statusId">
                <div class="mb-1 flex justify-between text-sm">
                  <span class="text-fg">{{ s.name }}</span>
                  <span class="font-medium text-fg">{{ s.count }}</span>
                </div>
                <div class="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    class="h-full rounded-full"
                    :style="{ width: `${(s.count / maxStatus) * 100}%`, backgroundColor: s.color }"
                  />
                </div>
              </li>
            </ul>
          </section>

          <section class="card p-5">
            <h3 class="mb-3 text-base font-semibold text-fg">{{ t('attendance.recent') }}</h3>
            <p v-if="summary.recent.length === 0" class="py-4 text-center text-sm text-fg-muted">
              {{ t('attendance.recordsEmptyTitle') }}
            </p>
            <ul v-else class="divide-y divide-border">
              <li v-for="r in summary.recent" :key="r.id" class="flex items-start gap-3 py-2.5">
                <span
                  class="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-xs font-bold"
                  :style="{ backgroundColor: r.status.color, color: textOn(r.status.color) }"
                  :title="r.status.name"
                >
                  {{ r.status.shortName }}
                </span>
                <div class="min-w-0 flex-1 text-sm">
                  <p class="text-fg">
                    {{ formatDate(r.date) }}
                    <span v-if="r.lessonNo" class="text-fg-muted">
                      , {{ t('attendance.lessonN', { n: r.lessonNo }) }}
                    </span>
                    <span v-if="r.minutesLate" class="text-fg-muted">
                      , {{ r.minutesLate }} {{ t('attendance.minutesUnit') }}
                    </span>
                  </p>
                  <p v-if="r.note" class="text-fg-muted">{{ r.note }}</p>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>
