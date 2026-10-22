<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays } from 'lucide-vue-next'
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
  <section
    id="attendance"
    ref="root"
    class="card scroll-mt-20 p-4 sm:p-5"
    data-testid="attendance-section"
  >
    <header class="mb-3 flex items-center gap-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
      >
        <CalendarDays class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">{{ t('attendance.profileTitle') }}</h2>
    </header>

    <Skeleton v-if="loading && !summary" class="h-64 w-full" />
    <EmptyState
      v-else-if="error"
      :title="t('errors.loadFailed')"
      class="!py-6"
      :description="error"
    >
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
    <template v-else-if="summary">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div class="col-span-2 min-w-0 rounded-lg bg-surface-muted px-3 py-2 sm:col-span-1">
          <p
            class="text-xl font-bold leading-tight tabular-nums"
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
          <p class="truncate text-xs text-fg-muted">
            {{ t('attendance.summary.rate') }} &middot;
            {{ t('attendance.summary.totalN', { n: summary.total }) }}
          </p>
        </div>
        <div v-for="c in counts" :key="c.key" class="min-w-0 rounded-lg bg-surface-muted px-3 py-2">
          <p class="text-xl font-semibold leading-tight tabular-nums text-fg">{{ c.n }}</p>
          <p class="flex items-center gap-1.5 text-xs text-fg-muted">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :style="{ backgroundColor: CATEGORY_COLORS[c.key] }"
            />
            <span class="truncate">{{ t(`attendance.categories.${c.key}`) }}</span>
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="min-w-0">
          <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('attendance.calendarTitle') }}</h3>
          <AttendanceCalendar
            v-model:month="month"
            :days="summary.days"
            :working-weekdays="effective.settings.value.workingWeekdays"
            :from="summary.from"
            :to="summary.to"
          />
        </div>

        <div class="min-w-0 space-y-4">
          <div>
            <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('attendance.byStatus') }}</h3>
            <p v-if="summary.byStatus.length === 0" class="py-2 text-center text-sm text-fg-muted">
              {{ t('attendance.recordsEmptyTitle') }}
            </p>
            <ul v-else class="space-y-2.5">
              <li v-for="s in summary.byStatus" :key="s.statusId">
                <div class="mb-1 flex justify-between gap-2 text-sm">
                  <span class="min-w-0 truncate text-fg">{{ s.name }}</span>
                  <span class="font-medium text-fg">{{ s.count }}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    class="h-full rounded-full"
                    :style="{ width: `${(s.count / maxStatus) * 100}%`, backgroundColor: s.color }"
                  />
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-1 text-sm font-semibold text-fg">{{ t('attendance.recent') }}</h3>
            <p v-if="summary.recent.length === 0" class="py-2 text-center text-sm text-fg-muted">
              {{ t('attendance.recordsEmptyTitle') }}
            </p>
            <ul v-else class="divide-y divide-border">
              <li v-for="r in summary.recent" :key="r.id" class="flex items-start gap-3 py-2">
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
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
